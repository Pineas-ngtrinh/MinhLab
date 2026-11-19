import { randomUUID } from 'node:crypto';
import type { DeclarePaymentInput } from '../../contracts/orders';
import type { OrderStatus } from '../../domain/orders/order';
import { evaluateOrderTransition } from '../../domain/orders/order-policy';
import { AppError } from '../../lib/errors';
import type { RoleCode } from '../../lib/auth-roles';
import type { OrderDependencies, OrderWriteRepository } from './order.ports';
import { createTrackingAccess, hashToken } from './checkout-idempotency';

function actorId(value?: string): string | null {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;
}
async function lockOrderAndPayment(orders: OrderWriteRepository, number: string) {
  const order = await orders.lockOrder(number);
  if (!order) throw new AppError(`Không tìm thấy đơn hàng [${number}]`);
  const payment = await orders.latestPayment(order.id);
  if (!payment) throw new AppError(`Không tìm thấy thanh toán cho đơn hàng [${number}]`);
  return {order, payment};
}

export function createOrderWorkflows(dependencies: OrderDependencies) {
  async function getOrderByNumber(number: string, token?: string, customerId?: string) {
    const tokenAllowed = token ? await dependencies.read.hasTrackingAccess(number, hashToken(token)) : false;
    const ownerAllowed = !tokenAllowed && customerId ? await dependencies.read.isOwner(number, customerId) : false;
    return tokenAllowed || ownerAllowed ? dependencies.read.getOrderDetail(number) : null;
  }

  return {
    getOrderByNumber,
    async declarePayment(input: DeclarePaymentInput, baseUrl = 'http://localhost:3000', customerId?: string) {
      if (input.paymentProofUrl?.trim()) {
        throw new AppError('Tạm thời chưa nhận ảnh biên lai qua liên kết công khai. Hãy khai báo thông tin giao dịch; ảnh sẽ được mở lại khi có kho lưu trữ riêng tư.', 409);
      }
      if (!await getOrderByNumber(input.orderNumber, input.trackingToken, customerId)) {
        throw new AppError('Không tìm thấy đơn hàng hoặc bạn không có quyền khai báo thanh toán.');
      }
      return dependencies.transaction(async ({orders, notifications}) => {
        const {order, payment: current} = await lockOrderAndPayment(orders, input.orderNumber);
        if (order.orderStatus !== 'PENDING_PAYMENT' || order.paymentStatus !== 'UNPAID' || current.verificationStatus === 'VERIFIED') {
          throw new AppError('Không thể khai báo lại thanh toán cho đơn đã xác nhận hoặc đã hủy.');
        }
        if (current.verificationStatus === 'PENDING' && current.transferredAt) return {order, payment: current};
        const payment = await orders.declarePayment(current.id, input);
        const orderItems = await orders.orderItems(order.id);
        await orders.recordDecision('PAYMENT', payment.id, 'PAYMENT_DECLARED', current.verificationStatus, 'PENDING', customerId ?? null);
        await notifications.storePaymentDeclared({
          orderNumber: order.orderNumber,
          amount: payment.amount,
          transactionReference: input.transactionReference,
          customer: {
            name: order.customerNameSnapshot,
            email: order.customerEmailSnapshot,
            phone: order.customerPhoneSnapshot,
            recipientName: order.shippingRecipientName,
            recipientPhone: order.shippingRecipientPhone,
            address: order.shippingAddressLine,
            province: order.shippingProvinceName,
          },
          items: orderItems.map(item => ({
            name: item.itemNameSnapshot,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal: item.lineTotal,
          })),
          declarationId: randomUUID(),
        });
        await notifications.paymentDeclared({
          orderNumber: order.orderNumber, amount: payment.amount,
          transactionReference: input.transactionReference, bankName: input.bankName,
          senderAccountName: input.senderAccountName,
          adminVerifyUrl: `${baseUrl}/api/admin/payments/verify?order=${order.orderNumber}&payment=${payment.id}`,
        });
        return {order, payment};
      });
    },

    async verifyPayment(number: string, verifiedBy: string, baseUrl = 'http://localhost:3000', expectedDeclaration?: { reference: string | null; transferredAt: string; telegramUserId?: string }) {
      return dependencies.transaction(async ({orders, notifications}) => {
        const actor = actorId(verifiedBy);
        if (!actor) throw new AppError('Tài khoản người duyệt không còn quyền đối soát.', 403);
        const {order, payment} = await lockOrderAndPayment(orders, number);
        if (expectedDeclaration && ((payment.transactionReference ?? null) !== expectedDeclaration.reference || payment.transferredAt !== expectedDeclaration.transferredAt)) {
          throw new AppError('Khai báo chuyển khoản đã thay đổi. Hãy kiểm tra lại trước khi xác nhận.', 409);
        }
        if (payment.verificationStatus === 'VERIFIED') {
          if (!await orders.isPaymentVerifier(actor, expectedDeclaration?.telegramUserId)) throw new AppError('Tài khoản người duyệt không còn quyền đối soát.', 403);
          return {order, payment, alreadyVerified: true};
        }
        if (payment.verificationStatus !== 'PENDING') throw new AppError('Chỉ có thể xác nhận khoản thanh toán đang chờ đối soát.');
        if (order.orderStatus !== 'PENDING_PAYMENT' || order.paymentStatus !== 'UNPAID') throw new AppError('Đơn hàng không còn chờ thanh toán.');
        if (payment.amount !== order.grandTotal) throw new AppError('Số tiền thanh toán không khớp với tổng đơn hàng.');
        const updatedPayment = await orders.verifyPayment(payment.id, actor, expectedDeclaration?.telegramUserId);
        if (!updatedPayment) throw new AppError('Tài khoản người duyệt không còn quyền đối soát.', 403);
        await orders.recordDecision('PAYMENT', payment.id, 'PAYMENT_VERIFIED', payment.verificationStatus, 'VERIFIED', actor);
        const updatedOrder = await orders.confirmPaidOrder(order.id);
        await notifications.storePaymentVerified({ orderNumber: order.orderNumber, amount: payment.amount });
        const token = await createTrackingAccess(orders, order.id);
        await orders.recordOrderHistory(order.id, order.orderStatus, 'CONFIRMED', actor, 'Thanh toán đã được xác nhận');
        const items = await orders.orderItems(order.id);
        await notifications.paymentVerified({orderNumber: order.orderNumber,
          customerEmailSnapshot: order.customerEmailSnapshot, customerNameSnapshot: order.customerNameSnapshot,
          amountPaid: payment.amount, paymentPurpose: 'FULL_PAYMENT', grandTotal: order.grandTotal, remainingBalance: 0,
          orderItems: items.map(item => ({itemName: item.itemNameSnapshot, quantity: item.quantity, unitPrice: item.unitPrice})),
          trackingUrl: `${baseUrl}/theo-doi-don?order=${order.orderNumber}&token=${token}`});
        return {order: updatedOrder, payment: updatedPayment, alreadyVerified: false};
      });
    },

    async rejectPayment(number: string, rejectedBy: string, reason = 'Giao dịch không hợp lệ hoặc chưa nhận được tiền', expectedDeclaration?: { reference: string | null; transferredAt: string; telegramUserId?: string }) {
      reason = reason.trim();
      if (!reason || reason.length > 2000) throw new AppError('Lý do từ chối không hợp lệ.');
      return dependencies.transaction(async ({orders}) => {
        const {order, payment} = await lockOrderAndPayment(orders, number);
        const actor = actorId(rejectedBy);
        if (!actor) throw new AppError('Tài khoản không còn quyền đối soát.', 403);
        if (expectedDeclaration && ((payment.transactionReference ?? null) !== expectedDeclaration.reference || payment.transferredAt !== expectedDeclaration.transferredAt))
          throw new AppError('Khai báo chuyển khoản đã thay đổi. Hãy kiểm tra lại.', 409);
        if (payment.verificationStatus === 'REJECTED' && payment.rejectionReason === reason) {
          if (!await orders.isPaymentVerifier(actor, expectedDeclaration?.telegramUserId)) throw new AppError('Tài khoản không còn quyền đối soát.', 403);
          return {order, payment, alreadyRejected: true};
        }
        if (payment.verificationStatus !== 'PENDING') throw new AppError('Chỉ có thể từ chối khoản thanh toán đang chờ đối soát.');
        if (order.orderStatus !== 'PENDING_PAYMENT' || order.paymentStatus !== 'UNPAID') throw new AppError('Đơn hàng không còn chờ thanh toán.', 409);
        const updated = await orders.rejectPayment(payment.id, actor, reason, expectedDeclaration?.telegramUserId);
        if (!updated) throw new AppError('Tài khoản không còn quyền đối soát.', 403);
        await orders.recordDecision('PAYMENT', payment.id, 'PAYMENT_REJECTED', payment.verificationStatus, 'REJECTED', actor);
        return {order, payment: updated, alreadyRejected: false};
      });
    },

    async updateOrderStatus(number: string, next: OrderStatus, changedBy?: string, role?: RoleCode) {
      return dependencies.transaction(async ({orders}) => {
        const current = await orders.lockOrder(number);
        if (!current) throw new AppError(`Không tìm thấy đơn hàng [${number}]`);
        const decision = evaluateOrderTransition(current, next, role);
        if (!decision.allowed) {
          const status = decision.code === 'FORBIDDEN' ? 403
            : decision.code === 'INVALID_TRANSITION' || decision.code === 'PAYMENT_REQUIRED' ? 409 : 400;
          throw new AppError(decision.message, status);
        }
        if (!decision.changed) return current;
        const productionBlocker = await orders.productionTransitionBlocker(current.id, next);
        if (productionBlocker) throw new AppError(productionBlocker, 409);
        const actor = actorId(changedBy);
        const collectCod = next === 'COMPLETED' && current.paymentTiming === 'COD';
        if (collectCod) await orders.collectCod(current, actor);
        const updated = await orders.setOrderStatus(current.id, next, collectCod ? 'PAID' : current.paymentStatus);
        await orders.recordOrderHistory(current.id, current.orderStatus, next, actor);
        await orders.recordDecision('ORDER', current.id, 'ORDER_STATUS_CHANGED', current.orderStatus, next, actor);
        return updated;
      });
    },

    async archiveOrder(number: string, archivedBy?: string, role?: RoleCode) {
      if (role !== 'ADMIN') throw new AppError('Chỉ ADMIN mới được xóa đơn khỏi danh sách quản trị.', 403);
      const actor = actorId(archivedBy);
      if (!actor) throw new AppError('Không xác định được người thực hiện.', 403);

      return dependencies.transaction(async ({ orders }) => {
        const current = await orders.lockOrder(number);
        if (!current) throw new AppError(`Không tìm thấy đơn hàng [${number}]`);
        if (current.paymentStatus !== 'UNPAID') {
          throw new AppError('Không thể xóa đơn đã thanh toán hoặc còn khoản tiền cần xử lý.', 409);
        }
        if (current.orderStatus === 'SHIPPED' || current.orderStatus === 'COMPLETED') {
          throw new AppError('Không thể xóa đơn đã bàn giao hoặc hoàn tất.', 409);
        }
        const productionBlocker = await orders.productionTransitionBlocker(current.id, 'CANCELLED');
        if (productionBlocker) throw new AppError(productionBlocker, 409);

        if (current.orderStatus !== 'CANCELLED') {
          const decision = evaluateOrderTransition(current, 'CANCELLED', role);
          if (!decision.allowed) throw new AppError(decision.message, decision.code === 'FORBIDDEN' ? 403 : 409);
          await orders.setOrderStatus(current.id, 'CANCELLED', current.paymentStatus);
          await orders.recordOrderHistory(current.id, current.orderStatus, 'CANCELLED', actor);
          await orders.recordDecision('ORDER', current.id, 'ORDER_STATUS_CHANGED', current.orderStatus, 'CANCELLED', actor);
        }

        if (!orders.archiveOrder) throw new AppError('Chức năng lưu trữ đơn chưa được cấu hình.', 500);
        if (!await orders.archiveOrder(current.id, actor)) {
          throw new AppError('Đơn hàng đã được xóa khỏi danh sách quản trị.', 409);
        }
        return { orderNumber: current.orderNumber };
      });
    },
  };
}

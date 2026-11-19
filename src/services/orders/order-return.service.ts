import { randomUUID } from 'node:crypto';
import type { OrderReturnRequest } from '../../domain/orders/order-return';
import type { OrderStatus, PaymentStatus } from '../../domain/orders/order';
import { AppError } from '../../lib/errors';
import { canRequestOrderReturn } from '../../domain/orders/order-return';

interface ReturnOrder {
  id: string;
  orderNumber: string;
  customerId?: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
}

interface OrderReturnRepository {
  lockOrder(orderNumber: string): Promise<ReturnOrder | null>;
  getRequestForOrder(orderId: string): Promise<OrderReturnRequest | null>;
  createRequest(input: {
    orderId: string;
    requestedByUserId: string | null;
    reason: string;
  }): Promise<OrderReturnRequest>;
  markReceived(input: { requestId: string; actorUserId: string }): Promise<OrderReturnRequest>;
  recordRefund(input: {
    orderId: string;
    requestId: string;
    actorUserId: string;
    amount: number;
    transactionReference: string;
    refundNumber: string;
  }): Promise<{ request: OrderReturnRequest; paymentStatus: PaymentStatus }>;
}

export function createOrderReturnService(dependencies: {
  transaction: <T>(operation: (repository: OrderReturnRepository) => Promise<T>) => Promise<T>;
}) {
  return {
    async requestReturn(input: {
      orderNumber: string;
      customerId?: string;
      requestedByUserId: string | null;
      reason: string;
    }) {
      const reason = input.reason.trim();
      if (!reason || reason.length > 2000) throw new AppError('Lý do hoàn hàng không hợp lệ.');

      return dependencies.transaction(async (repository) => {
        const order = await repository.lockOrder(input.orderNumber);
        if (!order || (input.customerId && order.customerId !== input.customerId)) {
          throw new AppError('Không tìm thấy đơn hàng hoặc bạn không có quyền gửi yêu cầu.', 404);
        }
        const existing = await repository.getRequestForOrder(order.id);
        if (existing) {
          if (existing.status === 'REQUESTED' && existing.reason === reason) return existing;
          throw new AppError('Đơn hàng đã có yêu cầu hoàn hàng.', 409);
        }
        if (!canRequestOrderReturn(order)) {
          throw new AppError('Chỉ gửi yêu cầu sau khi đơn đã giao và thanh toán hoàn tất.', 409);
        }

        return repository.createRequest({
          orderId: order.id,
          requestedByUserId: input.requestedByUserId,
          reason,
        });
      });
    },

    async markReturnReceived(input: { orderNumber: string; actorUserId: string }) {
      if (!input.actorUserId) throw new AppError('Không xác định được người thực hiện.', 403);
      return dependencies.transaction(async (repository) => {
        const order = await repository.lockOrder(input.orderNumber);
        if (!order) throw new AppError('Không tìm thấy đơn hàng.', 404);
        const request = await repository.getRequestForOrder(order.id);
        if (!request) throw new AppError('Đơn hàng chưa có yêu cầu hoàn hàng.', 404);
        if (request.status === 'RETURN_RECEIVED' || request.status === 'REFUNDED') return request;
        if (request.status !== 'REQUESTED') throw new AppError('Yêu cầu hoàn hàng không còn chờ nhận sản phẩm.', 409);
        return repository.markReceived({ requestId: request.id, actorUserId: input.actorUserId });
      });
    },

    async recordRefund(input: {
      orderNumber: string;
      actorUserId: string;
      amount: number;
      transactionReference: string;
    }) {
      if (!input.actorUserId) throw new AppError('Không xác định được người thực hiện.', 403);
      if (!Number.isSafeInteger(input.amount) || input.amount <= 0) {
        throw new AppError('Số tiền hoàn phải là số nguyên VND lớn hơn 0.');
      }
      const transactionReference = input.transactionReference.trim();
      if (!transactionReference || transactionReference.length > 120) {
        throw new AppError('Mã giao dịch hoàn tiền không hợp lệ.');
      }

      return dependencies.transaction(async (repository) => {
        const order = await repository.lockOrder(input.orderNumber);
        if (!order) throw new AppError('Không tìm thấy đơn hàng.', 404);
        const request = await repository.getRequestForOrder(order.id);
        if (!request) throw new AppError('Đơn hàng chưa có yêu cầu hoàn hàng.', 404);
        if (request.status === 'REFUNDED') {
          if (request.refundedAmount === input.amount && request.transactionReference === transactionReference) {
            return { request, paymentStatus: order.paymentStatus, alreadyRecorded: true };
          }
          throw new AppError('Khoản hoàn tiền của yêu cầu này đã được ghi nhận.', 409);
        }
        if (request.status !== 'RETURN_RECEIVED') {
          throw new AppError('Admin cần nhận lại và kiểm tra sản phẩm trước khi ghi nhận hoàn tiền.', 409);
        }

        const result = await repository.recordRefund({
          orderId: order.id,
          requestId: request.id,
          actorUserId: input.actorUserId,
          amount: input.amount,
          transactionReference,
          refundNumber: `RF-${order.orderNumber.replace(/[^A-Za-z0-9]/g, '')}-${randomUUID().slice(0, 8)}`,
        });
        return { ...result, alreadyRecorded: false };
      });
    },
  };
}

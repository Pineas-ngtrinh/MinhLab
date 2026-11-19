import { createOrderNumber } from './order-number';
import { catalogShippingFee, validOrderAmount, validUnitPrice } from '../../domain/orders/checkout-pricing';
import { AppError } from '../../lib/errors';
import type { CreateOrderInput } from '../../contracts/orders';
import type { CheckoutResult } from '../../domain/orders/order';
import type { OrderDependencies, PricedOrderItem } from './order.ports';
import { checkoutHashes, recoverCheckout, createTrackingAccess } from './checkout-idempotency';

export function createCheckout(dependencies: OrderDependencies) {
  return async function createOrder(
    input: CreateOrderInput,
    authenticatedCustomerId?: string,
    idempotencyKey?: string,
  ): Promise<CheckoutResult> {
    if (!input.customerName?.trim() || !input.customerEmail?.trim() || !input.customerPhone?.trim() || !input.shippingAddress?.trim()) {
      throw new AppError('Thiếu thông tin bắt buộc: Họ tên, Email, Số điện thoại hoặc Địa chỉ giao hàng.');
    }
    if (!Array.isArray(input.items) || input.items.length === 0) throw new AppError('Giỏ hàng trống. Không thể tạo đơn.');
    if (input.items.some((item) => !Number.isInteger(item.quantity) || item.quantity < 1)) {
      throw new AppError('Số lượng sản phẩm không hợp lệ.');
    }
    if (input.items.some((item) => item.itemType !== 'READY_PRODUCT' && item.itemType !== 'CUSTOM_PRINT')) {
      throw new AppError('Loại sản phẩm trong đơn hàng không hợp lệ.');
    }
    if (input.items.some((item) => item.itemType === 'READY_PRODUCT' && item.printSpecificationId)) {
      throw new AppError('Sản phẩm có sẵn không được kèm thông số in theo yêu cầu.');
    }
    if (input.items.some((item) => item.itemType === 'CUSTOM_PRINT' && (item.productId || item.productVariantId))) {
      throw new AppError('Sản phẩm in theo yêu cầu không được kèm mã sản phẩm hoặc biến thể có sẵn.');
    }
    if (input.paymentMethod !== 'VIETQR') throw new AppError('Hiện chỉ hỗ trợ thanh toán bằng QR cá nhân VietQR.');
  
    if (input.items.some((item) => item.itemType === 'CUSTOM_PRINT')) {
      throw new AppError('Hãy chấp thuận toàn bộ báo giá tại trang yêu cầu in để tạo đúng một đơn; không checkout từng thông số riêng.');
    }
    if (input.items.some((item) => item.itemType === 'READY_PRODUCT' && !item.productId)) {
      throw new AppError('Không xác định được sản phẩm trong đơn hàng.');
    }
    const hashes = idempotencyKey !== undefined ? checkoutHashes(idempotencyKey, input, authenticatedCustomerId) : null;
    return dependencies.transaction(async ({orders, notifications}) => {
      if (hashes) {
        const recovered = await recoverCheckout(orders, hashes);
        if (recovered) return recovered;
      }
      const destination = dependencies.paymentDestination();
      if(!destination) throw new AppError('Thanh toán VietQR chưa sẵn sàng. Vui lòng liên hệ xưởng.',503);
      const pricedItems: PricedOrderItem[] = await Promise.all(input.items.map(async item => {
        const variant = await orders.findVariant(item.productId ?? '', item.color, dependencies.requirePublishedCatalog(), item.productVariantId);
        if (!variant) throw new AppError(`Không tìm thấy mẫu “${item.itemName}” đang được bán.`);
        return {...item, itemName: variant.name, unitPrice: variant.price,
          productVariantId: variant.id, skuSnapshot: variant.sku, color: variant.color, material: variant.material};
      }));
      if (pricedItems.some(item => !validUnitPrice(item.unitPrice))) {
        throw new AppError('Đơn giá cần là số nguyên VND trong giới hạn thanh toán. Vui lòng liên hệ xưởng.');
      }
      const subtotal = pricedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      const shippingFee = catalogShippingFee(subtotal);
      const grandTotal = subtotal + shippingFee;
      if (!validOrderAmount(subtotal) || !validOrderAmount(grandTotal)) throw new AppError('Tổng đơn vượt giới hạn thanh toán. Vui lòng liên hệ xưởng.');
      const timing = 'PREPAID';
      const number = createOrderNumber();
      const order = await orders.createOrder({orderNumber: number, customerId: authenticatedCustomerId,
        customer: input, status: 'PENDING_PAYMENT', timing,
        subtotal, shippingFee, grandTotal, requiredDepositAmount: timing === 'PREPAID' ? grandTotal : 0,
        placedAt: new Date().toISOString()});
      if (hashes) await orders.saveCheckoutHashes(order.id, hashes.key, hashes.request);
      const trackingToken = await createTrackingAccess(orders, order.id);
      const items = [];
      for (const item of pricedItems) items.push(await orders.addItem(order.id, item));
      await orders.recordOrderHistory(order.id, null, order.orderStatus, null, 'Đơn hàng được tạo');
      const payment = timing === 'PREPAID' ? await orders.createPrepayment(order,destination!) : undefined;
      await notifications.storeOrderCreated({
        orderNumber: number,
        grandTotal,
        paymentMethod: input.paymentMethod,
      });
      return {order, items, payment, trackingToken};
    });
  };
}

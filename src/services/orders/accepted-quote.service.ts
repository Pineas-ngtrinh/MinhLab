import { createOrderNumber } from './order-number';
import type { OrderTransactionContext } from './order.ports';
import type { BankDestination } from '../../contracts/payments';
import { validOrderAmount, validUnitPrice } from '../../domain/orders/checkout-pricing';
import { createTrackingAccess } from './checkout-idempotency';
import { AppError } from '../../lib/errors';
import type { AcceptedCustomQuote } from '../../domain/orders/accepted-quote';
/** Caller owns the locked acceptance transaction; never calls catalogue checkout with client quantities. */
export async function createAcceptedCustomOrder(context: OrderTransactionContext, input: AcceptedCustomQuote, destination: BankDestination | null) {
    if (!destination)
        throw new AppError('Thanh toán VietQR chưa được cấu hình.', 503);
    const subtotal = input.quantity * input.unitPrice;
    const total = subtotal + input.shipping;
    if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 100 || !validUnitPrice(input.unitPrice) || !validOrderAmount(total) || !Number.isInteger(input.shipping) || input.shipping < 0)
        throw new AppError('Snapshot báo giá không hợp lệ.', 409);
    const number = createOrderNumber();
    const order = await context.orders.createOrder({ orderNumber: number, customerId: input.customerId, customer: { customerName: input.name, customerEmail: input.email, customerPhone: input.phone, shippingAddress: input.address }, status: 'PENDING_PAYMENT', timing: 'PREPAID', subtotal, shippingFee: input.shipping, grandTotal: total, requiredDepositAmount: total, placedAt: new Date().toISOString() });
    await context.orders.addItem(order.id, { itemType: 'CUSTOM_PRINT', itemName: input.description, quantity: input.quantity, unitPrice: input.unitPrice, productVariantId: null, skuSnapshot: null, printSpecificationId: input.specificationId, color: input.color, material: input.material });
    await context.orders.createPrepayment(order, destination);
    await createTrackingAccess(context.orders, order.id);
    await context.orders.recordOrderHistory(order.id, null, 'PENDING_PAYMENT', input.customerId, 'Chấp thuận toàn bộ báo giá custom');
    await context.notifications.storeOrderCreated({ orderNumber: number, grandTotal: total, paymentMethod: 'VIETQR' });
    return { id: order.id, number };
}

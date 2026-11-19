import { createHash, randomBytes } from 'node:crypto';
import { AppError } from '../../lib/errors';
import type { CreateOrderInput } from '../../contracts/orders';
import type { OrderWriteRepository } from './order.ports';

export function checkoutHashes(key: string, input: CreateOrderInput, customerId?: string) {
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(key)) {
    throw new AppError('Mã yêu cầu đặt hàng không hợp lệ. Vui lòng mở lại thanh toán.');
  }
  return { key: hashToken(key), request: hashToken(JSON.stringify({customerId: customerId ?? null, input})) };
}
export function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
export async function createTrackingAccess(orders: OrderWriteRepository, orderId: string) {
  const token = randomBytes(32).toString('base64url');
  await orders.addTrackingToken(orderId, hashToken(token));
  return token;
}
export async function recoverCheckout(orders: OrderWriteRepository, hashes: ReturnType<typeof checkoutHashes>) {
  // The adapter owns the transaction-scoped lock; the use case owns replay/conflict decisions.
  const existing = await orders.lockCheckout(hashes.key);
  if (!existing) return null;
  if (existing.requestHash !== hashes.request) {
    throw new AppError('Mã yêu cầu đã được dùng cho thông tin đặt hàng khác. Vui lòng kiểm tra lại đơn.', 409);
  }
  const items = await orders.orderItems(existing.order.id);
  const payment = await orders.latestPayment(existing.order.id);
  const trackingToken = await createTrackingAccess(orders, existing.order.id);
  return {order: existing.order, items, payment: payment ?? undefined, trackingToken};
}

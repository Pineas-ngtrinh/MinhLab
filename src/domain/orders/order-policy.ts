import type { RoleCode } from '../../lib/auth-roles';
import { ORDER_STATUSES, type Order, type OrderStatus } from './order';

export const ORDER_TRANSITIONS: Readonly<Partial<Record<OrderStatus, readonly OrderStatus[]>>> = {
  PENDING_PAYMENT: ['CANCELLED'],
  DEPOSIT_PAID: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['IN_PRODUCTION', 'CANCELLED'],
  IN_PRODUCTION: ['READY_TO_SHIP', 'CANCELLED'],
  READY_TO_SHIP: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['COMPLETED'],
};

const ROLE_TRANSITIONS: Readonly<Partial<Record<RoleCode, readonly string[]>>> = {
  ADMIN: ['*'],
  PRINT_OPERATOR: ['IN_PRODUCTION:READY_TO_SHIP'],
  WORKSHOP_OPERATOR: ['IN_PRODUCTION:READY_TO_SHIP'],
};

type RejectionCode = 'INVALID_STATUS' | 'INVALID_TRANSITION' | 'FORBIDDEN' | 'PAYMENT_REQUIRED' | 'REFUND_REQUIRED';
export type TransitionDecision = { allowed: true; changed: boolean }
  | { allowed: false; code: RejectionCode; message: string };

export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && ORDER_STATUSES.some(status => status === value);
}

/** The same policy serves HTTP handlers and background use cases. It has no I/O. */
export function evaluateOrderTransition(
  order: Pick<Order, 'orderStatus' | 'paymentStatus' | 'paymentTiming'>,
  next: OrderStatus,
  role?: RoleCode,
): TransitionDecision {
  if (!isOrderStatus(next)) return { allowed: false, code: 'INVALID_STATUS', message: 'Trạng thái đơn hàng không hợp lệ.' };
  const permissions = role ? ROLE_TRANSITIONS[role] : undefined;
  // A no-op still requires permission to reach this status; it must not bypass RBAC.
  if (order.orderStatus === next) {
    if (permissions?.some(edge => edge === '*' || edge.endsWith(`:${next}`))) {
      return { allowed: true, changed: false };
    }
    return { allowed: false, code: 'FORBIDDEN', message: 'Vai trò hiện tại không được phép thực hiện bước chuyển trạng thái này.' };
  }
  if (!ORDER_TRANSITIONS[order.orderStatus]?.includes(next)) {
    return { allowed: false, code: 'INVALID_TRANSITION', message: `Không thể chuyển đơn từ ${order.orderStatus} sang ${next}.` };
  }
  if (!permissions || (!permissions.includes('*') && !permissions.includes(`${order.orderStatus}:${next}`))) {
    return { allowed: false, code: 'FORBIDDEN', message: 'Vai trò hiện tại không được phép thực hiện bước chuyển trạng thái này.' };
  }
  if (next === 'IN_PRODUCTION' && order.paymentStatus !== 'PAID' && order.paymentTiming !== 'COD') {
    return { allowed: false, code: 'PAYMENT_REQUIRED', message: 'Chỉ đưa vào sản xuất sau khi đã xác nhận thanh toán hoặc đơn đủ điều kiện COD.' };
  }
  if (next === 'CANCELLED' && order.paymentStatus !== 'UNPAID') {
    return { allowed: false, code: 'REFUND_REQUIRED', message: 'Đơn đã thu tiền cần được xử lý hoàn tiền trước khi hủy.' };
  }
  return { allowed: true, changed: true };
}

import type { Order } from './order';

export const ORDER_RETURN_STATUSES = ['REQUESTED', 'RETURN_RECEIVED', 'REFUNDED'] as const;
export type OrderReturnStatus = (typeof ORDER_RETURN_STATUSES)[number];

export interface OrderReturnRequest {
  id: string;
  orderId: string;
  status: OrderReturnStatus;
  reason: string;
  requestedAt: string;
  receivedAt?: string;
  refundedAt?: string;
  refundedAmount?: number;
  transactionReference?: string;
}

export function canRequestOrderReturn(order: Pick<Order, 'orderStatus' | 'paymentStatus'>): boolean {
  return order.orderStatus === 'COMPLETED' && order.paymentStatus === 'PAID';
}

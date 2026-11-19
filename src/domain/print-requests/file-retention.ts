export interface FileRetentionOrder {
  status: string;
  paymentStatus: string;
  completedAt: string | null;
  cancelledAt: string | null;
  pendingPayment: boolean;
  productionActive: boolean;
  returnStatus: string | null;
  refundedAt: string | null;
}
export interface FileRetentionRequest {
  status: string;
  closedAt: string | null;
  closedReason: string | null;
  orders: FileRetentionOrder[];
  holds: { releasedAt: string | null }[];
}
export interface FileRetentionContext {
  kind: string;
  createdAt: string;
  unknownReferences: boolean;
  requests: FileRetentionRequest[];
}
export interface FileRetentionDecision {
  deleteAfter: string | null;
  reason: 'OUT_OF_SCOPE' | 'UNKNOWN_REFERENCE' | 'ACTIVE_REQUEST' | 'ACTIVE_ORDER' | 'HOLD' | 'UNRESOLVED_PAYMENT' | 'MISSING_TIMESTAMP' | 'SCHEDULED';
}
const DAY = 86_400_000;
const modelKinds = new Set(['PRINT_SOURCE', 'PRINT_APPROVED', 'SLICER_ARTIFACT']);
export function modelFileRetention(context: FileRetentionContext): FileRetentionDecision {
  const blocked = (reason: FileRetentionDecision['reason']): FileRetentionDecision => ({ deleteAfter: null, reason });
  if (!modelKinds.has(context.kind)) return blocked('OUT_OF_SCOPE');
  if (context.unknownReferences) return blocked('UNKNOWN_REFERENCE');
  const deadlines: number[] = [];
  const add = (time: string | null, days: number) => deadlines.push(time ? Date.parse(time) + days * DAY : NaN);
  if (!context.requests.length) add(context.createdAt, 2);
  for (const request of context.requests) {
    if (request.holds.some(hold => !hold.releasedAt)) return blocked('HOLD');
    for (const hold of request.holds) add(hold.releasedAt, 7);
    if (!request.orders.length) {
      if (!['CLOSED', 'REJECTED'].includes(request.status)) return blocked('ACTIVE_REQUEST');
      if (!request.closedReason || request.closedReason === 'CONVERTED') return blocked('UNKNOWN_REFERENCE');
      add(request.closedAt, 2);
    }
    for (const order of request.orders) {
      if (order.productionActive || !['COMPLETED', 'CANCELLED'].includes(order.status)) return blocked('ACTIVE_ORDER');
      if (order.returnStatus && order.returnStatus !== 'REFUNDED') return blocked('HOLD');
      if (order.pendingPayment) return blocked('UNRESOLVED_PAYMENT');
      if (order.status === 'COMPLETED') add(order.completedAt, 7);
      if (order.status === 'CANCELLED') {
        if (order.paymentStatus === 'UNPAID') add(order.cancelledAt, 2);
        else if (order.paymentStatus !== 'REFUNDED' || !order.refundedAt) return blocked('UNRESOLVED_PAYMENT');
      }
      if (order.returnStatus === 'REFUNDED') add(order.refundedAt, 7);
    }
  }
  if (!deadlines.length || deadlines.some(time => !Number.isFinite(time))) return blocked('MISSING_TIMESTAMP');
  return { deleteAfter: new Date(Math.max(...deadlines)).toISOString(), reason: 'SCHEDULED' };
}

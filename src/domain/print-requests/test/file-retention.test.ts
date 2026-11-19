import test from 'node:test';
import assert from 'node:assert/strict';
import { modelFileRetention, type FileRetentionContext, type FileRetentionOrder } from '../file-retention';
const context = (): FileRetentionContext => ({ kind: 'PRINT_SOURCE', createdAt: '2026-11-01T00:00:00Z', unknownReferences: false, requests: [] });
const order = (): FileRetentionOrder => ({ status: 'COMPLETED', paymentStatus: 'PAID', completedAt: '2026-11-10T00:00:00Z', cancelledAt: null, pendingPayment: false, productionActive: false, returnStatus: null, refundedAt: null });
const converted = (o = order()): FileRetentionContext => ({ ...context(), requests: [{ status: 'CLOSED', closedReason: 'CONVERTED', closedAt: '2026-11-02T00:00:00Z', holds: [], orders: [o] }] });
test('orphan models expire 48 hours after upload; protected categories never enter model cleanup', () => {
  assert.equal(modelFileRetention(context()).deleteAfter, '2026-11-03T00:00:00.000Z');
  for (const kind of ['LEGACY', 'PAYMENT_PROOF', 'QC_EVIDENCE']) assert.equal(modelFileRetention({ ...context(), kind }).deleteAfter, null);
  assert.equal(modelFileRetention({ ...context(), unknownReferences: true }).reason, 'UNKNOWN_REFERENCE');
});
test('active requests have no deadline; a genuinely closed request gets 48 hours from closure', () => {
  const c = context();
  c.requests = [{ status: 'UNDER_REVIEW', closedReason: null, closedAt: null, holds: [], orders: [] }];
  assert.equal(modelFileRetention(c).reason, 'ACTIVE_REQUEST');
  c.requests[0] = { ...c.requests[0], status: 'CLOSED', closedReason: 'CUSTOMER_CLOSED', closedAt: '2026-11-12T00:00:00Z' };
  assert.equal(modelFileRetention(c).deleteAfter, '2026-11-14T00:00:00.000Z');
  c.requests[0].closedReason = 'CONVERTED';
  assert.equal(modelFileRetention(c).deleteAfter, null);
});
test('conversion closing a request never starts its deletion timer while the order is active', () => {
  for (const status of ['PENDING_PAYMENT', 'CONFIRMED', 'IN_PRODUCTION', 'READY_TO_SHIP', 'SHIPPED']) {
    assert.equal(modelFileRetention(converted({ ...order(), status })).reason, 'ACTIVE_ORDER');
  }
  assert.equal(modelFileRetention(converted()).deleteAfter, '2026-11-17T00:00:00.000Z');
});
test('returns, payment declarations, production and manual holds block deletion', () => {
  for (const patch of [{ pendingPayment: true }, { productionActive: true }, { returnStatus: 'REQUESTED' }, { returnStatus: 'RETURN_RECEIVED' }]) {
    assert.equal(modelFileRetention(converted({ ...order(), ...patch })).deleteAfter, null);
  }
  const c = converted(); c.requests[0].holds = [{ releasedAt: null }];
  assert.equal(modelFileRetention(c).reason, 'HOLD');
  c.requests[0].holds[0].releasedAt = '2026-11-18T00:00:00Z';
  assert.equal(modelFileRetention(c).deleteAfter, '2026-11-25T00:00:00.000Z');
});
test('cancelled unpaid orders get 48 hours; money requires a completed refund resolution', () => {
  const cancelled = { ...order(), status: 'CANCELLED', cancelledAt: '2026-11-12T00:00:00Z' };
  assert.equal(modelFileRetention(converted({ ...cancelled, paymentStatus: 'UNPAID' })).deleteAfter, '2026-11-14T00:00:00.000Z');
  assert.equal(modelFileRetention(converted(cancelled)).reason, 'UNRESOLVED_PAYMENT');
  assert.equal(modelFileRetention(converted({ ...cancelled, paymentStatus: 'REFUNDED', returnStatus: 'REFUNDED', refundedAt: '2026-11-18T00:00:00Z' })).deleteAfter, '2026-11-25T00:00:00.000Z');
});
test('shared models use the latest deadline and fail closed on missing timestamps', () => {
  const c = converted();
  c.requests.push({ status: 'CLOSED', closedReason: 'STAFF_CLOSED', closedAt: '2026-11-20T00:00:00Z', holds: [], orders: [] });
  assert.equal(modelFileRetention(c).deleteAfter, '2026-11-22T00:00:00.000Z');
  c.requests[0].orders[0].completedAt = null;
  assert.equal(modelFileRetention(c).reason, 'MISSING_TIMESTAMP');
});

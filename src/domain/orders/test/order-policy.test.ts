import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ORDER_STATUSES, type Order } from '../order';
import { evaluateOrderTransition } from '../order-policy';

const current = (orderStatus: Order['orderStatus'], paymentStatus: Order['paymentStatus'] = 'UNPAID', paymentTiming: Order['paymentTiming'] = 'COD') => ({orderStatus, paymentStatus, paymentTiming});

test('commerce transitions accept only the documented edges, with no effects on retries', () => {
  const allowed = new Set([
    'PENDING_PAYMENT:CANCELLED', 'DEPOSIT_PAID:CONFIRMED', 'DEPOSIT_PAID:CANCELLED',
    'CONFIRMED:IN_PRODUCTION', 'CONFIRMED:CANCELLED', 'IN_PRODUCTION:READY_TO_SHIP',
    'IN_PRODUCTION:CANCELLED', 'READY_TO_SHIP:SHIPPED', 'READY_TO_SHIP:CANCELLED', 'SHIPPED:COMPLETED',
  ]);
  for (const from of ORDER_STATUSES) for (const to of ORDER_STATUSES) {
    const decision = evaluateOrderTransition(current(from), to, 'ADMIN');
    assert.equal(decision.allowed, from === to || allowed.has(`${from}:${to}`), `${from} -> ${to}`);
    if (decision.allowed) assert.equal(decision.changed, from !== to);
  }
});
test('operators, reviewers and customers cannot take staff-only actions', () => {
  assert.equal(evaluateOrderTransition(current('IN_PRODUCTION'), 'READY_TO_SHIP', 'PRINT_OPERATOR').allowed, true);
  assert.equal(evaluateOrderTransition(current('IN_PRODUCTION'), 'READY_TO_SHIP', 'WORKSHOP_OPERATOR').allowed, true);
  assert.equal(evaluateOrderTransition(current('CONFIRMED'), 'IN_PRODUCTION', 'ADMIN').allowed, true);
  for (const role of ['CUSTOMER', 'FILE_REVIEWER', 'PRINT_OPERATOR', 'WORKSHOP_OPERATOR', undefined] as const) {
    const decision = evaluateOrderTransition(current('CONFIRMED'), 'IN_PRODUCTION', role);
    assert.equal(decision.allowed, false);
    if (!decision.allowed) assert.equal(decision.code, 'FORBIDDEN');
  }
});
test('prepaid production needs paid funds, and collected funds cannot be cancelled', () => {
  for (const payment of ['UNPAID', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'] as const) {
    const decision = evaluateOrderTransition(current('CONFIRMED', payment, 'PREPAID'), 'IN_PRODUCTION', 'ADMIN');
    assert.equal(decision.allowed, false);
    if (!decision.allowed) assert.equal(decision.code, 'PAYMENT_REQUIRED');
  }
  assert.equal(evaluateOrderTransition(current('CONFIRMED', 'PAID', 'PREPAID'), 'IN_PRODUCTION', 'ADMIN').allowed, true);
  const cancellation = evaluateOrderTransition(current('CONFIRMED', 'PAID'), 'CANCELLED', 'ADMIN');
  assert.equal(cancellation.allowed, false);
  if (!cancellation.allowed) assert.equal(cancellation.code, 'REFUND_REQUIRED');
});
test('workshop labels cannot be injected into commerce status', () => {
  for (const value of ['PendingQuote', 'PaymentReview', null, 10]) {
    // Model an unvalidated external caller while keeping the production API strictly typed.
    const decision = evaluateOrderTransition(current('PENDING_PAYMENT'), value as Order['orderStatus'], 'ADMIN');
    assert.equal(decision.allowed, false);
    if (!decision.allowed) assert.equal(decision.code, 'INVALID_STATUS');
  }
});

test('idempotent retries still require permission to reach the requested status', () => {
  for (const role of ['CUSTOMER', 'FILE_REVIEWER', undefined] as const) {
    const decision = evaluateOrderTransition(current('CONFIRMED'), 'CONFIRMED', role);
    assert.equal(decision.allowed, false);
    if (!decision.allowed) assert.equal(decision.code, 'FORBIDDEN');
  }
  for (const status of ['CONFIRMED', 'SHIPPED', 'COMPLETED', 'CANCELLED'] as const) {
    const decision = evaluateOrderTransition(current(status), status, 'PRINT_OPERATOR');
    assert.equal(decision.allowed, false, `operator retry at ${status}`);
    if (!decision.allowed) assert.equal(decision.code, 'FORBIDDEN');
  }
  assert.deepEqual(evaluateOrderTransition(current('READY_TO_SHIP'), 'READY_TO_SHIP', 'PRINT_OPERATOR'),
    { allowed: true, changed: false });
  assert.deepEqual(evaluateOrderTransition(current('IN_PRODUCTION'), 'IN_PRODUCTION', 'ADMIN'),
    { allowed: true, changed: false });
});

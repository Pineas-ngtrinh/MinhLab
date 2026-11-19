import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { OrderReturnRequest } from '../../../domain/orders/order-return';
import type { OrderStatus, PaymentStatus } from '../../../domain/orders/order';
import { createOrderReturnService } from '../order-return.service';

function fixture() {
  const order = { id: 'order-id', orderNumber: 'ML-TEST', customerId: 'owner', orderStatus: 'COMPLETED' as OrderStatus, paymentStatus: 'PAID' as PaymentStatus };
  let request: OrderReturnRequest | null = null;
  let refunds = 0;
  const service = createOrderReturnService({
    transaction: async (run) => run({
      async lockOrder() { return order; },
      async getRequestForOrder() { return request; },
      async createRequest(input) {
        request = { id: 'return-id', orderId: input.orderId, status: 'REQUESTED', reason: input.reason, requestedAt: new Date(0).toISOString() };
        return request;
      },
      async markReceived() {
        request = { ...request!, status: 'RETURN_RECEIVED' };
        return request;
      },
      async recordRefund(input) {
        refunds++;
        order.paymentStatus = 'REFUNDED';
        request = { ...request!, status: 'REFUNDED', refundedAmount: input.amount, transactionReference: input.transactionReference };
        return { request, paymentStatus: order.paymentStatus };
      },
    }),
  });
  return { service, order, refundCount: () => refunds };
}

test('returns require completed delivery, paid status and the correct customer', async () => {
  const { service, order } = fixture();
  const input = { orderNumber: order.orderNumber, customerId: 'owner', requestedByUserId: 'owner', reason: 'Không phù hợp' };
  await assert.rejects(service.requestReturn({ ...input, customerId: 'other' }), { status: 404 });
  for (const status of ['PENDING_PAYMENT', 'CONFIRMED', 'IN_PRODUCTION', 'READY_TO_SHIP', 'SHIPPED', 'CANCELLED'] as const) {
    order.orderStatus = status;
    await assert.rejects(service.requestReturn(input), { status: 409 });
  }
  order.orderStatus = 'COMPLETED';
  order.paymentStatus = 'UNPAID';
  await assert.rejects(service.requestReturn(input), { status: 409 });
});

test('return retries preserve one request; refunds require receipt and cannot be recorded twice', async () => {
  const { service, order, refundCount } = fixture();
  const input = { orderNumber: order.orderNumber, customerId: 'owner', requestedByUserId: 'owner', reason: 'Không phù hợp' };
  const first = await service.requestReturn(input);
  assert.deepEqual(await service.requestReturn(input), first);
  await assert.rejects(service.requestReturn({ ...input, reason: 'Đổi lý do' }), { status: 409 });
  const refund = { orderNumber: order.orderNumber, actorUserId: 'admin', amount: 100000, transactionReference: 'BANK-REFUND-1' };
  await assert.rejects(service.recordRefund(refund), { status: 409 });
  await service.markReturnReceived({ orderNumber: order.orderNumber, actorUserId: 'admin' });
  assert.equal((await service.recordRefund(refund)).alreadyRecorded, false);
  assert.equal((await service.recordRefund(refund)).alreadyRecorded, true);
  await assert.rejects(service.recordRefund({ ...refund, amount: 50000 }), { status: 409 });
  assert.equal(refundCount(), 1);
});

test('refund records reject invalid money, missing actor and missing transaction reference', async () => {
  const { service } = fixture();
  const input = { orderNumber: 'ML-TEST', actorUserId: 'admin', amount: 100000, transactionReference: 'BANK-REFUND-1' };
  for (const amount of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(service.recordRefund({ ...input, amount }));
  }
  await assert.rejects(service.recordRefund({ ...input, actorUserId: '' }), { status: 403 });
  await assert.rejects(service.recordRefund({ ...input, transactionReference: ' ' }));
});

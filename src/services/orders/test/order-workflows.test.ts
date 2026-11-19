import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../../../lib/errors';
import { createOrderWorkflows } from '../order-workflows.service';
import type { Order, Payment } from '../../../domain/orders/order';
import type { OrderDependencies, OrderTransactionContext } from '../order.ports';

function unexpectedOperation(): never {
  throw new Error('Unexpected payment dependency');
}

const unusedDependencies: OrderDependencies = {
  paymentDestination: unexpectedOperation,
  requirePublishedCatalog: unexpectedOperation,
  transaction: unexpectedOperation,
  read: {
    getOrderDetail: unexpectedOperation,
    getCustomerOrdersPage: unexpectedOperation,
    hasTrackingAccess: unexpectedOperation,
    isOwner: unexpectedOperation,
    getOrdersPage: unexpectedOperation,
    getPaymentsPage: unexpectedOperation,
  },
};

test('payment confirmation rejects an outdated Telegram declaration under the order lock', async () => {
  const context = {
    orders: {
      async lockOrder() { return { id: 'order' }; },
      async latestPayment() { return { transactionReference: 'NEW', transferredAt: '2026-11-14T00:00:01.000Z' }; },
    },
  } as unknown as OrderTransactionContext;
  const workflow = createOrderWorkflows({
    ...unusedDependencies,
    transaction: async (operation) => operation(context),
  });
  await assert.rejects(
    workflow.verifyPayment('ML-TEST', '11111111-1111-4111-8111-111111111111', 'http://localhost:3000', {
      reference: 'OLD', transferredAt: '2026-11-14T00:00:00.000Z',
    }),
    (error: unknown) => error instanceof AppError && error.status === 409,
  );
});

test('payment confirmation rejects when the verifier role is no longer active at the payment update', async () => {
  const calls: string[] = [];
  const context = {
    orders: {
      async lockOrder() {
        calls.push('lock-order');
        return { id: 'order', orderStatus: 'PENDING_PAYMENT', paymentStatus: 'UNPAID', grandTotal: 100000 };
      },
      async latestPayment() { return { id: 'payment', verificationStatus: 'PENDING', amount: 100000 }; },
      async verifyPayment() { calls.push('verify-with-current-role'); return null; },
      async recordDecision() { calls.push('audit'); },
    },
  } as unknown as OrderTransactionContext;
  const workflow = createOrderWorkflows({
    ...unusedDependencies,
    transaction: async (operation) => operation(context),
  });

  await assert.rejects(
    workflow.verifyPayment('ML-TEST', '11111111-1111-4111-8111-111111111111'),
    (error: unknown) => error instanceof AppError && error.status === 403,
  );
  assert.deepEqual(calls, ['lock-order', 'verify-with-current-role']);
});

test('already verified payment still requires an active verifier role', async () => {
  const context = {
    orders: {
      async lockOrder() { return { id: 'order' }; },
      async latestPayment() { return { id: 'payment', verificationStatus: 'VERIFIED' }; },
      async isPaymentVerifier() { return false; },
    },
  } as unknown as OrderTransactionContext;
  const workflow = createOrderWorkflows({ ...unusedDependencies, transaction: async (operation) => operation(context) });

  await assert.rejects(
    workflow.verifyPayment('ML-TEST', '11111111-1111-4111-8111-111111111111'),
    (error: unknown) => error instanceof AppError && error.status === 403,
  );
});

test('payment declaration blocks public receipt URLs before authorization or database work', async () => {
  let authorizationChecked = false;
  let transactionOpened = false;
  const workflow = createOrderWorkflows({
    ...unusedDependencies,
    read: {
      ...unusedDependencies.read,
      async hasTrackingAccess() {
        authorizationChecked = true;
        return true;
      },
    },
    transaction: async () => {
      transactionOpened = true;
      throw new Error('Unexpected payment transaction');
    },
  });

  await assert.rejects(workflow.declarePayment({
    orderNumber: 'ML-2026-TEST',
    transactionReference: 'TX-123',
    bankName: 'Ngân hàng kiểm thử',
    senderAccountName: 'Khách kiểm thử',
    paymentProofUrl: 'https://res.cloudinary.com/example/image/upload/proof.jpg',
  }), (error: unknown) => error instanceof AppError && error.status === 409);

  assert.equal(authorizationChecked, false);
  assert.equal(transactionOpened, false);
});

test('text-only payment declaration still records the transfer without public media', async () => {
  const now = '2026-11-12T00:00:00.000Z';
  const order: Order = {
    id: '11111111-1111-4111-8111-111111111111', orderNumber: 'ML-2026-TEST',
    customerNameSnapshot: 'Khách kiểm thử', customerEmailSnapshot: 'customer@example.test',
    customerPhoneSnapshot: '0901234567', shippingRecipientName: 'Khách kiểm thử',
    shippingRecipientPhone: '0901234567', shippingAddressLine: 'Địa chỉ kiểm thử',
    shippingProvinceName: 'Việt Nam', orderStatus: 'PENDING_PAYMENT', paymentStatus: 'UNPAID',
    paymentTiming: 'PREPAID', currency: 'VND', subtotal: 100000, shippingFee: 0,
    grandTotal: 100000, requiredDepositAmount: 0, placedAt: now, createdAt: now, updatedAt: now,
  };
  const payment: Payment = {
    id: '22222222-2222-4222-8222-222222222222', orderId: order.id, paymentNumber: 'PAY-TEST',
    paymentMethod: 'VIETQR', paymentPurpose: 'FULL_PAYMENT', amount: 100000, currency: 'VND',
    verificationStatus: 'PENDING', createdAt: now,
  };
  const events: string[] = [];
  const orders = {
    ...Object.fromEntries(['lockOrder', 'latestPayment', 'declarePayment', 'recordDecision'].map((name) => [name, unexpectedOperation])),
    async lockOrder() { return order; },
    async latestPayment() { return payment; },
    async declarePayment() { events.push('declare'); return payment; },
    async orderItems() { return []; },
    async recordDecision() { events.push('audit'); },
  };
  const notifications = {
    ...Object.fromEntries(['storeOrderCreated', 'storePaymentVerified', 'paymentVerified'].map((name) => [name, unexpectedOperation])),
    async storePaymentDeclared() { events.push('outbox'); },
    async paymentDeclared(payload: { paymentProofUrl?: string }) {
      assert.equal(payload.paymentProofUrl, undefined);
      events.push('notification');
    },
  };
  const context = { orders, notifications } as unknown as OrderTransactionContext;
  const workflow = createOrderWorkflows({
    ...unusedDependencies,
    read: {
      ...unusedDependencies.read,
      async hasTrackingAccess() { return true; },
      async getOrderDetail() { return { order, items: [], payment, attachments: [] }; },
    },
    transaction: async (operation) => operation(context),
  });

  const result = await workflow.declarePayment({
    orderNumber: order.orderNumber,
    transactionReference: 'TX-123',
    bankName: 'Ngân hàng kiểm thử',
    senderAccountName: 'Khách kiểm thử',
    trackingToken: 'tracking-token',
  });

  assert.equal(result.payment.id, payment.id);
  assert.deepEqual(events, ['declare', 'audit', 'outbox', 'notification']);
});

test('payment rejection keeps the unpaid order open, records its reason and is idempotent', async () => {
  const order = {id: 'order', orderStatus: 'PENDING_PAYMENT', paymentStatus: 'UNPAID'};
  const payment = {id: 'payment', verificationStatus: 'PENDING', transactionReference: 'DECL', transferredAt: '2026-11-17T15:00:00.000Z', rejectionReason: undefined as string | undefined};
  let audits = 0, updates = 0;
  const context = {orders: {async lockOrder() {return order;}, async latestPayment() {return payment;},
    async rejectPayment(_id: string, _actor: string, reason: string) {updates++; payment.verificationStatus = 'REJECTED'; payment.rejectionReason = reason; return payment;},
    async recordDecision() {audits++;}, async isPaymentVerifier() {return true;}}} as unknown as OrderTransactionContext;
  const workflow = createOrderWorkflows({...unusedDependencies, transaction: async op => op(context)});
  const declaration = {reference: 'DECL', transferredAt: payment.transferredAt};
  assert.equal((await workflow.rejectPayment('ML-TEST', '11111111-1111-4111-8111-111111111111', 'Chuyển thiếu', declaration)).alreadyRejected, false);
  assert.equal((await workflow.rejectPayment('ML-TEST', '11111111-1111-4111-8111-111111111111', 'Chuyển thiếu', declaration)).alreadyRejected, true);
  assert.equal(order.orderStatus, 'PENDING_PAYMENT'); assert.equal(order.paymentStatus, 'UNPAID');
  assert.equal(updates, 1); assert.equal(audits, 1);
});

test('stale Telegram rejection cannot change a newer payment declaration', async () => {
  const context = {orders: {async lockOrder() {return {id: 'order'};},
    async latestPayment() {return {transactionReference: 'NEW', transferredAt: '2026-11-17T15:01:00.000Z'};}}} as unknown as OrderTransactionContext;
  const workflow = createOrderWorkflows({...unusedDependencies, transaction: async op => op(context)});
  await assert.rejects(workflow.rejectPayment('ML-TEST', '11111111-1111-4111-8111-111111111111', 'Chuyển thiếu',
    {reference: 'OLD', transferredAt: '2026-11-17T15:00:00.000Z'}), (e: unknown) => e instanceof AppError && e.status === 409);
});

test('payment rejection stops without an audit when the current verifier role is revoked', async () => {
  const context = {orders: {async lockOrder() {return {id: 'order', orderStatus: 'PENDING_PAYMENT', paymentStatus: 'UNPAID'};},
    async latestPayment() {return {id: 'payment', verificationStatus: 'PENDING'};},
    async rejectPayment() {return null;}, async recordDecision() {throw new Error('Must not audit rejection');}}} as unknown as OrderTransactionContext;
  const workflow = createOrderWorkflows({...unusedDependencies, transaction: async op => op(context)});
  await assert.rejects(workflow.rejectPayment('ML-TEST', '11111111-1111-4111-8111-111111111111'), (e: unknown) => e instanceof AppError && e.status === 403);
});

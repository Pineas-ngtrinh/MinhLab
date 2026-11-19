import assert from 'node:assert/strict';
import test from 'node:test';
import {
  enqueueTelegramNotification,
  paymentDeclarationDedupKey,
  telegramOrderCreatedMessage,
  telegramPaymentDeclaredMessage,
  telegramPaymentVerifiedMessage,
  telegramProductionPlanDraftMessage,
} from '../../integrations/notifications/telegram-outbox';
import type { PoolClient } from 'pg';
import { orderNotifications } from '../../integrations/notifications/order-notifications';

test('store payment alert includes the customer, products and bank-reconciliation warning', () => {
  const messages = [
    telegramOrderCreatedMessage({ orderNumber: 'ML-ORDER-123', grandTotal: 399000, paymentMethod: 'VIETQR' }),
    telegramPaymentDeclaredMessage({
      orderNumber: 'ML-ORDER-123', amount: 399000,
      customer: {
        name: 'Nguyễn Minh Khánh', email: 'customer@example.test', phone: '+84901234567',
        recipientName: 'Nguyễn Minh Khánh', recipientPhone: '+84901234567',
        address: '15 Khu phố Bình Hòa', province: 'Việt Nam',
      },
      items: [{ name: 'Robot Voxel', quantity: 2, unitPrice: 199500, lineTotal: 399000 }],
    }),
    telegramPaymentVerifiedMessage({ orderNumber: 'ML-ORDER-123', amount: 399000 }),
  ].join('\n');
  assert.match(messages, /399\.000 ₫/);
  assert.match(messages, /QR cá nhân/);
  assert.match(messages, /Chưa xác nhận tiền đã vào/);
  assert.match(messages, /customer@example\.test/);
  assert.match(messages, /\+84901234567/);
  assert.match(messages, /15 Khu phố Bình Hòa/);
  assert.match(messages, /Robot Voxel × 2/);
});

test('payment declaration dedup keys are unique per declaration and hide the bank reference', () => {
  const key = paymentDeclarationDedupKey('ML-ORDER-123', ' BANK-REF-456 ', 'attempt-1');
  assert.match(key, /^payment-declared:ML-ORDER-123:[a-f0-9]{64}$/);
  assert.equal(key, paymentDeclarationDedupKey('ML-ORDER-123', 'bank-ref-456', 'attempt-1'));
  assert.notEqual(key, paymentDeclarationDedupKey('ML-ORDER-123', 'bank-ref-456', 'attempt-2'));
  assert.doesNotMatch(key, /BANK-REF-456/i);
});

test('production plan Telegram alert gives the operator next step without exposing production secrets', () => {
  const message = telegramProductionPlanDraftMessage({
    status: 'WAITING_DATA', orderCount: 3, batchCount: 1, blockerCount: 2,
  });
  assert.match(message, /Đơn liên quan: 3 · Mẻ in: 1/);
  assert.match(message, /chờ bổ sung dữ liệu/);
  assert.match(message, /Chưa có lệnh in nào được phát hành/);
  assert.doesNotMatch(message, /\.stl|@|\+84|địa chỉ|email|giá:/i);
});

test('Telegram outbox insertion is parameterized and idempotent', async () => {
  let statement = '';
  let values: unknown[] = [];
  const client = {
    async query(sql: string, parameters: unknown[]) {
      statement = sql;
      values = parameters;
      return { rowCount: 1, rows: [] };
    },
  } as unknown as PoolClient;
  await enqueueTelegramNotification(client, {
    dedupKey: 'order-created:ML-ORDER-123',
    type: 'STORE_ORDER_CREATED',
    orderNumber: 'ML-ORDER-123',
    body: 'Đơn mới ML-ORDER-123',
  });
  assert.match(statement, /ON CONFLICT \(dedup_key\) DO NOTHING/);
  assert.match(statement, /VALUES \(\$1, \$2, \$3, \$4, \$5\)/);
  assert.deepEqual(values, ['order-created:ML-ORDER-123', 'STORE_ORDER_CREATED', 'ML-ORDER-123', null, 'Đơn mới ML-ORDER-123']);
});

test('production plan alerts target the plan and deduplicate by revision', async () => {
  let values: unknown[] = [];
  const client = {
    async query(_sql: string, parameters: unknown[]) { values = parameters; return { rowCount: 1, rows: [] }; },
  } as unknown as PoolClient;
  const input = {
    dedupKey: 'production-plan-drafted:plan-1:1',
    type: 'PRODUCTION_PLAN_DRAFTED' as const,
    productionPlanId: 'plan-1',
    body: 'Agent đề xuất bản nháp',
  };
  await enqueueTelegramNotification(client, input);
  assert.deepEqual(values, [input.dedupKey, input.type, null, input.productionPlanId, input.body]);
});

test('order integration persists one order alert and one declaration alert without adding a verification alert', async () => {
  const calls: unknown[][] = [];
  const client = {async query(_sql: string, values: unknown[]) {calls.push(values); return {rows: [], rowCount: 1};}} as unknown as PoolClient;
  const notifications = orderNotifications(client);
  await notifications.storeOrderCreated({orderNumber: 'ML-NEW', grandTotal: 100000, paymentMethod: 'VIETQR'});
  await notifications.storePaymentDeclared({orderNumber: 'ML-NEW', amount: 100000, declarationId: 'declaration-1',
    customer: {name: 'Fixture', email: 'fixture@example.test', phone: '', recipientName: 'Fixture', recipientPhone: '', address: '', province: ''}, items: []});
  await notifications.storePaymentVerified({orderNumber: 'ML-NEW', amount: 100000});
  assert.deepEqual(calls.map(v => v[1]), ['STORE_ORDER_CREATED', 'STORE_PAYMENT_DECLARED']);
  assert.equal(calls[0][0], 'order-created:ML-NEW');
});

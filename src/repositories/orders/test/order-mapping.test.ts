import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toOrder, type OrderRow } from '../order-mapping';
import { presentOrder } from '../../../services/orders/order-presenter';

test('DB rows normalize numeric/date fields and never spread private columns into the public contract', () => {
  const row: OrderRow & { checkout_request_hash: string; internal_note: string } = {
    id: 'fixture-id', order_number: 'ML-FIXTURE', customer_id: null,
    customer_name_snapshot: 'Fixture customer', customer_email_snapshot: 'fixture@example.test', customer_phone_snapshot: '0900000000',
    shipping_recipient_name: 'Fixture customer', shipping_recipient_phone: '0900000000',
    shipping_address_line: 'Fixture address', shipping_province_name: 'Việt Nam',
    order_status: 'CONFIRMED', payment_status: 'UNPAID', payment_timing: 'COD', currency: 'VND',
    subtotal: '100000', shipping_fee: '30000', grand_total: '130000', required_deposit_amount: '0', customer_note: null,
    placed_at: new Date('2026-01-01T00:00:00Z'), created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
    checkout_request_hash: 'must-stay-private', internal_note: 'must-stay-private',
  };
  const domain = toOrder(row);
  assert.equal(domain.grandTotal, 130000);
  assert.equal(domain.placedAt, '2026-01-01T00:00:00.000Z');
  const dto = presentOrder(domain);
  assert.equal(dto.order_number, 'ML-FIXTURE');
  assert.equal(dto.grand_total, 130000);
  assert.equal(dto.customer_id, undefined);
  for (const value of [domain, dto]) {
    assert.equal('internal_note' in value, false);
    assert.equal('checkout_request_hash' in value, false);
  }
  assert.equal('grandTotal' in dto, false);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateCheckoutContact, type CheckoutContactValues } from '../checkout-validation';

const valid: CheckoutContactValues = {
  fullName: 'Nguyễn Văn An', email: 'an@example.test', phone: '0901 234 567', address: '12 Đường A, TP. Hồ Chí Minh',
};

test('an empty checkout reports every missing required field in Vietnamese', () => {
  const errors = validateCheckoutContact({ fullName: '', email: '', phone: '', address: '' });
  assert.deepEqual(Object.keys(errors), ['fullName', 'email', 'phone', 'address']);
  assert.match(errors.fullName!, /nhập họ tên người nhận/);
  assert.match(errors.email!, /nhập email/);
  assert.match(errors.phone!, /nhập số điện thoại/);
  assert.match(errors.address!, /nhập địa chỉ/);
});

test('whitespace cannot satisfy a required contact field', () => {
  const errors = validateCheckoutContact({ fullName: '  ', email: '\t', phone: '  ', address: '\n' });
  assert.equal(Object.keys(errors).length, 4);
});

test('only missing fields are reported when the rest of the checkout is complete', () => {
  assert.deepEqual(Object.keys(validateCheckoutContact({ ...valid, phone: '', address: '' })), ['phone', 'address']);
});

test('malformed email and phone receive useful format guidance', () => {
  const errors = validateCheckoutContact({ ...valid, email: 'email-sai', phone: 'không có số' });
  assert.deepEqual(Object.keys(errors), ['email', 'phone']);
  assert.match(errors.email!, /Ví dụ: ten@example.com/);
  assert.match(errors.phone!, /Ví dụ: 0901 234 567/);
});

test('valid local and international contact values can be submitted with surrounding whitespace', () => {
  assert.deepEqual(validateCheckoutContact(valid), {});
  assert.deepEqual(validateCheckoutContact({ ...valid, fullName: ' An ', email: ' an@example.test ', phone: ' +84 901 234 567 ', address: ' 12 Đường A ' }), {});
});

test('correcting one field removes its error without hiding other missing information', () => {
  const before = { ...valid, email: 'an@', address: '' };
  assert.deepEqual(Object.keys(validateCheckoutContact(before)), ['email', 'address']);
  assert.deepEqual(Object.keys(validateCheckoutContact({ ...before, email: valid.email })), ['address']);
  assert.deepEqual(validateCheckoutContact({ ...before, email: valid.email, address: valid.address }), {});
});

import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { checkoutRequestKey, completeCheckoutRequest } from '../checkout-request';

const original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
let storage: Map<string, string>;

beforeEach(() => {
  storage = new Map();
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  } });
});

afterEach(() => {
  if (original) Object.defineProperty(globalThis, 'sessionStorage', original);
  else Reflect.deleteProperty(globalThis, 'sessionStorage');
});

test('retry retains its key across calls without persisting personal information', async () => {
  const payload = JSON.stringify({ customerName: 'Người mua thử', customerEmail: 'private@example.test' });
  const key = await checkoutRequestKey(payload);
  assert.equal(await checkoutRequestKey(payload), key);
  const stored = [...storage.values()].join('');
  assert(!stored.includes('private@example.test'));
  assert(!stored.includes('Người mua thử'));
});

test('changing the request rotates the key; an old response cannot clear a newer attempt', async () => {
  const first = await checkoutRequestKey('first cart');
  const second = await checkoutRequestKey('changed cart');
  assert.notEqual(first, second);
  completeCheckoutRequest(first);
  assert.equal(await checkoutRequestKey('changed cart'), second);
  completeCheckoutRequest(second);
  assert.notEqual(await checkoutRequestKey('changed cart'), second);
});

test('blocked or corrupt browser storage does not stop checkout', async () => {
  storage.set('minhlab_pending_checkout', '{broken');
  assert.match(await checkoutRequestKey('cart'), /^[a-f0-9-]{36}$/);
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, get() { throw new Error('Storage blocked'); } });
  assert.match(await checkoutRequestKey('cart'), /^[a-f0-9-]{36}$/);
  assert.doesNotThrow(() => completeCheckoutRequest('ignored'));
});

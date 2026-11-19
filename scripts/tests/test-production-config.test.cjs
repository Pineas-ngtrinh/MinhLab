const assert = require('node:assert/strict');
const test = require('node:test');
const { configurationChecks, checkoutPaymentReadiness, checkoutReadinessCheck } = require('../checks/check-production.cjs');

const destination = {
  MINHLAB_MANUAL_VIETQR_ENABLED: 'true',
  MINHLAB_VIETQR_BANK_BIN: '123456',
  MINHLAB_VIETQR_BANK_NAME: 'Configured bank',
  MINHLAB_VIETQR_ACCOUNT_NUMBER: '1234567890',
  MINHLAB_VIETQR_ACCOUNT_NAME: 'CONFIGURED RECEIVER',
};
const paymentReady = (environment) => configurationChecks(environment)
  .find((check) => check.name === 'manual VietQR configuration').passed;

test('private cleanup requires a separate durable journal when intake is enabled', () => {
  const ready = environment => configurationChecks(environment).find(item => item.name === 'private file cleanup journal').passed;
  assert.equal(ready({}), true);
  assert.equal(ready({ MINHLAB_PRIVATE_FILES_ENABLED: 'true' }), false);
  const base = { MINHLAB_PRIVATE_FILES_ENABLED: 'true', MINHLAB_PRIVATE_FILES_ROOT: '/private/fixture-models' };
  assert.equal(ready({ ...base, MINHLAB_PRIVATE_PURGE_JOURNAL_ROOT: '/private/fixture-models/journal' }), false);
  assert.equal(ready({ ...base, MINHLAB_PRIVATE_PURGE_JOURNAL_ROOT: '/private/fixture-journal' }), true);
});

test('preflight detects missing image storage and enabled but incomplete private storage', () => {
  const check = (env, name) => configurationChecks(env).find(item => item.name === name).passed;
  assert.equal(check({}, 'catalogue image uploads'), false);
  assert.equal(check({ CLOUDINARY_CLOUD_NAME: 'fixture', CLOUDINARY_API_KEY: 'fixture', CLOUDINARY_API_SECRET: 'isolated-fixture-secret' }, 'catalogue image uploads'), true);
  assert.equal(check({ CLOUDINARY_CLOUD_NAME: 'fixture', CLOUDINARY_API_KEY: 'fixture', CLOUDINARY_API_SECRET: 'short' }, 'catalogue image uploads'), false);
  assert.equal(check({}, 'private file intake configuration'), true);
  assert.equal(check({ MINHLAB_PRIVATE_FILES_ENABLED: 'true' }, 'private file intake configuration'), false);
});

test('production readiness requires the only supported checkout payment method to be enabled', () => {
  assert.equal(paymentReady(destination), true);
  assert.equal(paymentReady({ ...destination, MINHLAB_MANUAL_VIETQR_ENABLED: 'false' }), false);
  assert.equal(paymentReady({}), false);
});

test('production payment readiness uses the same destination rules as checkout', () => {
  for (const [key, value] of [
    ['MINHLAB_VIETQR_BANK_BIN', '123'],
    ['MINHLAB_VIETQR_BANK_NAME', ' '],
    ['MINHLAB_VIETQR_ACCOUNT_NUMBER', '123/invalid'],
    ['MINHLAB_VIETQR_ACCOUNT_NAME', 'x'.repeat(121)],
  ]) {
    assert.equal(paymentReady({ ...destination, [key]: value }), false, key);
  }
  assert.equal(paymentReady({
    ...destination,
    MINHLAB_VIETQR_ACCOUNT_NAME: ' CONFIGURED RECEIVER ',
  }), true);
});

test('blank mail credentials do not pass configuration readiness', () => {
  const check = configurationChecks({ RESEND_API_KEY: ' ', EMAIL_FROM: ' ' })
    .find((value) => value.name === 'mail credentials');
  assert.equal(check.passed, false);
});

test('payment readiness distinguishes disabled checkout, missing destination, invalid destination and ready', () => {
  assert.equal(checkoutPaymentReadiness({}).state, 'DISABLED');
  assert.equal(checkoutPaymentReadiness({ ...destination, MINHLAB_MANUAL_VIETQR_ENABLED: 'false' }).state, 'DISABLED');
  const missing = checkoutPaymentReadiness({ MINHLAB_MANUAL_VIETQR_ENABLED: 'true' });
  assert.equal(missing.state, 'MISSING_DESTINATION');
  assert.equal(missing.passed, false);
  assert.equal(missing.missingFields.length, 4);
  assert.equal(checkoutPaymentReadiness({ ...destination, MINHLAB_VIETQR_BANK_BIN: 'bad' }).state, 'INVALID_DESTINATION');
  assert.equal(checkoutPaymentReadiness(destination).state, 'READY');
});

test('every missing receiving field is reported without exposing its values', () => {
  for (const key of Object.keys(destination).filter((key) => key !== 'MINHLAB_MANUAL_VIETQR_ENABLED')) {
    const environment = { ...destination, [key]: ' ' };
    const result = checkoutPaymentReadiness(environment);
    assert.equal(result.state, 'MISSING_DESTINATION');
    assert.deepEqual(result.missingFields, [key]);
    assert(result.detail.includes(key));
    assert(!result.detail.includes(destination.MINHLAB_VIETQR_ACCOUNT_NUMBER));
    assert(!result.detail.includes(destination.MINHLAB_VIETQR_ACCOUNT_NAME));
    assert.equal(environment[key], ' ');
  }
});

test('invalid destination is not operational even when all fields are present', () => {
  const result = checkoutPaymentReadiness({ ...destination, MINHLAB_VIETQR_ACCOUNT_NUMBER: 'private-invalid/value' });
  assert.equal(result.state, 'INVALID_DESTINATION');
  assert.equal(result.passed, false);
  assert(!result.detail.includes('private-invalid/value'));
  const disabled = checkoutPaymentReadiness({ ...destination, MINHLAB_MANUAL_VIETQR_ENABLED: 'false' });
  assert.equal(disabled.passed, false);
});

const checkoutPrerequisites = [
  'manual VietQR configuration', 'public HTTPS URL', 'migrations',
  'runtime database role', 'runtime database permissions', 'sellable catalogue',
].map((name) => ({ name, passed: true }));

test('valid payment alone cannot report operational checkout readiness', () => {
  assert.equal(checkoutReadinessCheck([{ name: 'manual VietQR configuration', passed: true }]).passed, false);
  assert.equal(checkoutReadinessCheck(checkoutPrerequisites).passed, true);
  for (const prerequisite of checkoutPrerequisites) {
    const checks = checkoutPrerequisites.map((check) => ({ ...check, passed: check.name !== prerequisite.name }));
    const result = checkoutReadinessCheck(checks);
    assert.equal(result.passed, false, prerequisite.name);
    assert(result.detail.includes(prerequisite.name));
  }
});

test('database failures and incomplete checks keep operational readiness closed', () => {
  const incomplete = checkoutPrerequisites.filter((check) => check.name !== 'migrations');
  assert.equal(checkoutReadinessCheck(incomplete).passed, false);
  const failedDatabase = configurationChecks(destination).concat({ name: 'database readiness', passed: false });
  assert.equal(checkoutReadinessCheck(failedDatabase).passed, false);
  assert.match(checkoutReadinessCheck(checkoutPrerequisites).detail, /chưa.*(tạo đơn|giao dịch)/i);
});

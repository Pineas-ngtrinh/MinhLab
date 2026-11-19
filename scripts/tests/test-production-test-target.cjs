const assert = require('node:assert/strict');
const test = require('node:test');
const { resolveProductionTestTarget } = require('../lib/production-test-target.cjs');

const base = {
  DATABASE_URL: 'postgres://production-user:never-read@127.0.0.1:5432/production',
  TEST_DATABASE_URL: 'postgres://migration:fixture@127.0.0.1:5432/postgres',
  TEST_RUNTIME_DATABASE_URL: 'postgres://minhlab_app:fixture@127.0.0.1:5432/postgres',
};

test('a loopback URL alone does not authorize database creation and deletion', () => {
  assert.throws(() => resolveProductionTestTarget(base), /xác minh độc lập/);
});

test('production tests require explicit test URLs and never fall back to DATABASE_URL', () => {
  assert.throws(() => resolveProductionTestTarget({
    ...base,
    MINHLAB_TEST_DATABASE_DISPOSABLE: 'true',
    TEST_DATABASE_URL: undefined,
  }), /TEST_DATABASE_URL phải được khai báo tường minh/);
  assert.throws(() => resolveProductionTestTarget({
    ...base,
    MINHLAB_TEST_DATABASE_DISPOSABLE: 'true',
    TEST_RUNTIME_DATABASE_URL: undefined,
  }), /TEST_RUNTIME_DATABASE_URL phải được khai báo tường minh/);
});

test('test endpoints must be loopback and point to the same endpoint', () => {
  assert.throws(() => resolveProductionTestTarget({
    ...base,
    MINHLAB_TEST_DATABASE_DISPOSABLE: 'true',
    TEST_DATABASE_URL: 'postgres://migration:fixture@db.example.test:5432/postgres',
  }), /loopback/);
  assert.throws(() => resolveProductionTestTarget({
    ...base,
    MINHLAB_TEST_DATABASE_DISPOSABLE: 'true',
    TEST_RUNTIME_DATABASE_URL: 'postgres://minhlab_app:fixture@127.0.0.1:5433/postgres',
  }), /cùng endpoint/);
  assert.throws(() => resolveProductionTestTarget({
    ...base,
    MINHLAB_TEST_DATABASE_DISPOSABLE: 'true',
    TEST_RUNTIME_DATABASE_URL: 'postgres://postgres:fixture@127.0.0.1:5432/postgres',
  }), /role runtime minhlab_app/);
});

test('only explicit test connection URLs are returned even when DATABASE_URL differs', () => {
  const target = resolveProductionTestTarget({
    ...base,
    MINHLAB_TEST_DATABASE_DISPOSABLE: 'true',
  });
  assert.equal(target.sourceUrl.username, 'migration');
  assert.equal(target.sourceUrl.pathname, '/postgres');
  assert.equal(target.appUrl.username, 'minhlab_app');
  assert.equal(target.appUrl.pathname, '/postgres');
});

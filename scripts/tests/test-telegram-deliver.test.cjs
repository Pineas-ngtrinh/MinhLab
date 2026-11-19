const assert = require('node:assert/strict');
const test = require('node:test');
const { telegramCredentials, sendTelegramMessage, claimNext, deliverTelegramBatch, paymentApprovalKeyboard, targetOrderNumberFromArgs } = require('../workers/telegram-deliver.cjs');
const { Pool } = require('pg');
const { randomUUID } = require('node:crypto');

function failClaimQuery(sql) {
  if (/\bFOR\s+UPDATE\s+SKIP\s+LOCKED\b/i.test(sql)) throw new Error('SIMULATED_CLAIM_FAILURE');
}

test('claim failure injection still reaches rollback when the SELECT projection changes', async () => {
  const statements = [];
  const pool = {
    async connect() {
      return {
        async query(sql) {
          statements.push(sql);
          failClaimQuery(sql);
          return { rowCount: 1, rows: [] };
        },
        release() { statements.push('RELEASE'); },
      };
    },
  };
  await assert.rejects(() => claimNext(pool), /SIMULATED_CLAIM_FAILURE/);
  assert(statements.some(sql => /\bSELECT\b/i.test(sql) && /\bSKIP\s+LOCKED\b/i.test(sql)));
  assert.deepEqual(statements.slice(-2), ['ROLLBACK', 'RELEASE']);
  assert(!statements.includes('COMMIT'));
});

test('Telegram worker requires server-side bot and destination settings', () => {
  assert.throws(() => telegramCredentials({}), /TELEGRAM_BOT_TOKEN.*TELEGRAM_CHAT_ID/);
  assert.deepEqual(telegramCredentials({ TELEGRAM_BOT_TOKEN: 'bot-secret', TELEGRAM_CHAT_ID: '-100123' }), {
    token: 'bot-secret',
    chatId: '-100123',
  });
});

test('Telegram delivery sends plain text and returns the provider message id', async () => {
  let request;
  const messageId = await sendTelegramMessage(
    { token: 'private-token', chatId: '-100123', text: 'Đơn mới ML-123' },
    async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({ ok: true, result: { message_id: 91 } }) };
    },
  );
  assert.equal(messageId, '91');
  assert.equal(request.url, 'https://api.telegram.org/botprivate-token/sendMessage');
  assert.deepEqual(JSON.parse(request.options.body), {
    chat_id: '-100123',
    text: 'Đơn mới ML-123',
    disable_web_page_preview: true,
  });
  assert.equal(JSON.parse(request.options.body).parse_mode, undefined);
});

test('Telegram payment button is included only with a webhook secret', () => {
  const id = '11111111-1111-4111-8111-111111111111';
  const keyboard = paymentApprovalKeyboard(id, {
    TELEGRAM_WEBHOOK_SECRET: 'fixture-secret',
  });
  assert.equal(keyboard.inline_keyboard[0][0].text, 'Đã kiểm tra, xác nhận tiền về');
  assert.equal(keyboard.inline_keyboard[0][0].callback_data, `verify-payment:${id}`);
  assert(Buffer.byteLength(keyboard.inline_keyboard[0][0].callback_data) <= 64);
  assert.equal(paymentApprovalKeyboard(id, { TELEGRAM_WEBHOOK_SECRET: 'fixture-secret' }).inline_keyboard[0][0].callback_data, `verify-payment:${id}`);
  assert.equal(paymentApprovalKeyboard(id, {}), undefined);
});

test('Telegram test delivery can be limited to one valid order number', () => {
  assert.equal(targetOrderNumberFromArgs(['--order-number=ML-2026-0042']), 'ML-2026-0042');
  assert.equal(targetOrderNumberFromArgs([]), null);
  assert.throws(() => targetOrderNumberFromArgs(['--order-number=ML/0042']), /Mã đơn/);
});

test('Telegram payment delivery attaches its inline keyboard to sendMessage', async () => {
  let request;
  const replyMarkup = { inline_keyboard: [[{ text: 'Confirm', callback_data: 'verify-payment:fixture' }]] };
  await sendTelegramMessage(
    { token: 'private-token', chatId: '-100123', text: 'Payment declared', replyMarkup },
    async (_url, options) => {
      request = JSON.parse(options.body);
      return { ok: true, json: async () => ({ ok: true, result: { message_id: 92 } }) };
    },
  );
  assert.deepEqual(request.reply_markup, replyMarkup);
});

test('Telegram 429 failures expose only a retry code and bounded retry delay', async () => {
  await assert.rejects(
    () => sendTelegramMessage(
      { token: 'private-token', chatId: '-100123', text: 'Alert' },
      async () => ({ ok: false, status: 429, json: async () => ({ ok: false, parameters: { retry_after: 19 } }) }),
    ),
    (error) => error.code === 'HTTP_429' && error.retryAfterSeconds === 19 && !error.message.includes('private-token'),
  );
});

test('Telegram network errors do not forward provider details or credentials', async () => {
  await assert.rejects(
    () => sendTelegramMessage(
      { token: 'private-token', chatId: '-100123', text: 'Alert' },
      async () => { throw new Error('failed URL contains private-token'); },
    ),
    (error) => error.code === 'NETWORK_ERROR' && !error.message.includes('private-token'),
  );
});

test('Telegram timeout, malformed responses and rejected messages use bounded error codes', async () => {
  const message = { token: 'private-token', chatId: '-100123', text: 'Alert' };
  for (const [fetchImpl, code] of [
    [async () => { const error = new Error('private detail'); error.name = 'TimeoutError'; throw error; }, 'NETWORK_TIMEOUT'],
    [async () => ({ ok: true, json: async () => { throw new Error('private body'); } }), 'API_INVALID_RESPONSE'],
    [async () => ({ ok: true, json: async () => ({ ok: false }) }), 'API_REJECTED'],
  ]) {
    await assert.rejects(() => sendTelegramMessage(message, fetchImpl), (error) => error.code === code && !error.message.includes('private'));
  }
});

test('Telegram recovery and delivery use connection-local fixtures only', {
  skip: !process.env.MINHLAB_TEST_DATABASE_URL,
}, async (t) => {
  const databaseUrl = new URL(process.env.MINHLAB_TEST_DATABASE_URL);
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(databaseUrl.hostname), 'Chỉ chạy fixture Telegram trên PostgreSQL local.');
  const pool = new Pool({ connectionString: databaseUrl.toString(), connectionTimeoutMillis: 5000, statement_timeout: 5000 });
  let client;
  try {
    client = await pool.connect();
    // All worker writes resolve to this connection-local table; application outbox rows stay untouched.
    await client.query('CREATE TEMP TABLE telegram_outbox (LIKE public.telegram_outbox INCLUDING ALL)');
    const connectionPool = {
      query: client.query.bind(client),
      async connect() {
        return { query: client.query.bind(client), release() {} };
      },
    };
    const credentials = { token: 'fixture-only-token', chatId: 'fixture-only-chat' };
    const accepted = async () => ({ ok: true, json: async () => ({ ok: true, result: { message_id: 91 } }) });
    async function reset() { await client.query('TRUNCATE pg_temp.telegram_outbox'); }
    async function seed(key, { status = 'PENDING', attempts = 0, expired = false, type = 'STORE_PAYMENT_DECLARED' } = {}) {
      const result = await client.query(`INSERT INTO pg_temp.telegram_outbox
        (dedup_key, notification_type, order_number, body_text, status, attempts, lease_token, lease_until)
        VALUES ($1, $6, 'ML-TEST', 'Fixture message', $2, $3, $4, $5) RETURNING *`,
      [key, status, attempts, status === 'PROCESSING' ? randomUUID() : null,
        status === 'PROCESSING' ? new Date(Date.now() + (expired ? -60000 : 60000)) : null, type]);
      return result.rows[0];
    }
    async function row(id) { return (await client.query('SELECT * FROM pg_temp.telegram_outbox WHERE id=$1', [id])).rows[0]; }

    await t.test('only new-order and payment-declaration alerts are delivered', async () => {
      await reset();
      const order = await seed('order-alert', {type: 'STORE_ORDER_CREATED'});
      const payment = await seed('declaration-alert');
      const ignored = await seed('verified-alert', {type: 'STORE_PAYMENT_VERIFIED'});
      assert.deepEqual(await deliverTelegramBatch(connectionPool, credentials, accepted), {delivered: 2, failed: 0});
      assert.equal((await row(order.id)).status, 'SENT');
      assert.equal((await row(payment.id)).status, 'SENT');
      assert.equal((await row(ignored.id)).status, 'PENDING');
    });

    await t.test('expired final leases become FAILED without a sixth send and retain their identity', async () => {
      await reset();
      const original = await seed('expired-final', { status: 'PROCESSING', attempts: 5, expired: true });
      let sends = 0;
      await deliverTelegramBatch(connectionPool, credentials, async () => { sends += 1; return accepted(); }, 1);
      const failed = await row(original.id);
      assert.equal(sends, 0);
      assert.equal(failed.status, 'FAILED');
      assert.equal(failed.attempts, 5);
      assert.equal(failed.last_error, 'DELIVERY_LEASE_EXPIRED');
      assert.equal(failed.lease_token, null);
      assert.equal(failed.lease_until, null);
      assert.equal(failed.dedup_key, original.dedup_key);
      assert.equal(failed.body_text, original.body_text);
      assert.equal(failed.created_at.getTime(), original.created_at.getTime());
      assert.equal(await claimNext(connectionPool), null);
    });

    await t.test('active leases are not reclaimed or failed, including a final active attempt', async () => {
      await reset();
      const active = await seed('active', { status: 'PROCESSING', attempts: 2 });
      const final = await seed('active-final', { status: 'PROCESSING', attempts: 5 });
      assert.equal(await claimNext(connectionPool), null);
      assert.equal((await row(active.id)).lease_token, active.lease_token);
      assert.equal((await row(final.id)).status, 'PROCESSING');
      assert.equal((await row(final.id)).lease_token, final.lease_token);
    });

    await t.test('a crash after the last reclaim terminates when its lease expires', async () => {
      await reset();
      const original = await seed('expired-retry', { status: 'PROCESSING', attempts: 4, expired: true });
      const next = await claimNext(connectionPool);
      assert.equal(next.id, original.id);
      assert.equal(next.attempts, 5);
      assert.notEqual(next.lease_token, original.lease_token);
      await client.query("UPDATE pg_temp.telegram_outbox SET lease_until=now()-interval '1 second' WHERE id=$1", [original.id]);
      assert.equal(await claimNext(connectionPool), null);
      assert.equal((await row(original.id)).status, 'FAILED');
      assert.equal((await row(original.id)).attempts, 5);
    });

    await t.test('provider failures retry with backoff and stop after five attempts', async () => {
      await reset();
      const original = await seed('retry-limit');
      let sends = 0;
      const unavailable = async () => { sends += 1; throw new Error('fixture network outage'); };
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        const started = Date.now();
        assert.deepEqual(await deliverTelegramBatch(connectionPool, credentials, unavailable, 1), { delivered: 0, failed: 1 });
        const current = await row(original.id);
        assert.equal(current.attempts, attempt);
        assert.equal(current.status, attempt < 5 ? 'PENDING' : 'FAILED');
        assert.equal(current.lease_token, null);
        assert(current.retry_after.getTime() >= started + 29000);
        await client.query("UPDATE pg_temp.telegram_outbox SET retry_after=now()-interval '1 second' WHERE id=$1", [original.id]);
      }
      assert.deepEqual(await deliverTelegramBatch(connectionPool, credentials, unavailable, 1), { delivered: 0, failed: 0 });
      assert.equal(sends, 5);
    });

    await t.test('HTTP 429 respects retry_after and does not immediately reclaim pending work', async () => {
      await reset();
      const original = await seed('rate-limited');
      let sends = 0;
      const limited = async () => { sends += 1; return { ok: false, status: 429, json: async () => ({ parameters: { retry_after: 19 } }) }; };
      const started = Date.now();
      await deliverTelegramBatch(connectionPool, credentials, limited, 1);
      const current = await row(original.id);
      assert.equal(current.status, 'PENDING');
      assert.equal(current.last_error, 'HTTP_429');
      assert(current.retry_after.getTime() >= started + 18000);
      assert.equal(await claimNext(connectionPool), null);
      assert.equal(sends, 1);
    });

    await t.test('late provider acknowledgement cannot overwrite a new lease or count as committed delivery', async () => {
      await reset();
      const original = await seed('late-ack');
      let newLease;
      const delayed = async () => {
        await client.query("UPDATE pg_temp.telegram_outbox SET lease_until=now()-interval '1 second' WHERE id=$1", [original.id]);
        newLease = await claimNext(connectionPool);
        return accepted();
      };
      assert.deepEqual(await deliverTelegramBatch(connectionPool, credentials, delayed, 1), { delivered: 0, failed: 1 });
      const current = await row(original.id);
      assert.equal(current.status, 'PROCESSING');
      assert.equal(current.attempts, 2);
      assert.equal(current.lease_token, newLease.lease_token);
      assert.equal(current.provider_message_id, null);
    });

    await t.test('lost acknowledgements allow at-least-once replay without changing the message identity', async () => {
      await reset();
      const original = await seed('lost-ack');
      let sends = 0;
      const provider = async () => { sends += 1; return accepted(); };
      const disconnected = { ...connectionPool, async query() { throw new Error('SIMULATED_ACK_CONNECTION_LOSS'); } };
      await assert.rejects(() => deliverTelegramBatch(disconnected, credentials, provider, 1), /SIMULATED_ACK_CONNECTION_LOSS/);
      assert.equal((await row(original.id)).status, 'PROCESSING');
      await client.query("UPDATE pg_temp.telegram_outbox SET lease_until=now()-interval '1 second' WHERE id=$1", [original.id]);
      assert.deepEqual(await deliverTelegramBatch(connectionPool, credentials, provider, 1), { delivered: 1, failed: 0 });
      assert.equal(sends, 2);
      assert.equal((await row(original.id)).status, 'SENT');
      assert.equal((await row(original.id)).attempts, 2);
      assert.equal((await row(original.id)).dedup_key, original.dedup_key);
    });

    await t.test('recovery rolls back if the following claim fails', async () => {
      await reset();
      const original = await seed('rollback-recovery', { status: 'PROCESSING', attempts: 5, expired: true });
      const brokenPool = {
        async connect() {
          return {
            async query(sql, values) {
              failClaimQuery(sql);
              return client.query(sql, values);
            },
            release() {},
          };
        },
      };
      await assert.rejects(() => claimNext(brokenPool), /SIMULATED_CLAIM_FAILURE/);
      assert.equal((await row(original.id)).status, 'PROCESSING');
      assert.equal(await claimNext(connectionPool), null);
      assert.equal((await row(original.id)).status, 'FAILED');
    });
  } finally {
    client?.release();
    await pool.end();
  }
});

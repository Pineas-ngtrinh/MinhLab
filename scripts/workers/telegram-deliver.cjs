const { randomUUID } = require('node:crypto');
const { createPool } = require('../lib/database.cjs');
require('../lib/register-typescript.cjs');
const { telegramPaymentActions } = require('../../src/integrations/notifications/telegram-payment-actions.ts');

const MAX_ATTEMPTS = 5;
const LEASE_SECONDS = 60;
const RETRY_SECONDS = [30, 120, 600, 1800, 3600];

class TelegramDeliveryError extends Error {
  constructor(code, retryAfterSeconds) {
    super(code);
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function telegramCredentials(env = process.env) {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId || /\s/.test(token) || /\s/.test(chatId)) {
    throw new Error('Chưa cấu hình TELEGRAM_BOT_TOKEN và TELEGRAM_CHAT_ID; thông báo vẫn được giữ trong outbox.');
  }
  return { token, chatId };
}

async function sendTelegramMessage({ token, chatId, text, replyMarkup }, fetchImpl = fetch) {
  let response;
  try {
    const body = { chat_id: chatId, text, disable_web_page_preview: true };
    if (replyMarkup) body.reply_markup = replyMarkup;
    response = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new TelegramDeliveryError('NETWORK_TIMEOUT');
    }
    throw new TelegramDeliveryError('NETWORK_ERROR');
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new TelegramDeliveryError(response.ok ? 'API_INVALID_RESPONSE' : `HTTP_${response.status}`);
  }
  if (!response.ok) {
    const retryAfter = Number(payload?.parameters?.retry_after);
    throw new TelegramDeliveryError(`HTTP_${response.status}`, Number.isInteger(retryAfter) ? retryAfter : undefined);
  }
  if (payload?.ok !== true || !Number.isInteger(payload?.result?.message_id)) {
    throw new TelegramDeliveryError('API_REJECTED');
  }
  return String(payload.result.message_id);
}

async function claimNext(pool, orderNumber = null) {
  const client = await pool.connect();
  const leaseToken = randomUUID();
  try {
    await client.query('BEGIN');
    // A crash on the last attempt must not leave an unrecoverable processing lease.
    // Its provider outcome is unknown, so surface it for review without sending a sixth time.
    const recovered = await client.query(
      `UPDATE telegram_outbox
       SET status = 'FAILED', lease_token = NULL, lease_until = NULL,
           last_error = 'DELIVERY_LEASE_EXPIRED'
       WHERE status = 'PROCESSING' AND attempts >= $1 AND lease_until <= now()
       RETURNING id`,
      [MAX_ATTEMPTS],
    );
    const selected = await client.query(
      `SELECT id, notification_type, body_text, attempts
       FROM telegram_outbox
       WHERE notification_type IN ('STORE_ORDER_CREATED','STORE_PAYMENT_DECLARED') AND attempts < $1
         AND ($2::varchar IS NULL OR order_number = $2) AND (
         (status = 'PENDING' AND retry_after <= now()) OR
         (status = 'PROCESSING' AND lease_until <= now())
       )
       ORDER BY created_at
       FOR UPDATE SKIP LOCKED
       LIMIT 1`,
      [MAX_ATTEMPTS, orderNumber],
    );
    const notification = selected.rows[0];
    let claimed = null;
    if (notification) {
      const result = await client.query(
        `UPDATE telegram_outbox
         SET status = 'PROCESSING', attempts = attempts + 1,
             lease_token = $2, lease_until = now() + ($3 * interval '1 second'), last_error = NULL
         WHERE id = $1
         RETURNING id, notification_type, body_text, attempts, lease_token`,
        [notification.id, leaseToken, LEASE_SECONDS],
      );
      claimed = result.rows[0];
    }
    await client.query('COMMIT');
    if (recovered.rowCount > 0) {
      process.stderr.write(`Telegram: ${recovered.rowCount} thông báo chuyển FAILED do DELIVERY_LEASE_EXPIRED; cần đối soát trước khi gửi lại.\n`);
    }
    return claimed;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deliverTelegramBatch(pool, credentials, fetchImpl = fetch, batchSize = 20, orderNumber = null) {
  let delivered = 0;
  let failed = 0;
  for (let index = 0; index < batchSize; index += 1) {
    const notification = await claimNext(pool, orderNumber);
    if (!notification) break;
    try {
      const messageId = await sendTelegramMessage({
        ...credentials,
        text: notification.body_text,
        replyMarkup: notification.notification_type === 'STORE_PAYMENT_DECLARED'
          ? paymentApprovalKeyboard(notification.id)
          : undefined,
      }, fetchImpl);
      const acknowledgement = await pool.query(
        `UPDATE telegram_outbox
         SET status = 'SENT', sent_at = now(), provider_message_id = $3,
             lease_token = NULL, lease_until = NULL, last_error = NULL
         WHERE id = $1 AND lease_token = $2`,
        [notification.id, notification.lease_token, messageId],
      );
      if (acknowledgement.rowCount !== 1) {
        // A newer worker owns the message. Never ACK its lease or claim a committed delivery.
        failed += 1;
        process.stderr.write(`Telegram notification ${notification.id}: LEASE_OWNERSHIP_LOST\n`);
        continue;
      }
      delivered += 1;
      process.stdout.write(`Sent Telegram notification ${notification.id}\n`);
    } catch (error) {
      const attempt = Math.min(notification.attempts, MAX_ATTEMPTS) - 1;
      const fallbackDelay = RETRY_SECONDS[Math.max(attempt, 0)];
      const delay = Math.min(Math.max(error.retryAfterSeconds || fallbackDelay, 1), 3600);
      const nextStatus = notification.attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING';
      await pool.query(
        `UPDATE telegram_outbox
         SET status = $3, retry_after = now() + ($4 * interval '1 second'),
             lease_token = NULL, lease_until = NULL, last_error = $5
         WHERE id = $1 AND lease_token = $2`,
        [notification.id, notification.lease_token, nextStatus, delay, error.code || 'DELIVERY_ERROR'],
      );
      failed += 1;
      process.stderr.write(`Telegram notification ${notification.id}: ${error.code || 'DELIVERY_ERROR'}\n`);
    }
  }
  return { delivered, failed };
}

function paymentApprovalKeyboard(notificationId, env = process.env) {
  const webhookSecret = env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) return undefined;
  return telegramPaymentActions(notificationId);
}

function targetOrderNumberFromArgs(args = process.argv.slice(2)) {
  const argument = args.find((value) => value.startsWith('--order-number='));
  if (!argument) return null;
  const value = argument.slice('--order-number='.length).trim();
  if (!value || value.length > 40 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error('Mã đơn dùng để gửi Telegram thử không hợp lệ.');
  }
  return value;
}

async function main() {
  const credentials = telegramCredentials();
  const orderNumber = targetOrderNumberFromArgs();
  const pool = createPool();
  try {
    const result = await deliverTelegramBatch(pool, credentials, fetch, 20, orderNumber);
    if (result.failed > 0) process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { TelegramDeliveryError, telegramCredentials, sendTelegramMessage, claimNext, deliverTelegramBatch, paymentApprovalKeyboard, targetOrderNumberFromArgs };

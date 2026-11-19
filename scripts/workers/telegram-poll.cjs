require('../lib/database.cjs'); // Loads the project's .env.local for local workers.
require('../lib/register-typescript.cjs');

const { handleTelegramPaymentCallback } = require('../../src/server/telegram-payment-approval.ts');
const { parseTelegramPaymentCallback } = require('../../src/integrations/notifications/telegram-webhook.ts');

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function telegramApi(method, payload = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token || /\s/.test(token)) throw new Error('Thiếu TELEGRAM_BOT_TOKEN trong .env.local.');
  let response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      signal: AbortSignal.timeout(30000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('Không kết nối được Telegram Bot API.');
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.ok !== true) {
    if (response.status === 409) throw new Error('Bot đang dùng webhook; hãy xóa webhook trước khi chạy polling ở localhost.');
    throw new Error('Telegram Bot API từ chối long polling.');
  }
  return result.result;
}

function localSiteOrigin() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'http://localhost:3000';
  const url = new URL(configured);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('telegram:poll chỉ hoạt động với NEXT_PUBLIC_SITE_URL trỏ về localhost.');
  }
  return url.origin;
}

async function main() {
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!chatId) throw new Error('Thiếu TELEGRAM_CHAT_ID trong .env.local.');
  if (!process.env.TELEGRAM_WEBHOOK_SECRET?.trim()) {
    throw new Error('Cần cấu hình TELEGRAM_WEBHOOK_SECRET để bật nút xác nhận trong tin Telegram.');
  }
  const siteOrigin = localSiteOrigin();
  const webhook = await telegramApi('getWebhookInfo');
  if (webhook?.url) throw new Error('Bot đang nhận webhook. Chạy npm run telegram:webhook:delete trước khi dùng local polling.');

  process.stdout.write(`Đang chờ nút xác nhận Telegram cho ${siteOrigin}. Nhấn Ctrl+C để dừng.\n`);
  let offset;
  while (true) {
    try {
      const updates = await telegramApi('getUpdates', {
        ...(offset === undefined ? {} : { offset }),
        timeout: 20,
        allowed_updates: ['callback_query'],
      });
      for (const update of updates || []) {
        try {
          const callback = parseTelegramPaymentCallback(update);
          if (callback) await handleTelegramPaymentCallback(callback, siteOrigin);
          offset = update.update_id + 1;
        } catch {
          process.stderr.write('Không xử lý được callback Telegram; giữ lại update để thử lại.\n');
          break;
        }
      }
    } catch (error) {
      process.stderr.write(`${error.message}\n`);
      if (error.message.includes('webhook')) process.exitCode = 1;
      if (process.exitCode) break;
      await wait(1500);
    }
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

const path = require('node:path');
const { loadEnvConfig } = require('@next/env');

loadEnvConfig(path.resolve(__dirname, '..'));

async function telegramApi(method, payload = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token || /\s/.test(token)) throw new Error('Thiếu TELEGRAM_BOT_TOKEN.');
  let response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('Không kết nối được Telegram Bot API.');
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.ok !== true) throw new Error('Telegram Bot API từ chối yêu cầu cấu hình webhook.');
  return result.result;
}

async function main() {
  const action = process.argv[2];
  if (action === 'set') {
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
    if (!secret || secret.length > 256 || !/^[A-Za-z0-9_-]+$/.test(secret)) {
      throw new Error('TELEGRAM_WEBHOOK_SECRET cần 1–256 ký tự A–Z, a–z, 0–9, _ hoặc -.');
    }
    const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL?.trim()
      || new URL('/api/telegram/webhook', process.env.NEXT_PUBLIC_SITE_URL || '').toString();
    const url = new URL(webhookUrl);
    if (url.protocol !== 'https:') throw new Error('Webhook Telegram cần URL HTTPS công khai của VPS.');
    await telegramApi('setWebhook', {
      url: url.toString(),
      secret_token: secret,
      allowed_updates: ['callback_query', 'message'],
      drop_pending_updates: false,
    });
    process.stdout.write(`Đã cấu hình webhook Telegram: ${url.origin}${url.pathname}\n`);
    return;
  }
  if (action === 'delete') {
    await telegramApi('deleteWebhook', { drop_pending_updates: false });
    process.stdout.write('Đã gỡ webhook Telegram; có thể dùng polling ở localhost.\n');
    return;
  }
  if (action === 'info') {
    const result = await telegramApi('getWebhookInfo');
    process.stdout.write(`${JSON.stringify({ url: result.url, pending_update_count: result.pending_update_count, allowed_updates: result.allowed_updates })}\n`);
    return;
  }
  throw new Error('Dùng: node scripts/telegram-webhook.cjs <set|delete|info>');
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});

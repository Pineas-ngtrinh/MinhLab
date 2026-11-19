import assert from 'node:assert/strict';
import test from 'node:test';
import {parseTelegramPaymentAction, telegramPaymentActions, telegramPaymentRejectionChoices} from '../../integrations/notifications/telegram-payment-actions';
import {
  parseTelegramPaymentCallback,
  telegramWebhookSecretMatches,
} from '../../integrations/notifications/telegram-webhook';

const paymentId = '11111111-1111-4111-8111-111111111111';

test('Telegram webhook requires the configured secret header', () => {
  const previous = process.env.TELEGRAM_WEBHOOK_SECRET;
  process.env.TELEGRAM_WEBHOOK_SECRET = 'fixture-secret';
  try {
    assert.equal(telegramWebhookSecretMatches(new Request('https://minhlab.test/api/telegram/webhook', {
      headers: { 'x-telegram-bot-api-secret-token': 'fixture-secret' },
    })), true);
    assert.equal(telegramWebhookSecretMatches(new Request('https://minhlab.test/api/telegram/webhook')), false);
    assert.equal(telegramWebhookSecretMatches(new Request('https://minhlab.test/api/telegram/webhook', {
      headers: { 'x-telegram-bot-api-secret-token': 'wrong-secret' },
    })), false);
  } finally {
    if (previous === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET;
    else process.env.TELEGRAM_WEBHOOK_SECRET = previous;
  }
});

test('Telegram callback parser accepts the expected user, chat, message and signed-action shape', () => {
  const parsed = parseTelegramPaymentCallback({
    update_id: 50,
    callback_query: {
      id: 'callback-1',
      from: { id: 123456789 },
      message: { message_id: 71, chat: { id: -1001234567890 } },
      data: `verify-payment:${paymentId}`,
    },
  });
  assert.deepEqual(parsed, {
    callbackQueryId: 'callback-1',
    telegramUserId: '123456789',
    chatId: '-1001234567890',
    messageId: '71',
    data: `verify-payment:${paymentId}`,
  });
  assert.equal(parseTelegramPaymentCallback({ callback_query: { id: 'no-message' } }), null);
});



test('Telegram rejection requires choosing a bounded reason and retains a way back', () => {
  const keyboard = telegramPaymentActions(paymentId);
  assert.equal(parseTelegramPaymentAction(keyboard.inline_keyboard[1][0].callback_data)?.kind, 'reject-menu');
  const choices = telegramPaymentRejectionChoices(paymentId);
  assert.equal(choices.inline_keyboard.length, 4);
  for (const row of [...keyboard.inline_keyboard, ...choices.inline_keyboard]) {
    assert.ok(Buffer.byteLength(row[0].callback_data) <= 64);
    assert.ok(parseTelegramPaymentAction(row[0].callback_data));
  }
  const rejection = parseTelegramPaymentAction(`reject-payment:short:${paymentId}`);
  assert.ok(rejection?.kind === 'reject');
  assert.match(rejection.reason, /thiếu/);
  assert.equal(parseTelegramPaymentAction(`reject-payment:unknown:${paymentId}`), null);
  assert.equal(parseTelegramPaymentAction('reject-payment:short:not-a-uuid'), null);
});

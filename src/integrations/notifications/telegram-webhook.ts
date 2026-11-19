import { timingSafeEqual } from 'node:crypto';
import { isRecord } from '../../lib/request-validation';

export interface TelegramPaymentCallback {
  callbackQueryId: string;
  telegramUserId: string;
  chatId: string;
  messageId: string;
  data: string;
}

export function telegramWebhookSecretMatches(request: Request): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  const received = request.headers.get('x-telegram-bot-api-secret-token')?.trim();
  if (!expected || !received) return false;
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
}

export function parseTelegramPaymentCallback(update: unknown): TelegramPaymentCallback | null {
  if (!isRecord(update) || !isRecord(update.callback_query)) return null;
  const callback = update.callback_query;
  if (!isRecord(callback.from) || !isRecord(callback.message) || !isRecord(callback.message.chat)) return null;
  const { id: callbackQueryId } = callback;
  const telegramUserId = callback.from.id;
  const messageId = callback.message.message_id;
  const chatId = callback.message.chat.id;
  const data = callback.data;
  if (typeof callbackQueryId !== 'string' || callbackQueryId.length < 1 || callbackQueryId.length > 256) return null;
  if (!Number.isSafeInteger(telegramUserId) || (telegramUserId as number) < 1) return null;
  if (!Number.isSafeInteger(messageId) || (messageId as number) < 1) return null;
  if (!Number.isSafeInteger(chatId)) return null;
  if (typeof data !== 'string' || Buffer.byteLength(data) > 64) return null;
  return {
    callbackQueryId,
    telegramUserId: String(telegramUserId),
    chatId: String(chatId),
    messageId: String(messageId),
    data,
  };
}

export async function answerTelegramCallback(
  callbackQueryId: string,
  text: string,
  showAlert = false,
): Promise<void> {
  await telegramBotApi('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text: text.slice(0, 200),
    show_alert: showAlert,
  });
}

export async function completeTelegramPaymentMessage(
  chatId: string,
  messageId: string,
  text: string,
): Promise<void> {
  await telegramBotApi('editMessageText', {
    chat_id: chatId,
    message_id: Number(messageId),
    text: text.slice(0, 4096),
    reply_markup: { inline_keyboard: [] },
    disable_web_page_preview: true,
  });
}

export async function updateTelegramPaymentKeyboard(
  chatId: string,
  messageId: string,
  keyboard: {inline_keyboard: {text: string; callback_data: string}[][]},
): Promise<void> {
  await telegramBotApi('editMessageReplyMarkup', {
    chat_id: chatId,
    message_id: Number(messageId),
    reply_markup: keyboard,
  });
}

async function telegramBotApi(method: string, payload: Record<string, unknown>): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token || /\s/.test(token)) throw new Error('Telegram bot chưa được cấu hình.');
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error('Không thể kết nối Telegram Bot API.');
  }
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error('Telegram Bot API trả về phản hồi không hợp lệ.');
  }
  // Telegram rejects expired callback query IDs with 400; retrying them blocks local polling.
  if (method === 'answerCallbackQuery' && response.status === 400) return;
  if (!response.ok || !isRecord(result) || result.ok !== true) {
    throw new Error('Telegram Bot API từ chối cập nhật thông báo.');
  }
}

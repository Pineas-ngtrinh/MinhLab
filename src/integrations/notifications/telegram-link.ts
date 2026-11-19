import { AppError } from '../../lib/errors';
import { isRecord } from '../../lib/request-validation';
import type { TelegramStartIdentity } from '../../contracts/telegram-link';

export function parseTelegramLinkStart(update: unknown): TelegramStartIdentity | null {
  if (!isRecord(update) || !isRecord(update.message)) return null;
  const message = update.message;
  if (!isRecord(message.chat) || !isRecord(message.from) || message.chat.type !== 'private' || message.from.is_bot === true) return null;
  const sender = message.from;
  if (!Number.isSafeInteger(sender.id) || (sender.id as number) < 1 || message.chat.id !== sender.id || typeof message.text !== 'string') return null;
  const match = /^\/start link_([A-Za-z0-9_-]{43})$/.exec(message.text);
  if (!match) return null;
  const name = [sender.first_name, sender.last_name].filter(part => typeof part === 'string').join(' ');
  return { token: match[1], telegramId: String(sender.id), name: name.slice(0, 120) + (typeof sender.username === 'string' ? ` (@${sender.username.slice(0, 32)})` : '') };
}

export async function telegramBotUsername(): Promise<string> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token || !/^[A-Za-z0-9_-]{1,256}$/.test(process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? '')) throw new AppError('Bot Telegram chưa sẵn sàng. Vui lòng báo quản trị viên.');
  let result: unknown;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`, { method: 'POST', signal: AbortSignal.timeout(10000) });
    result = await response.json();
    if (!response.ok) throw new Error();
  } catch { throw new AppError('Chưa kết nối được bot Telegram. Vui lòng thử lại sau.'); }
  if (!isRecord(result) || result.ok !== true || !isRecord(result.result) || typeof result.result.username !== 'string' || !/^[A-Za-z0-9_]{5,32}$/.test(result.result.username)) throw new AppError('Bot Telegram chưa có tên hợp lệ.');
  return result.result.username;
}

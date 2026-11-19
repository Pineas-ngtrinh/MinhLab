import { NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse } from '../../../../src/lib/api-response';
import { isRecord, readJson } from '../../../../src/lib/request-validation';
import { siteOrigin } from '../../../../src/lib/site-url';
import {
  parseTelegramPaymentCallback,
  telegramWebhookSecretMatches,
} from '../../../../src/integrations/notifications/telegram-webhook';
import { parseTelegramLinkStart } from '../../../../src/integrations/notifications/telegram-link';
import { TelegramLinkService } from '../../../../src/server/telegram-link';
import { handleTelegramPaymentCallback } from '../../../../src/server/telegram-payment-approval';

export async function POST(request: NextRequest) {
  if (!telegramWebhookSecretMatches(request)) {
    return NextResponse.json({ ok: false }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const update = await readJson(request);
    if (!isRecord(update)) return NextResponse.json({ ok: true });
    const identity = parseTelegramLinkStart(update);
    if (identity) {
      const accepted = await TelegramLinkService.propose(identity);
      return NextResponse.json({ method: 'sendMessage', chat_id: identity.telegramId,
        text: accepted ? 'Đã nhận Telegram của bạn. Quay lại website MinhLab để xác nhận tên và hoàn tất liên kết.' : 'Liên kết đã hết hạn hoặc không còn dùng được. Hãy tạo đường dẫn mới từ tài khoản website.',
        reply_markup: { inline_keyboard: [[{ text: 'Quay lại website MinhLab', url: new URL('/lien-ket-telegram', siteOrigin(request)).toString() }]] },
      }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const callback = parseTelegramPaymentCallback(update);
    if (!callback) return NextResponse.json({ ok: true });
    await handleTelegramPaymentCallback(callback, siteOrigin(request));
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error, 'Không thể xử lý xác nhận thanh toán từ Telegram.');
  }
}

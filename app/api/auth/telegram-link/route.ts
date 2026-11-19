import { NextRequest, NextResponse } from 'next/server';
import { readAuthSession } from '../../../../src/lib/auth-session';
import { AppError } from '../../../../src/lib/errors';
import { apiErrorResponse } from '../../../../src/lib/api-response';
import { isRecord, readJson } from '../../../../src/lib/request-validation';
import { TelegramLinkService } from '../../../../src/server/telegram-link';

const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' };
export async function GET(request: NextRequest) {
  try {
    const session = await readAuthSession(request);
    if (!session) throw new AppError('Vui lòng đăng nhập để liên kết Telegram.', 401);
    return NextResponse.json({ success: true, data: await TelegramLinkService.status(session.id) }, { headers });
  } catch (error) { return apiErrorResponse(error, 'Chưa thể tải liên kết Telegram.'); }
}
export async function POST(request: NextRequest) {
  try {
    const session = await readAuthSession(request);
    if (!session) throw new AppError('Vui lòng đăng nhập để liên kết Telegram.', 401);
    const body = await readJson(request);
    if (!isRecord(body)) throw new AppError('Yêu cầu không hợp lệ.');
    const data = body.action === 'START' ? await TelegramLinkService.start(session.id)
      : body.action === 'CONFIRM' && typeof body.requestId === 'string' ? await TelegramLinkService.confirm(session.id, body.requestId)
      : body.action === 'UNLINK' ? await TelegramLinkService.unlink(session.id) : null;
    if (!data) throw new AppError('Thao tác không hợp lệ.');
    return NextResponse.json({ success: true, data }, { headers });
  } catch (error) { return apiErrorResponse(error, 'Chưa thể thay đổi liên kết Telegram.'); }
}

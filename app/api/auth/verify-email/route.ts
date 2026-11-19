import { AppError } from '../../../../src/lib/errors';
import { apiErrorResponse } from '../../../../src/lib/api-response';
import { NextRequest, NextResponse } from 'next/server';
import { readJson, isRecord, textField } from '../../../../src/lib/request-validation';
import { verifyAccountEmail } from '../../../../src/server/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    if (!isRecord(body)) throw new AppError('Yêu cầu không hợp lệ.');
    await verifyAccountEmail(textField(body.code ?? body.token,'Mã xác minh',128), typeof body.email === 'string' ? textField(body.email,'Email',255) : undefined);
    return NextResponse.json({ success: true, message: 'Email đã được xác minh. Bạn có thể đăng nhập.' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Không thể xử lý yêu cầu tài khoản.');
  }
}

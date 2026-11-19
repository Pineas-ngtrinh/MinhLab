import { AppError } from '../../../../../src/lib/errors';
import { apiErrorResponse } from '../../../../../src/lib/api-response';
import { NextRequest, NextResponse } from 'next/server';
import { readJson, isRecord, textField } from '../../../../../src/lib/request-validation';
import { AuthService } from '../../../../../src/server/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    if (!isRecord(body)) throw new AppError('Yêu cầu không hợp lệ.');
    if (typeof body.password !== 'string') throw new AppError('Mật khẩu không hợp lệ.');
    await AuthService.resetPassword(textField(body.token,'Token',128),body.password);
    return NextResponse.json({ success: true, message: 'Mật khẩu đã được cập nhật. Vui lòng đăng nhập lại.' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Không thể xử lý yêu cầu tài khoản.');
  }
}

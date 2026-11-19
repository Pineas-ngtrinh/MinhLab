import { AppError } from '../../../../src/lib/errors';
import { apiErrorResponse } from '../../../../src/lib/api-response';
import { NextRequest, NextResponse } from 'next/server';
import { readJson, isRecord, textField } from '../../../../src/lib/request-validation';
import { AuthService } from '../../../../src/server/auth';
import { deliverAccountMail } from '../../../../src/server/mail';

export async function POST(request: NextRequest) {
  try {
    const body = await readJson(request);
    if (!isRecord(body)) throw new AppError('Yêu cầu không hợp lệ.');
    const email = textField(body.email,'Email',255);
    const notificationId = await AuthService.requestAccountEmail(email,'PASSWORD_RESET');
    await deliverAccountMail(notificationId);
    return NextResponse.json({ success: true, message: 'Nếu email có tài khoản, MinhLab sẽ gửi hướng dẫn đặt lại mật khẩu.' }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Không thể xử lý yêu cầu tài khoản.');
  }
}

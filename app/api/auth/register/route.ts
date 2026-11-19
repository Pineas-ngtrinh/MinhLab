import { apiErrorResponse } from '../../../../src/lib/api-response';
import { readJson } from '../../../../src/lib/request-validation';
import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '../../../../src/server/auth';
import { createAuthSessionToken, setAuthSessionCookie } from '../../../../src/lib/auth-session';
import { deliverAccountMail } from '../../../../src/server/mail';

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await readJson(request);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Thông tin đăng ký không hợp lệ.' }, { status: 400 });
    }
    const { email, fullName, phone, password } = body as {
      email?: unknown;
      fullName?: unknown;
      phone?: unknown;
      password?: unknown;
    };
    if (
      typeof email !== 'string' ||
      typeof fullName !== 'string' ||
      typeof password !== 'string' ||
      (phone !== undefined && typeof phone !== 'string')
    ) {
      return NextResponse.json({ success: false, error: 'Vui lòng kiểm tra lại các trường đăng ký.' }, { status: 400 });
    }

    const user = await AuthService.register({
      email,
      fullName,
      phone: typeof phone === 'string' ? phone : undefined,
      password,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Tạo tài khoản MinhLab thành công.',
      data: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
      },
    }, { status: 201, headers: { 'Cache-Control': 'no-store' } });

    if (user.status === 'PENDING') {
      await deliverAccountMail(user.notificationId);
      return NextResponse.json({ success: true, requiresEmailVerification: true, data: { id: user.id, email: user.email, fullName: user.fullName, role: user.role } }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
    }
    return setAuthSessionCookie(response, await createAuthSessionToken(user));
  } catch (err: unknown) {
    return apiErrorResponse(err, 'Lỗi khi đăng ký tài khoản');
  }
}

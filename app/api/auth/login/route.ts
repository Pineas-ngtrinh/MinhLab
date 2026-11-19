import { apiErrorResponse } from '../../../../src/lib/api-response';
import { readJson } from '../../../../src/lib/request-validation';
import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '../../../../src/server/auth';
import { ROLES } from '../../../../src/lib/auth-roles';
import { createAuthSessionToken, setAuthSessionCookie } from '../../../../src/lib/auth-session';

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await readJson(request);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Thông tin đăng nhập không hợp lệ.' }, { status: 400 });
    }
    const { email, password } = body as { email?: unknown; password?: unknown };

    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return NextResponse.json({
        success: false,
        error: 'Vui lòng nhập đầy đủ Email và Mật khẩu.',
      }, { status: 400 });
    }

    const user = await AuthService.login(email, password);
    const roleInfo = ROLES[user.role];

    const response = NextResponse.json({
      success: true,
      message: `Đăng nhập thành công với vai trò: ${roleInfo.name}`,
      data: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        roleInfo,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });

    return setAuthSessionCookie(response, await createAuthSessionToken(user));
  } catch (err: unknown) {
    return apiErrorResponse(err, 'Lỗi khi đăng nhập');
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { AuthService, ROLES } from '../../../../src/services/auth.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({
        success: false,
        error: 'Vui lòng nhập đầy đủ Email và Mật khẩu.',
      }, { status: 400 });
    }

    const user = await AuthService.login(email, password);
    const roleInfo = ROLES[user.role];

    return NextResponse.json({
      success: true,
      message: `Đăng nhập thành công với vai trò: ${roleInfo.name}`,
      data: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        role: user.role,
        roleInfo,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi khi đăng nhập';
    return NextResponse.json({
      success: false,
      error: message,
    }, { status: 401 });
  }
}

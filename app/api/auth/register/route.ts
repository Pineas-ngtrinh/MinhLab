import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '../../../../src/services/auth.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, fullName, phone, password } = body;

    const user = await AuthService.register({
      email,
      fullName,
      phone,
      password,
    });

    return NextResponse.json({
      success: true,
      message: 'Đăng ký tài khoản thành viên MinhLab thành công!',
      data: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        role: user.role,
      },
    }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi khi đăng ký tài khoản';
    return NextResponse.json({
      success: false,
      error: message,
    }, { status: 400 });
  }
}

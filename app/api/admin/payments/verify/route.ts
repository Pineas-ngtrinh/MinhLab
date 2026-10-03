import { NextRequest, NextResponse } from 'next/server';
import { OrderService } from '../../../../../src/services/order.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderNumber, verifiedBy } = body;

    if (!orderNumber) {
      return NextResponse.json({
        success: false,
        error: 'Vui lòng cung cấp mã đơn hàng cần xác nhận.',
      }, { status: 400 });
    }

    const origin = request.nextUrl.origin || 'http://localhost:3000';
    const result = await OrderService.verifyPayment(orderNumber, verifiedBy || 'STAFF_ADMIN', origin);

    return NextResponse.json({
      success: true,
      message: result.alreadyVerified
        ? 'Khoản thanh toán này đã được xác nhận trước đó.'
        : 'Xác nhận đã nhận tiền thành công! Đã cập nhật đơn sang CONFIRMED và gửi email cho khách hàng.',
      data: {
        orderNumber: result.order.order_number,
        orderStatus: result.order.order_status,
        paymentStatus: result.order.payment_status,
        verificationStatus: result.payment.verification_status,
        verifiedAt: result.payment.verified_at,
        alreadyVerified: result.alreadyVerified,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi khi xác nhận thanh toán';
    return NextResponse.json({
      success: false,
      error: message,
    }, { status: 400 });
  }
}

// Hỗ trợ nhân viên click trực tiếp từ liên kết trong email gửi tới cửa hàng
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orderNumber = searchParams.get('order');

  if (!orderNumber) {
    return new Response('Thiếu tham số order trong liên kết xác nhận.', { status: 400 });
  }

  try {
    const origin = request.nextUrl.origin || 'http://localhost:3000';
    const result = await OrderService.verifyPayment(orderNumber, 'STAFF_VIA_EMAIL_LINK', origin);

    return new Response(`
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="utf-8">
        <title>Xác Nhận Thanh Toán — MinhLab 3D</title>
        <style>
          body { background: #0B0F14; color: #F4F1EA; font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #141A21; border: 1px solid #27313C; border-radius: 16px; padding: 32px; max-width: 480px; text-align: center; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
          .badge { display: inline-block; padding: 6px 12px; background: rgba(111, 149, 118, 0.2); color: #6F9576; border-radius: 9999px; font-weight: bold; font-size: 12px; margin-bottom: 16px; }
          h2 { margin: 0 0 8px 0; color: #F4F1EA; }
          p { color: #A5ADB8; font-size: 14px; line-height: 1.5; }
          .btn { display: inline-block; margin-top: 24px; padding: 10px 24px; background: #EB4037; color: white; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="card">
          <span class="badge">ĐÃ XÁC THỰC THÀNH CÔNG</span>
          <h2>Đã Nhận Tiền Cho Đơn ${result.order.order_number}</h2>
          <p>
            Trạng thái thanh toán: <strong>VERIFIED</strong><br>
            Trạng thái đơn hàng: <strong>CONFIRMED</strong><br>
            Email xác nhận đặt hàng thành công đã được tự động gửi tới khách hàng: <strong>${result.order.customer_email_snapshot}</strong>.
          </p>
          <a href="/" class="btn">Quay lại Trang Chủ MinhLab</a>
        </div>
      </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi khi xử lý xác nhận';
    return new Response(`Lỗi: ${message}`, { status: 400 });
  }
}

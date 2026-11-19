import { siteOrigin } from '../../../../../src/lib/site-url';
import { AppError } from '../../../../../src/lib/errors';
import { apiErrorResponse } from '../../../../../src/lib/api-response';
import { readJson, isRecord, textField } from '../../../../../src/lib/request-validation';
import { NextRequest, NextResponse } from 'next/server';
import { OrderService } from '../../../../../src/server/orders';
import { authorizeRoles } from '../../../../../src/lib/auth-session';

export async function POST(request: NextRequest) {
  try {
    const access = await authorizeRoles(request, ['ADMIN']);
    if (access.response) return access.response;

    const body = await readJson(request);
    if (!isRecord(body)) throw new AppError('Yêu cầu không hợp lệ.');
    const orderNumber = textField(body.orderNumber, 'Mã đơn', 40);

    if (!orderNumber) {
      return NextResponse.json({
        success: false,
        error: 'Vui lòng cung cấp mã đơn hàng cần xác nhận.',
      }, { status: 400 });
    }

    const origin = siteOrigin(request);
    const result = await OrderService.verifyPayment(orderNumber, access.session?.id || 'STAFF_ADMIN', origin);

    return NextResponse.json({
      success: true,
      message: result.alreadyVerified
        ? 'Khoản thanh toán này đã được xác nhận trước đó.'
        : 'Đã xác nhận thanh toán và cập nhật đơn sang CONFIRMED.',
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
    return apiErrorResponse(err, 'Lỗi khi xác nhận thanh toán');
  }
}

// GET opens the workspace; only POST may verify a payment.
export async function GET(request: NextRequest) {
  try {
    const access = await authorizeRoles(request, ['ADMIN']);
    if (access.response) {
      return access.response.status === 401
        ? NextResponse.redirect(new URL('/dang-nhap', request.url)) : access.response;
    }
    return NextResponse.redirect(new URL('/admin', request.url));
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Không thể mở bàn đối soát.');
  }
}

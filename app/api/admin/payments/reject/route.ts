import { AppError } from '../../../../../src/lib/errors';
import { apiErrorResponse } from '../../../../../src/lib/api-response';
import { readJson, isRecord, textField } from '../../../../../src/lib/request-validation';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { OrderService } from '../../../../../src/server/orders';
import { authorizeRoles } from '../../../../../src/lib/auth-session';

export async function POST(req: NextRequest) {
  try {
    const access = await authorizeRoles(req, ['ADMIN']);
    if (access.response) return access.response;

    const body = await readJson(req);
    if (!isRecord(body)) throw new AppError('Yêu cầu không hợp lệ.');
    const orderNumber = textField(body.orderNumber, 'Mã đơn', 40);
    const reason = textField(body.reason, 'Lý do', 2000, false);

    if (!orderNumber) {
      return NextResponse.json(
        { success: false, error: 'Thiếu mã đơn hàng cần từ chối thanh toán.' },
        { status: 400 }
      );
    }

    const result = await OrderService.rejectPayment(
      orderNumber,
      access.session?.id || 'STAFF_ADMIN',
      reason || 'Giao dịch không hợp lệ hoặc chưa nhận được tiền'
    );

    return NextResponse.json({
      success: true,
      data: result,
      message: `Đã từ chối thanh toán cho đơn hàng ${orderNumber}`,
    });
  } catch (err: unknown) {
    return apiErrorResponse(err, 'Lỗi từ chối thanh toán');
  }
}

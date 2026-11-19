import { NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse } from '../../../../../src/lib/api-response';
import { readAuthSession } from '../../../../../src/lib/auth-session';
import { AppError } from '../../../../../src/lib/errors';
import { isRecord, readJson, textField } from '../../../../../src/lib/request-validation';
import { OrderService } from '../../../../../src/server/orders';
import { OrderReturns } from '../../../../../src/server/order-returns';

export async function POST(request: NextRequest, context: { params: Promise<{ orderNumber: string }> }) {
  try {
    const { orderNumber: rawOrderNumber } = await context.params;
    const orderNumber = textField(rawOrderNumber, 'Mã đơn', 40);
    const body: unknown = await readJson(request);
    if (!isRecord(body)) throw new AppError('Dữ liệu yêu cầu không hợp lệ.');
    const reason = textField(body.reason, 'Lý do hoàn hàng', 2000);
    const session = await readAuthSession(request);
    const customerId = session?.role === 'CUSTOMER' ? session.id : undefined;
    const rawTrackingToken = request.headers.get('X-Order-Tracking-Token');
    const trackingToken = rawTrackingToken ? textField(rawTrackingToken, 'Token tra cứu', 128) : undefined;
    const order = await OrderService.getOrderByNumber(orderNumber, trackingToken, customerId);
    if (!order) throw new AppError('Không tìm thấy đơn hàng hoặc bạn không có quyền gửi yêu cầu.', 404);

    const result = await OrderReturns.requestReturn({
      orderNumber,
      customerId,
      requestedByUserId: customerId ?? null,
      reason,
    });
    return NextResponse.json({ success: true, data: {
      status: result.status,
      reason: result.reason,
      requestedAt: result.requestedAt,
    } }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Không thể gửi yêu cầu hoàn hàng.');
  }
}

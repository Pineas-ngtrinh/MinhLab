import { NextRequest, NextResponse } from 'next/server';
import { AppError } from '../../../../../../src/lib/errors';
import { apiErrorResponse } from '../../../../../../src/lib/api-response';
import { authorizeRoles } from '../../../../../../src/lib/auth-session';
import { isRecord, readJson, textField } from '../../../../../../src/lib/request-validation';
import { OrderReturns } from '../../../../../../src/server/order-returns';
import type { OrderReturnRequest } from '../../../../../../src/domain/orders/order-return';

export async function PATCH(request: NextRequest, context: { params: Promise<{ orderNumber: string }> }) {
  try {
    const access = await authorizeRoles(request, ['ADMIN']);
    if (access.response) return access.response;
    const { orderNumber: rawOrderNumber } = await context.params;
    const orderNumber = textField(rawOrderNumber, 'Mã đơn', 40);
    const body: unknown = await readJson(request);
    if (!isRecord(body)) throw new AppError('Dữ liệu yêu cầu không hợp lệ.');

    let result: OrderReturnRequest;
    if (body.action === 'RECEIVE') {
      result = await OrderReturns.markReturnReceived({ orderNumber, actorUserId: access.session!.id });
    } else if (body.action === 'REFUND') {
      if (typeof body.amount !== 'number') throw new AppError('Số tiền hoàn không hợp lệ.');
      result = (await OrderReturns.recordRefund({
        orderNumber,
        actorUserId: access.session!.id,
        amount: body.amount,
        transactionReference: textField(body.transactionReference, 'Mã giao dịch', 120),
      })).request;
    } else {
      throw new AppError('Thao tác hoàn hàng không hợp lệ.');
    }

    return NextResponse.json({ success: true, data: {
      status: result.status,
      reason: result.reason,
      requestedAt: result.requestedAt,
      receivedAt: result.receivedAt,
      refundedAt: result.refundedAt,
      refundedAmount: result.refundedAmount,
      transactionReference: result.transactionReference,
    } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Không thể cập nhật yêu cầu hoàn hàng.');
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse } from '../../../../../src/lib/api-response';
import { readAuthSession } from '../../../../../src/lib/auth-session';
import { textField } from '../../../../../src/lib/request-validation';
import { uploadPaymentProof } from '../../../../../src/server/payment-proofs';

export async function POST(request: NextRequest, context: { params: Promise<{ orderNumber: string }> }) {
  try {
    const session = await readAuthSession(request);
    const customerId = session?.role === 'CUSTOMER' ? session.id : undefined;
    const trackingToken = request.headers.get('X-Order-Tracking-Token') ?? undefined;
    const result = await uploadPaymentProof({
      request,
      orderNumber: textField((await context.params).orderNumber, 'Mã đơn', 40),
      trackingToken: trackingToken ? textField(trackingToken, 'Token tra cứu', 128) : undefined,
      customerId,
    });
    return NextResponse.json({
      success: true,
      message: 'Đã nhận biên lai riêng tư. Nhân viên chỉ xem được sau khi hệ thống quét an toàn hoàn tất.',
      data: result,
    }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiErrorResponse(error, 'Không thể lưu biên lai thanh toán.');
  }
}

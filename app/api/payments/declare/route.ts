import { siteOrigin } from '../../../../src/lib/site-url';
import { AppError } from '../../../../src/lib/errors';
import { apiErrorResponse } from '../../../../src/lib/api-response';
import { NextRequest, NextResponse } from 'next/server';
import { OrderService } from '../../../../src/server/orders';
import { readAuthSession } from '../../../../src/lib/auth-session';
import { isRecord, textField, readJson } from '../../../../src/lib/request-validation';

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await readJson(request);
    if (!isRecord(body)) throw new AppError('Thông tin chuyển khoản không hợp lệ.');
    const orderNumber = textField(body.orderNumber, 'Mã đơn', 40);
    const transactionReference = textField(body.transactionReference, 'Mã giao dịch', 120, false) || undefined;
    const bankName = textField(body.bankName, 'Ngân hàng', 120, false) || undefined;
    const senderAccountName = textField(body.senderAccountName, 'Người chuyển', 160, false) || undefined;
    const trackingToken = textField(body.trackingToken, 'Token tra cứu', 128, false);
    const paymentProofUrl = textField(body.paymentProofUrl, 'Ảnh chuyển khoản', 2048, false);
    if (paymentProofUrl) throw new AppError('Tạm thời chưa nhận ảnh biên lai qua liên kết công khai. Hãy khai báo thông tin giao dịch; ảnh sẽ được mở lại khi có kho lưu trữ riêng tư.', 409);
    const session = await readAuthSession(request);

    const origin = siteOrigin(request);
    const result = await OrderService.declarePayment({
      orderNumber,
      transactionReference,
      bankName,
      senderAccountName,
      paymentProofUrl,
      trackingToken,
    }, origin, session?.id);

    return NextResponse.json({
      success: true,
      message: 'Khai báo chuyển khoản thành công. Đang chờ nhân viên MinhLab đối soát tài khoản thực tế.',
      data: {
        orderNumber: result.order.order_number,
        verificationStatus: result.payment.verification_status, // Always 'PENDING'
        transferredAt: result.payment.transferred_at,
      },
    });
  } catch (err: unknown) {
    return apiErrorResponse(err, 'Lỗi khi khai báo chuyển khoản');
  }
}

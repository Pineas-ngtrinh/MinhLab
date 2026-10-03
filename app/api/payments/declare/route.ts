import { NextRequest, NextResponse } from 'next/server';
import { OrderService } from '../../../../src/services/order.service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderNumber, transactionReference, bankName, senderAccountName, paymentProofUrl } = body;

    if (!orderNumber || !transactionReference || !bankName || !senderAccountName) {
      return NextResponse.json({
        success: false,
        error: 'Vui lòng cung cấp đầy đủ: Mã đơn, Mã giao dịch tham chiếu, Tên ngân hàng và Tên chủ tài khoản chuyển.',
      }, { status: 400 });
    }

    const origin = request.nextUrl.origin || 'http://localhost:3000';
    const result = await OrderService.declarePayment({
      orderNumber,
      transactionReference,
      bankName,
      senderAccountName,
      paymentProofUrl,
    }, origin);

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
    const message = err instanceof Error ? err.message : 'Lỗi khi khai báo chuyển khoản';
    return NextResponse.json({
      success: false,
      error: message,
    }, { status: 400 });
  }
}

import { NextResponse } from 'next/server';
import { OrderService } from '../../../../src/services/order.service';

export async function GET() {
  try {
    const paymentsList = OrderService.getAllPayments();

    return NextResponse.json({
      success: true,
      data: paymentsList.map(({ payment, order, attachments }) => ({
        id: payment.id,
        paymentNumber: payment.payment_number,
        orderNumber: order?.order_number || 'N/A',
        orderStatus: order?.order_status || 'N/A',
        customerName: order?.customer_name_snapshot || 'Khách vãng lai',
        customerEmail: order?.customer_email_snapshot || 'N/A',
        customerPhone: order?.customer_phone_snapshot || 'N/A',
        amount: payment.amount,
        paymentMethod: payment.payment_method,
        paymentPurpose: payment.payment_purpose,
        transactionReference: payment.transaction_reference || 'Chưa khai báo',
        bankName: payment.bank_name || 'N/A',
        senderAccountName: payment.sender_account_name || 'N/A',
        transferredAt: payment.transferred_at,
        verificationStatus: payment.verification_status,
        verifiedBy: payment.verified_by,
        verifiedAt: payment.verified_at,
        attachments: attachments.map((a) => a.file_url),
        createdAt: payment.created_at,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi khi tải danh sách thanh toán';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

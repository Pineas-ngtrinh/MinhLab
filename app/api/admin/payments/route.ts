import { parsePageOptions } from '../../../../src/lib/pagination';
import { apiErrorResponse } from '../../../../src/lib/api-response';
import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { OrderService } from '../../../../src/server/orders';
import { authorizeRoles } from '../../../../src/lib/auth-session';

export async function GET(request: NextRequest) {
  try {
    const access = await authorizeRoles(request, ['ADMIN']);
    if (access.response) return access.response;

    const { data: paymentsList, pagination } = await OrderService.getPaymentsPage(parsePageOptions(request.nextUrl.searchParams, ['PENDING', 'VERIFIED', 'REJECTED', 'REFUNDED']));

    return NextResponse.json({
      success: true,
      pagination,
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
        rejectionReason: payment.rejection_reason,
        attachments: attachments.map((a) => a.file_url),
        createdAt: payment.created_at,
      })),
    });
  } catch (err: unknown) {
    return apiErrorResponse(err, 'Lỗi khi tải danh sách thanh toán');
  }
}

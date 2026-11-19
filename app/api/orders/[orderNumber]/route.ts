import type { ApiResponse } from '../../../../src/contracts/api';
import type { TrackedOrderData } from '../../../../src/contracts/orders';
import { apiErrorResponse } from '../../../../src/lib/api-response';
import { NextRequest, NextResponse } from 'next/server';
import { OrderService } from '../../../../src/server/orders';
import { readAuthSession } from '../../../../src/lib/auth-session';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;
    const session = await readAuthSession(request);
    const trackingToken = request.nextUrl.searchParams.get('token') ?? undefined;
    const ownerId = session?.role === 'CUSTOMER' ? session.id : undefined;
    const result = await OrderService.getOrderByNumber(orderNumber, trackingToken, ownerId);

    if (!result) {
      return NextResponse.json({
        success: false,
        error: 'Không tìm thấy đơn hàng hoặc liên kết tra cứu đã hết hạn.',
      }, { status: 404 });
    }

    return NextResponse.json<ApiResponse<TrackedOrderData>>({
      success: true,
      data: {
        production:result.production,
        orderNumber: result.order.order_number,
        orderStatus: result.order.order_status,
        paymentStatus: result.order.payment_status,
        paymentTiming: result.order.payment_timing,
        grandTotal: result.order.grand_total,
        shippingAddress: result.order.shipping_address_line,
        customerName: result.order.customer_name_snapshot,
        customerEmail: result.order.customer_email_snapshot,
        payment: result.payment ? {
          receivingBank:result.payment.receivingBank,
          paymentNumber: result.payment.payment_number,
          paymentMethod: result.payment.payment_method,
          amount: result.payment.amount,
          verificationStatus: result.payment.verification_status,
          transferredAt: result.payment.transferred_at,
          verifiedAt: result.payment.verified_at,
          rejectionReason: result.payment.rejection_reason,
        } : null,
        returnRequest: result.returnRequest ? {
          status: result.returnRequest.status,
          reason: result.returnRequest.reason,
          requestedAt: result.returnRequest.requestedAt,
          receivedAt: result.returnRequest.receivedAt,
          refundedAt: result.returnRequest.refundedAt,
          refundedAmount: result.returnRequest.refundedAmount,
          transactionReference: result.returnRequest.transactionReference,
        } : undefined,
        items: result.items.map((i) => ({
          itemName: i.item_name_snapshot,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          lineTotal: i.line_total,
        })),
      },
    });
  } catch (error: unknown) {
    return apiErrorResponse(error, 'Không thể xử lý yêu cầu. Vui lòng thử lại sau.');
  }
}

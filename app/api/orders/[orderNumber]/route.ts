import { NextRequest, NextResponse } from 'next/server';
import { OrderService } from '../../../../src/services/order.service';

export async function GET(
  request: NextRequest,
  { params }: { params: { orderNumber: string } }
) {
  const { orderNumber } = params;
  const result = OrderService.getOrderByNumber(orderNumber);

  if (!result) {
    return NextResponse.json({
      success: false,
      error: `Không tìm thấy đơn hàng [${orderNumber}]`,
    }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    data: {
      orderNumber: result.order.order_number,
      orderStatus: result.order.order_status,
      paymentStatus: result.order.payment_status,
      paymentTiming: result.order.payment_timing,
      grandTotal: result.order.grand_total,
      shippingAddress: result.order.shipping_address_line,
      customerName: result.order.customer_name_snapshot,
      customerEmail: result.order.customer_email_snapshot,
      payment: result.payment ? {
        paymentNumber: result.payment.payment_number,
        paymentMethod: result.payment.payment_method,
        amount: result.payment.amount,
        verificationStatus: result.payment.verification_status,
        transferredAt: result.payment.transferred_at,
        verifiedAt: result.payment.verified_at,
      } : null,
      items: result.items.map((i) => ({
        itemName: i.item_name_snapshot,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        lineTotal: i.line_total,
      })),
    },
  });
}

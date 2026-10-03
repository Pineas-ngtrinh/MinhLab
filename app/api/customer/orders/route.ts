import { NextRequest, NextResponse } from 'next/server';
import { OrderService } from '../../../../src/services/order.service';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');

  if (!email) {
    return NextResponse.json({ success: false, error: 'Thiếu tham số email' }, { status: 400 });
  }

  try {
    const orders = OrderService.getOrdersByCustomerEmail(email);
    return NextResponse.json({
      success: true,
      data: orders.map(({ order, items, payment }) => ({
        orderNumber: order.order_number,
        orderStatus: order.order_status,
        paymentStatus: order.payment_status,
        paymentTiming: order.payment_timing,
        grandTotal: order.grand_total,
        placedAt: order.placed_at,
        shippingAddress: order.shipping_address_line,
        items: items.map((i) => ({
          itemName: i.item_name_snapshot,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          lineTotal: i.line_total,
        })),
        payment: payment ? {
          paymentMethod: payment.payment_method,
          verificationStatus: payment.verification_status,
          amount: payment.amount,
        } : null,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi khi tra cứu đơn hàng cá nhân';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

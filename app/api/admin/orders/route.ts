import { NextRequest, NextResponse } from 'next/server';
import { OrderService } from '../../../../src/services/order.service';

export async function GET() {
  try {
    const orders = OrderService.getAllOrders();
    return NextResponse.json({
      success: true,
      data: orders.map(({ order, items, payment }) => ({
        orderNumber: order.order_number,
        customerName: order.customer_name_snapshot,
        customerEmail: order.customer_email_snapshot,
        customerPhone: order.customer_phone_snapshot,
        shippingAddress: order.shipping_address_line,
        orderStatus: order.order_status,
        paymentStatus: order.payment_status,
        paymentTiming: order.payment_timing,
        grandTotal: order.grand_total,
        placedAt: order.placed_at,
        itemsCount: items.length,
        items: items.map((i) => ({
          name: i.item_name_snapshot,
          type: i.item_type,
          quantity: i.quantity,
          price: i.unitPrice,
        })),
        payment: payment ? {
          paymentMethod: payment.payment_method,
          verificationStatus: payment.verification_status,
          amount: payment.amount,
        } : null,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi khi tải danh sách đơn hàng';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderNumber, newStatus } = body;

    if (!orderNumber || !newStatus) {
      return NextResponse.json({ success: false, error: 'Thiếu mã đơn hoặc trạng thái mới.' }, { status: 400 });
    }

    const updated = OrderService.updateOrderStatus(orderNumber, newStatus);
    return NextResponse.json({
      success: true,
      message: `Đã cập nhật trạng thái đơn ${orderNumber} sang [${newStatus}]`,
      data: {
        orderNumber: updated.order_number,
        orderStatus: updated.order_status,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi khi cập nhật trạng thái đơn hàng';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

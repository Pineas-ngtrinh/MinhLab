import { NextRequest, NextResponse } from 'next/server';
import { OrderService, CreateOrderInput } from '../../../src/services/order.service';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateOrderInput;
    const origin = request.nextUrl.origin || 'http://localhost:3000';

    const result = await OrderService.createOrder(body, origin);

    return NextResponse.json({
      success: true,
      data: {
        orderNumber: result.order.order_number,
        orderStatus: result.order.order_status,
        paymentStatus: result.order.payment_status,
        paymentTiming: result.order.payment_timing,
        grandTotal: result.order.grand_total,
        payment: result.payment ? {
          paymentNumber: result.payment.payment_number,
          amount: result.payment.amount,
          verificationStatus: result.payment.verification_status,
        } : null,
      },
    }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi khi tạo đơn hàng';
    return NextResponse.json({
      success: false,
      error: message,
    }, { status: 400 });
  }
}

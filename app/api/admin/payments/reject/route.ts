import { NextResponse } from 'next/server';
import { OrderService } from '../../../../../src/services/order.service';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { orderNumber, rejectedBy, reason } = body;

    if (!orderNumber) {
      return NextResponse.json(
        { success: false, error: 'Thiếu mã đơn hàng orderNumber' },
        { status: 400 }
      );
    }

    const result = await OrderService.rejectPayment(
      orderNumber,
      rejectedBy || 'STAFF_ADMIN',
      reason || 'Giao dịch không hợp lệ hoặc chưa nhận được tiền'
    );

    return NextResponse.json({
      success: true,
      data: result,
      message: `Đã từ chối thanh toán cho đơn hàng ${orderNumber}`,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Lỗi từ chối thanh toán' },
      { status: 400 }
    );
  }
}

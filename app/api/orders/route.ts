import type { ApiResponse } from '../../../src/contracts/api';
import type { CreatedOrderData } from '../../../src/contracts/orders';
import { apiErrorResponse } from '../../../src/lib/api-response';
import { NextRequest, NextResponse } from 'next/server';
import { OrderService } from '../../../src/server/orders';

import { readAuthSession } from '../../../src/lib/auth-session';
import { parseOrderInput, readJson } from '../../../src/lib/request-validation';

export async function POST(request: NextRequest) {
  try {
    const body = parseOrderInput(await readJson(request));
    const session = await readAuthSession(request);
    const result = await OrderService.createOrder(
      body,
      session?.id,
      request.headers.get('Idempotency-Key') ?? undefined,
    );

    return NextResponse.json<ApiResponse<CreatedOrderData>>({
      success: true,
      data: {
        orderNumber: result.order.order_number,
        orderStatus: result.order.order_status,
        paymentStatus: result.order.payment_status,
        paymentTiming: result.order.payment_timing,
        grandTotal: result.order.grand_total,
        trackingToken: result.trackingToken,
        payment: result.payment ? {
          receivingBank:result.payment.receivingBank,
          paymentNumber: result.payment.payment_number,
          amount: result.payment.amount,
          verificationStatus: result.payment.verification_status,
        } : null,
      },
    }, { status: 201 });
  } catch (err: unknown) {
    return apiErrorResponse(err, 'Lỗi khi tạo đơn hàng');
  }
}

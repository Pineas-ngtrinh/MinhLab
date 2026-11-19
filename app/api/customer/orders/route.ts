import { parsePageOptions } from '../../../../src/lib/pagination';
import { ORDER_STATUSES } from '../../../../src/domain/orders/order';
import type { CustomerOrderData } from '../../../../src/contracts/orders';
import { apiErrorResponse } from '../../../../src/lib/api-response';
import { NextRequest, NextResponse } from 'next/server';
import { OrderService } from '../../../../src/server/orders';
import { authorizeRoles } from '../../../../src/lib/auth-session';

export async function GET(request: NextRequest) {
  try {
    const access = await authorizeRoles(request, ['CUSTOMER']);
    if (access.response) return access.response;

    const customerId = access.session?.id;
    if (!customerId) return NextResponse.json({ success: false, error: 'Phiên đăng nhập không hợp lệ.' }, { status: 401 });

    const page = await OrderService.getCustomerOrdersPage(customerId,parsePageOptions(request.nextUrl.searchParams,ORDER_STATUSES));
    return NextResponse.json({
      success: true,
      pagination:page.pagination,
      summary:page.summary,
      data: page.data.map(({ order, items, payment, production }): CustomerOrderData => ({
        production,
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
    }, {headers:{'Cache-Control':'no-store'}});
  } catch (err: unknown) {
    return apiErrorResponse(err, 'Lỗi khi tra cứu đơn hàng cá nhân');
  }
}

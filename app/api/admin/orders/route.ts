import { parsePageOptions } from '../../../../src/lib/pagination';
import { apiErrorResponse } from '../../../../src/lib/api-response';
import { readJson, isRecord, textField } from '../../../../src/lib/request-validation';
import { NextRequest, NextResponse } from 'next/server';
import { OrderService } from '../../../../src/server/orders';
import { authorizeRoles } from '../../../../src/lib/auth-session';

import { ORDER_STATUSES } from '../../../../src/domain/orders/order';

export async function GET(request: NextRequest) {
  try {
    const access = await authorizeRoles(request, ['ADMIN']);
    if (access.response) return access.response;

    const { data: orders, pagination } = await OrderService.getOrdersPage(parsePageOptions(request.nextUrl.searchParams, ORDER_STATUSES));
    return NextResponse.json({
      success: true,
      pagination,
      data: orders.map(({ order, items, payment, returnRequest }) => ({
        orderNumber: order.order_number,
        customerName: order.customer_name_snapshot,
        customerEmail: order.customer_email_snapshot,
        customerPhone: order.customer_phone_snapshot,
        shippingAddress: order.shipping_address_line,
        customerNote: order.customer_note,
        orderStatus: order.order_status,
        paymentStatus: order.payment_status,
        paymentTiming: order.payment_timing,
        grandTotal: order.grand_total,
        placedAt: order.placed_at,
        itemsCount: items.length,
        items: items.map((i) => ({
          itemName: i.item_name_snapshot,
          itemType: i.item_type,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          material: i.material_snapshot,
        })),
        payment: payment ? {
          paymentMethod: payment.payment_method,
          verificationStatus: payment.verification_status,
          amount: payment.amount,
        } : null,
        returnRequest: returnRequest ? {
          status: returnRequest.status,
          reason: returnRequest.reason,
          requestedAt: returnRequest.requestedAt,
          receivedAt: returnRequest.receivedAt,
          refundedAt: returnRequest.refundedAt,
          refundedAmount: returnRequest.refundedAmount,
          transactionReference: returnRequest.transactionReference,
        } : null,
      })),
    });
  } catch (err: unknown) {
    return apiErrorResponse(err, 'Lỗi khi tải danh sách đơn hàng');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const access = await authorizeRoles(request, ['ADMIN', 'WORKSHOP_OPERATOR', 'PRINT_OPERATOR']);
    if (access.response) return access.response;

    const body: unknown = await readJson(request);
    if (!isRecord(body)) {
      return NextResponse.json({ success: false, error: 'Dữ liệu yêu cầu không hợp lệ.' }, { status: 400 });
    }
    const orderNumber = textField(body.orderNumber, 'Mã đơn', 40);
    const newStatus = body.newStatus;

    if (typeof orderNumber !== 'string' || !orderNumber.trim() || typeof newStatus !== 'string' || !ORDER_STATUSES.includes(newStatus as (typeof ORDER_STATUSES)[number])) {
      return NextResponse.json({ success: false, error: 'Thiếu mã đơn hoặc trạng thái mới.' }, { status: 400 });
    }

    const updated = await OrderService.updateOrderStatus(
      orderNumber.trim(),
      newStatus as (typeof ORDER_STATUSES)[number],
      access.session?.id,
      access.session?.role,
    );
    return NextResponse.json({
      success: true,
      message: `Đã cập nhật trạng thái đơn ${orderNumber} sang [${newStatus}]`,
      data: {
        orderNumber: updated.order_number,
        orderStatus: updated.order_status,
      },
    });
  } catch (err: unknown) {
    return apiErrorResponse(err, 'Lỗi khi cập nhật trạng thái đơn hàng');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const access = await authorizeRoles(request, ['ADMIN']);
    if (access.response) return access.response;

    const body: unknown = await readJson(request);
    if (!isRecord(body)) {
      return NextResponse.json({ success: false, error: 'Dữ liệu yêu cầu không hợp lệ.' }, { status: 400 });
    }
    const orderNumber = textField(body.orderNumber, 'Mã đơn', 40);
    if (typeof orderNumber !== 'string' || !orderNumber.trim()) {
      return NextResponse.json({ success: false, error: 'Thiếu mã đơn cần xóa.' }, { status: 400 });
    }

    const archived = await OrderService.archiveOrder(
      orderNumber.trim(),
      access.session?.id,
      access.session?.role,
    );
    return NextResponse.json({
      success: true,
      message: `Đã xóa đơn ${archived.orderNumber} khỏi danh sách quản trị.`,
      data: archived,
    });
  } catch (err: unknown) {
    return apiErrorResponse(err, 'Lỗi khi xóa đơn hàng');
  }
}

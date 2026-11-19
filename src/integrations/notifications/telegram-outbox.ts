import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';

type TelegramOrderNotificationType = 'STORE_ORDER_CREATED' | 'STORE_PAYMENT_DECLARED' | 'STORE_PAYMENT_VERIFIED';
export type TelegramNotification =
  | { dedupKey: string; type: TelegramOrderNotificationType; orderNumber: string; body: string }
  | { dedupKey: string; type: 'PRODUCTION_PLAN_DRAFTED'; productionPlanId: string; body: string };

const currency = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 });

function amountText(amount: number): string {
  return `${currency.format(amount)} ₫`;
}

export function telegramOrderCreatedMessage(payload: {
  orderNumber: string;
  grandTotal: number;
  paymentMethod: 'VIETQR';
}): string {
  const payment = 'QR cá nhân · chờ đối soát thủ công';
  return `🛒 Đơn mới ${payload.orderNumber}\nTổng tiền: ${amountText(payload.grandTotal)}\nThanh toán: ${payment}\nMở trang quản trị để xử lý đơn.`;
}

export function telegramPaymentDeclaredMessage(payload: {
  orderNumber: string;
  amount: number;
  customer?: {
    name: string;
    email: string;
    phone: string;
    recipientName: string;
    recipientPhone: string;
    address: string;
    province: string;
  };
  items?: { name: string; quantity: number; unitPrice: number; lineTotal: number }[];
}): string {
  const customer = payload.customer;
  const customerDetails = customer
    ? `\nKhách hàng:\nTên: ${customer.name}\nEmail: ${customer.email}\nĐiện thoại: ${customer.phone}\nNgười nhận: ${customer.recipientName} · ${customer.recipientPhone}\nĐịa chỉ giao: ${customer.address}, ${customer.province}`
    : '';
  const intro = `🔔 Khách đã khai báo chuyển khoản\nĐơn: ${payload.orderNumber}${customerDetails}\n\nSản phẩm:`;
  const lines = (payload.items ?? []).map(item =>
    `• ${item.name.replace(/\s+/g, ' ').trim()} × ${item.quantity} — ${amountText(item.unitPrice)}/sp · Thành tiền ${amountText(item.lineTotal)}`,
  );
  const footer = `\nTổng đơn: ${amountText(payload.amount)}\nChưa xác nhận tiền đã vào. Đối soát ngân hàng trước khi bấm xác nhận.`;
  const included: string[] = [];
  for (const line of lines) {
    const remaining = lines.length - included.length - 1;
    const omitted = remaining > 0 ? `\n… còn ${remaining} dòng sản phẩm, xem trong trang quản trị.` : '';
    const next = `${intro}\n${[...included, line].join('\n')}${omitted}${footer}`;
    if (next.length > 3900) break;
    included.push(line);
  }
  const omittedCount = lines.length - included.length;
  const itemsText = included.length
    ? included.join('\n')
    : 'Không có chi tiết sản phẩm trong thông báo này.';
  const omittedText = omittedCount > 0 ? `\n… còn ${omittedCount} dòng sản phẩm, xem trong trang quản trị.` : '';
  return `${intro}\n${itemsText}${omittedText}${footer}`;
}

export function telegramPaymentVerifiedMessage(payload: { orderNumber: string; amount: number }): string {
  return `✅ Đã đối soát thủ công đơn ${payload.orderNumber}\nSố tiền xác nhận: ${amountText(payload.amount)}.`;
}

export function telegramProductionPlanDraftMessage(payload: {
  status: 'WAITING_DATA' | 'PENDING_APPROVAL';
  orderCount: number;
  batchCount: number;
  blockerCount: number;
}): string {
  const status = payload.status === 'WAITING_DATA'
    ? `Đang chờ bổ sung dữ liệu (${payload.blockerCount} mục).`
    : 'Đang chờ người vận hành kiểm tra và duyệt.';
  return `🧠 Agent đã tạo phương án sản xuất nháp\nĐơn liên quan: ${payload.orderCount} · Mẻ in: ${payload.batchCount}\n${status}\nMở /admin → Sản xuất để xem. Chưa có lệnh in nào được phát hành.`;
}

/** Persist an operational alert in the same transaction as its order/payment change. */
export async function enqueueTelegramNotification(
  client: PoolClient,
  input: TelegramNotification,
): Promise<void> {
  await client.query(
    `INSERT INTO telegram_outbox (dedup_key, notification_type, order_number, production_plan_id, body_text)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (dedup_key) DO NOTHING`,
    [input.dedupKey, input.type, 'orderNumber' in input ? input.orderNumber : null, 'productionPlanId' in input ? input.productionPlanId : null, input.body],
  );
}

export function paymentDeclarationDedupKey(orderNumber: string, transactionReference: string | undefined, declarationId: string): string {
  const referenceHash = createHash('sha256')
    .update(`${transactionReference?.trim().toLowerCase() ?? ''}\0${declarationId}`)
    .digest('hex');
  return `payment-declared:${orderNumber}:${referenceHash}`;
}

import Link from 'next/link';
import { OrderProductionProgress } from '../common/OrderProductionProgress';
import type { CustomerOrderData } from '../../contracts/orders';
import { ORDER_STATUS_BADGES, PAYMENT_STATUS_BADGES } from '../../lib/order-presentation';
import { formatVND } from '../../lib/format';

const orderDate = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: 'Asia/Ho_Chi_Minh',
});

interface CustomerOrderCardProps {
  order: CustomerOrderData;
}

export function CustomerOrderCard({ order }: CustomerOrderCardProps) {
  const statusBadge = ORDER_STATUS_BADGES[order.orderStatus];
  const paymentBadge = PAYMENT_STATUS_BADGES[order.paymentStatus];

  return (
    <article aria-label={`Đơn hàng ${order.orderNumber}`} className="p-5 sm:p-6 rounded-2xl bg-[#141A21] border border-[#27313C] space-y-4 text-xs font-mono">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#27313C]">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Link className="break-all text-sm font-bold text-[#EB4037] underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-[#C8A261]" href={`/theo-doi-don?order=${encodeURIComponent(order.orderNumber)}`}>
            {order.orderNumber}
          </Link>
          <span aria-hidden="true" className="text-[#737D89]">·</span>
          <time dateTime={order.placedAt} className="text-[#A5ADB8]">{orderDate.format(new Date(order.placedAt))}</time>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-2.5 py-1 rounded border text-[11px] font-bold ${statusBadge.className}`}>
            {statusBadge.label}
          </span>
          <span className={`px-2.5 py-1 rounded border text-[11px] font-bold ${paymentBadge.className}`}>
            {paymentBadge.label}
          </span>
        </div>
      </div>

      <div className="divide-y divide-[#27313C]/60 space-y-2">
        {order.items.map((item, index) => (
          <div key={`${index}-${item.itemName}`} className="flex justify-between items-center gap-3 pt-2 first:pt-0">
            <div className="min-w-0 break-words text-[#F4F1EA]">
              <span>{item.itemName}</span>
              <span className="text-[#737D89] ml-2">x{item.quantity}</span>
            </div>
            <span className="shrink-0 font-bold text-[#F4F1EA]">{formatVND(item.lineTotal)}</span>
          </div>
        ))}
      </div>

      <OrderProductionProgress items={order.production}/>
      <div className="pt-3 border-t border-[#27313C] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0 break-words text-[#A5ADB8]">
          <span>Giao đến: </span>
          <span className="text-[#F4F1EA]">{order.shippingAddress}</span>
        </div>
        <div className="shrink-0 text-right">
          <span className="text-[#737D89] block text-[10px]">Tổng đơn:</span>
          <span className="text-base font-bold text-[#EB4037]">{formatVND(order.grandTotal)}</span>
        </div>
      </div>
    </article>
  );
}

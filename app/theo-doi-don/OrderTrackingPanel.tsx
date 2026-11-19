'use client';

import { OrderProductionProgress } from '../../src/components/common/OrderProductionProgress';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, Clock3, PackageCheck, RefreshCw, Truck } from 'lucide-react';

import { ORDER_STATUS_BADGES, PAYMENT_STATUS_BADGES, paymentRejectionNotice } from '../../src/lib/order-presentation';
import { formatVND } from '../../src/lib/format';
import { useTrackedOrder } from '../../src/hooks/useTrackedOrder';
import { PaymentDeclarationForm } from './PaymentDeclarationForm';
import { OrderReturnRequestForm } from './OrderReturnRequestForm';

interface OrderTrackingPanelProps {
  orderNumber: string;
  token: string;
}

const STEPS = [
  { status: 'CONFIRMED', label: 'Đã xác nhận', icon: CheckCircle2 },
  { status: 'IN_PRODUCTION', label: 'Đang chế tác', icon: Clock3 },
  { status: 'READY_TO_SHIP', label: 'Đã hoàn thiện', icon: PackageCheck },
  { status: 'SHIPPED', label: 'Đang giao', icon: Truck },
  { status: 'COMPLETED', label: 'Đã giao', icon: CheckCircle2 },
];

export default function OrderTrackingPanel({ orderNumber, token }: OrderTrackingPanelProps) {
  const {order,error,isLoading,reload} = useTrackedOrder(orderNumber,token);

  const stepIndex = order ? STEPS.findIndex((step) => step.status === order.orderStatus) : -1;
  const currentStepIndex = stepIndex;

  return (
    <div className="mx-auto min-h-[70vh] w-full max-w-4xl px-4 py-10 sm:px-8 sm:py-16">
      <header className="mb-8 space-y-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#C8A261]">MinhLab · Tra cứu đơn hàng</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-[#F4F1EA] sm:text-4xl">Tiến độ đơn hàng</h1>
          <button type="button" onClick={reload} disabled={isLoading} className="min-h-11 shrink-0 rounded-lg border border-[#27313C] px-4 text-sm text-[#C8A261] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261] disabled:opacity-40">Làm mới</button>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-[#A5ADB8]">Theo dõi đơn bằng tài khoản đã đặt hàng hoặc liên kết bảo mật riêng của đơn.</p>
      </header>

      {isLoading ? (
        <div role="status" aria-live="polite" className="flex min-h-44 items-center justify-center gap-3 rounded-2xl border border-white/[0.08] bg-[#111216] text-sm text-[#A5ADB8]">
          <RefreshCw aria-hidden="true" className="h-4 w-4 animate-spin text-[#C8A261] motion-reduce:animate-none" /> Đang tải trạng thái đơn hàng…
        </div>
      ) : error ? (
        <div role="alert" className="space-y-4 rounded-2xl border border-[#EB4037]/30 bg-[#111216] p-6 sm:p-8">
          <p className="text-sm text-[#FF8179]">{error}</p>
          <p className="text-sm leading-6 text-[#A5ADB8]">Nếu bạn đã đăng nhập, xem đơn trong tài khoản. Nếu liên kết hết hạn, vui lòng liên hệ MinhLab và cung cấp mã đơn.</p>
          <Link href="/tai-khoan" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#EB4037] px-4 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261]">
            Mở tài khoản <ArrowRight aria-hidden="true" className="h-4 w-4" />
          </Link>
        </div>
      ) : order ? (
        <section className="space-y-6 rounded-2xl border border-white/[0.08] bg-[#111216] p-5 sm:p-8" aria-label={`Đơn hàng ${order.orderNumber}`}>
          <div className="flex flex-col justify-between gap-4 border-b border-white/[0.08] pb-5 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs text-[#737D89]">Mã đơn hàng</p>
              <p className="mt-1 break-all font-mono text-lg font-semibold text-[#F4F1EA]">{order.orderNumber}</p>
            </div>
            <div className="sm:text-right">
              <p className="text-xs text-[#737D89]">Trạng thái hiện tại</p>
              <p className="mt-1 text-sm font-semibold text-[#C8A261]">{ORDER_STATUS_BADGES[order.orderStatus].label}</p>
            </div>
          </div>

          {order.orderStatus === 'CANCELLED' ? (
            <p className="border-l-2 border-[#EB4037] pl-4 text-sm leading-6 text-[#A5ADB8]">Đơn đã được hủy. Vui lòng liên hệ MinhLab nếu bạn cần kiểm tra thêm.</p>
          ) : (
            <ol className="row g-3" aria-label="Các bước xử lý đơn hàng">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                const isComplete = currentStepIndex >= index;
                const isCurrent = currentStepIndex === index;
                return (
                  <li key={step.status} className="col-12 col-sm-6 col-lg">
                    <div className={`flex h-full items-center gap-3 rounded-xl border p-3 ${isCurrent ? 'border-[#C8A261]/50 bg-[#C8A261]/[0.08]' : 'border-white/[0.08] bg-[#0B0B0E]'}`}>
                      <Icon aria-hidden="true" className={`h-5 w-5 shrink-0 ${isComplete ? 'text-[#C8A261]' : 'text-[#555D67]'}`} />
                      <span className={`text-xs ${isComplete ? 'text-[#F4F1EA]' : 'text-[#737D89]'}`}>{step.label}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          <div className="space-y-3 border-t border-white/[0.08] pt-5">
            <h2 className="text-sm font-semibold text-[#F4F1EA]">Sản phẩm trong đơn</h2>
            {order.items.map((item, index) => (
              <div key={`${item.itemName}-${index}`} className="flex flex-col justify-between gap-1 text-sm sm:flex-row sm:items-center">
                <span className="text-[#A5ADB8]">{item.itemName} · {item.quantity} sản phẩm</span>
                <span className="font-mono text-[#F4F1EA]">{formatVND(item.lineTotal)}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-white/[0.08] pt-4 text-sm">
            <span className="text-[#A5ADB8]">Tổng đơn hàng</span>
            <span className="font-mono font-semibold text-[#F4F1EA]">{formatVND(order.grandTotal)}</span>
          </div>
          <OrderProductionProgress items={order.production} />
          <p className="text-xs text-[#737D89]">Thanh toán: {PAYMENT_STATUS_BADGES[order.paymentStatus].label}</p>
          {order.orderStatus === 'PENDING_PAYMENT' && order.paymentStatus === 'UNPAID' && order.payment?.verificationStatus === 'REJECTED' && (
            <p role="status" className="border-l-2 border-[#C8A261] pl-3 text-sm leading-6 text-[#A5ADB8]">{paymentRejectionNotice(order.payment.rejectionReason)}</p>
          )}
          {order.orderStatus === 'SHIPPED' && <p className="border-l-2 border-[#C8A261] pl-3 text-sm leading-6 text-[#A5ADB8]">Đơn đang được bàn giao và vận chuyển nên chưa thể hủy. Sau khi trạng thái chuyển sang “Đã giao”, bạn có thể gửi yêu cầu hoàn hàng nếu không hài lòng.</p>}
          {order.orderStatus === 'COMPLETED' && (order.paymentStatus === 'PAID' || order.returnRequest) && <OrderReturnRequestForm orderNumber={order.orderNumber} token={token} request={order.returnRequest} onSuccess={reload} />}
          {order.orderStatus === 'PENDING_PAYMENT' && order.paymentStatus === 'UNPAID' && order.payment &&
            (order.payment.verificationStatus === 'REJECTED' || !order.payment.transferredAt) && (
              <PaymentDeclarationForm orderNumber={order.orderNumber} trackingToken={token} onSuccess={reload} />
            )}
          {order.orderStatus === 'PENDING_PAYMENT' && order.paymentStatus === 'UNPAID' && order.payment?.verificationStatus === 'PENDING' && order.payment.transferredAt && (
            <p role="status" className="border-t border-white/[0.08] pt-4 text-sm text-[#C8A261]">Đã nhận khai báo chuyển khoản. Đơn đang chờ nhân viên đối soát tài khoản thực tế.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}

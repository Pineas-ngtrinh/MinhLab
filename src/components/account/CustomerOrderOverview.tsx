import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { CustomerOrderSummary } from '../../contracts/orders';

interface CustomerOrderOverviewProps {
  summary?: CustomerOrderSummary;
  isLoading: boolean;
  hasError: boolean;
}

export function CustomerOrderOverview({ summary, isLoading, hasError }: CustomerOrderOverviewProps) {
  const metrics = [
    { label: 'Chờ thanh toán', value: summary?.pendingPayment ?? 0, color: 'text-[#C8A261]' },
    { label: 'Đang xử lý hoặc giao', value: summary?.active ?? 0, color: 'text-[#F4F1EA]' },
    { label: 'Đã hoàn thành', value: summary?.completed ?? 0, color: 'text-[#F4F1EA]' },
  ];

  return (
    <section aria-labelledby="customer-order-overview" className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-[#C8A261]">Tình hình đơn hàng</p>
          <h2 id="customer-order-overview" className="mt-1 text-lg font-semibold text-[#F4F1EA]">Việc cần theo dõi</h2>
        </div>
        <Link href="/bo-suu-tap" className="inline-flex min-h-11 items-center gap-2 text-xs font-medium text-[#C8A261] hover:text-[#E2C18B] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C8A261]">
          Xem sản phẩm <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="row g-3" aria-live="polite" aria-busy={isLoading}>
        {metrics.map((metric) => (
          <div key={metric.label} className="col-12 col-md-4">
            <div className="h-full rounded-xl border border-white/[0.08] bg-[#111216] p-4">
              <p className="text-xs text-[#A5ADB8]">{metric.label}</p>
              <p className={`mt-2 font-mono text-2xl font-semibold ${metric.color}`}>
                {isLoading || hasError ? '—' : metric.value}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

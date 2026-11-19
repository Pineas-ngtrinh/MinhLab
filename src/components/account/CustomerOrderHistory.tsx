import Link from 'next/link';
import { ArrowRight, RefreshCw, ShoppingBag } from 'lucide-react';
import type { CustomerOrderData, CustomerOrderSummary } from '../../contracts/orders';
import type { PaginatedList } from '../../hooks/usePaginatedList';
import { ListPagination } from '../common/ListPagination';
import { CustomerOrderCard } from './CustomerOrderCard';

interface CustomerOrderHistoryProps {
  orderList: PaginatedList<CustomerOrderData, CustomerOrderSummary>;
}

export function CustomerOrderHistory({ orderList }: CustomerOrderHistoryProps) {
  const { data: orders, isLoading, error, reload, pagination, setPage } = orderList;

  return (
    <section aria-labelledby="customer-order-history" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 id="customer-order-history" className="text-lg sm:text-xl font-bold text-[#F4F1EA] flex items-center gap-2">
            <ShoppingBag aria-hidden="true" className="w-5 h-5 shrink-0 text-[#EB4037]" />
            <span>Lịch Sử Đơn Hàng Của Bạn</span>
          </h2>
          <p className="text-xs text-[#A5ADB8]">
            Theo dõi tình trạng đối soát thanh toán và tiến độ chế tác tại xưởng MinhLab.
          </p>
        </div>

        <button
          type="button"
          onClick={reload}
          disabled={isLoading}
          className="min-h-11 min-w-11 shrink-0 p-2 rounded-lg bg-[#141A21] hover:bg-[#1A222C] border border-[#27313C] text-[#A5ADB8] text-xs flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261] disabled:cursor-not-allowed disabled:opacity-40"
          title="Tải lại đơn hàng"
          aria-label="Tải lại danh sách đơn hàng"
        >
          <RefreshCw aria-hidden="true" className={`w-3.5 h-3.5 motion-reduce:animate-none ${isLoading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Làm mới</span>
        </button>
      </div>

      {error ? (
        <div role="alert" className="p-8 text-center rounded-2xl bg-[#141A21] border border-[#EB4037]/30 space-y-3">
          <p className="text-sm text-[#FF8179]">{error}</p>
          <button type="button" onClick={reload} className="min-h-11 px-3 text-xs text-[#C8A261] underline underline-offset-4 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C8A261]">
            Thử tải lại
          </button>
        </div>
      ) : isLoading ? (
        <div role="status" className="p-12 text-center rounded-2xl bg-[#141A21] border border-[#27313C]">
          <p className="text-xs font-mono text-[#A5ADB8]">Đang tải dữ liệu đơn hàng...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[#141A21] border border-[#27313C] space-y-4">
          <div aria-hidden="true" className="w-12 h-12 rounded-xl bg-[#0F141A] border border-[#27313C] flex items-center justify-center mx-auto text-[#737D89]">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-[#F4F1EA]">Bạn chưa có đơn hàng nào</h3>
            <p className="text-xs text-[#A5ADB8] max-w-sm mx-auto">
              Khám phá bộ sưu tập Art Toy độc bản hoặc gửi file 3D để chúng tôi gia công cho bạn.
            </p>
          </div>
          <Link
            href="/bo-suu-tap"
            className="inline-flex min-h-11 items-center gap-2 py-2.5 px-5 rounded-lg bg-[#EB4037] hover:bg-[#FF5147] text-white text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261]"
          >
            <span>Xem bộ sưu tập</span>
            <ArrowRight aria-hidden="true" className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => <CustomerOrderCard key={order.orderNumber} order={order} />)}
        </div>
      )}

      {!error && <ListPagination pagination={pagination} isLoading={isLoading} onPageChange={setPage} />}
    </section>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Download, RefreshCw } from 'lucide-react';
import type { AdminOverview as AdminOverviewData, AdminOverviewPeriod } from '../../contracts/admin-overview';
import { Button, EmptyState, Select, StatusBadge, Toast } from './ui';
import { formatVND } from '../../lib/format';

const periods: Array<{ value: AdminOverviewPeriod; label: string }> = [
  { value: '7d', label: '7 ngày' },
  { value: '30d', label: '30 ngày' },
  { value: '12m', label: '12 tháng' },
];
const statusLabels: Record<string, string> = {
  PENDING_PAYMENT: 'Chờ thanh toán',
  DEPOSIT_PAID: 'Đã nhận tiền cọc',
  CONFIRMED: 'Đã xác nhận',
  IN_PRODUCTION: 'Đang sản xuất',
  READY_TO_SHIP: 'Sẵn sàng giao',
  SHIPPED: 'Đang giao',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
};
const number = new Intl.NumberFormat('vi-VN');

function isOverview(value: unknown): value is AdminOverviewData {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<AdminOverviewData>;
  return typeof candidate.period === 'string' && typeof candidate.updatedAt === 'string' &&
    typeof candidate.metrics?.ordersInPeriod === 'number' && Array.isArray(candidate.trend) && Array.isArray(candidate.statuses);
}

export function AdminOverview({ onOpenOrders }: { onOpenOrders: () => void }) {
  const [period, setPeriod] = useState<AdminOverviewPeriod>('30d');
  const [revision, setRevision] = useState(0);
  const requestKey = `${period}:${revision}`;
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [settledRequestKey, setSettledRequestKey] = useState('');
  const [error, setError] = useState('');
  const loading = settledRequestKey !== requestKey;

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/overview?period=${period}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        const body: unknown = await response.json();
        if (!response.ok || typeof body !== 'object' || body === null || !('success' in body) || body.success !== true || !('data' in body) || !isOverview(body.data))
          throw new Error('Không tải được số liệu tổng quan. Vui lòng thử lại.');
        setData(body.data);
        setError('');
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(cause instanceof TypeError ? 'Không thể kết nối máy chủ. Hãy kiểm tra mạng rồi thử lại.' : cause instanceof Error ? cause.message : 'Không tải được số liệu tổng quan.');
      })
      .finally(() => { if (!controller.signal.aborted) setSettledRequestKey(requestKey); });
    return () => controller.abort();
  }, [period, requestKey]);

  const maxOrders = Math.max(1, ...((data?.trend ?? []).map((item) => item.orderCount)));
  const statusMax = Math.max(1, ...((data?.statuses ?? []).map((item) => item.count)));
  const visibleLabels = new Set([0, Math.floor((data?.trend.length ?? 0) / 2), Math.max(0, (data?.trend.length ?? 1) - 1)]);

  return (
    <section className="space-y-5" aria-labelledby="overview-title">
      <header className="flex flex-col justify-between gap-4 border-b border-admin-border pb-4 xl:flex-row xl:items-end">
        <div>
          <h1 id="overview-title" className="text-xl font-semibold tracking-tight text-admin-text">Tổng quan cửa hàng</h1>
          <p className="mt-1 text-sm text-admin-secondary">Theo dõi đơn mới, khoản thanh toán đã xác nhận và công việc đang thực hiện.</p>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-end gap-2 sm:flex sm:flex-wrap">
          <Select id="overview-period" label="Khoảng thời gian" value={period} onChange={(event) => setPeriod(event.target.value as AdminOverviewPeriod)}>
            {periods.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
          <a href={`/api/admin/overview/export?period=${period}`} title="Tệp thống kê có thể mở bằng Excel" className="inline-flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-admin-border bg-admin-surface px-2 text-xs font-medium text-admin-text hover:bg-admin-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent focus-visible:ring-offset-2 sm:px-3 sm:text-sm">
            <Download aria-hidden="true" className="h-4 w-4" /> Xuất báo cáo
          </a>
          <Button variant="secondary" onClick={() => setRevision((value) => value + 1)} disabled={loading} aria-label="Làm mới tổng quan" title="Làm mới tổng quan" className="min-h-10 px-2.5">
            <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      {error && <Toast tone="danger" message={error} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-busy={loading}>
        <Metric tone="info" title="Đơn hàng mới" value={data ? number.format(data.metrics.ordersInPeriod) : '—'} note="Theo ngày đặt hàng" />
        <Metric tone="success" title="Thanh toán đã xác nhận" value={data ? formatVND(data.metrics.confirmedPaymentsVnd) : '—'} note="Đã được nhân viên đối soát" />
        <Metric tone="warning" title="Giao dịch cần kiểm tra" value={data ? number.format(data.metrics.pendingPaymentReviews) : '—'} note="Đang chờ xử lý" />
        <Metric tone="info" title="Đơn đang sản xuất" value={data ? number.format(data.metrics.activeProductionOrders) : '—'} note="Đang được xử lý tại xưởng" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <section className="rounded-md border border-admin-border bg-admin-surface p-4 sm:p-5" aria-labelledby="order-trend-title">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="order-trend-title" className="text-sm font-semibold text-admin-text">Số lượng đơn hàng</h2>
              <p className="mt-1 text-xs text-admin-muted">Đơn đặt theo {period === '12m' ? 'tháng' : 'ngày'} · giờ Việt Nam</p>
            </div>
            <Button variant="quiet" onClick={onOpenOrders} className="min-h-8 px-1.5 text-admin-accent">Xem đơn hàng <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" /></Button>
          </div>
          {loading && !data ? <div className="mt-5 h-44 animate-pulse rounded-md bg-admin-subtle motion-reduce:animate-none" role="status">Đang tải biểu đồ…</div>
            : data?.trend.length ? <div className="mt-5" role="img" aria-label={`Số lượng đơn trong ${periods.find((item) => item.value === period)?.label}`}>
              <div className="flex h-44 items-end gap-1 border-b border-l border-admin-border px-2">
                {data.trend.map((item, index) => {
                  const height = item.orderCount / maxOrders * 100;
                  return <div key={item.key} title={`${item.label}: ${item.orderCount} đơn`} className="group relative flex h-full min-w-0 flex-1 items-end">
                    <div className="w-full rounded-t-sm bg-admin-info transition-colors duration-150 group-hover:bg-admin-text" style={{ height: `${height}%` }} />
                    {item.orderCount > 0 && <span aria-hidden="true" className="absolute left-1/2 -translate-x-1/2 text-[11px] font-medium tabular-nums text-admin-info" style={{ bottom: `calc(${height}% + 4px)` }}>{item.orderCount}</span>}
                    <span className="sr-only">{item.label}: {item.orderCount} đơn</span>
                    {visibleLabels.has(index) && <span aria-hidden="true" className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] tabular-nums text-admin-muted">{item.label}</span>}
                  </div>;
                })}
              </div>
              <div className="mt-9 flex flex-wrap items-center justify-between gap-2 text-xs text-admin-muted">
                <span>{number.format(data.metrics.ordersInPeriod)} đơn trong khoảng thời gian này</span>
                <span>Cập nhật lúc {new Date(data.updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}</span>
              </div>
            </div> : <EmptyState title="Chưa có đơn trong khoảng thời gian này" description="Đơn hàng sẽ xuất hiện tại đây khi khách đặt mua." />}
        </section>

        <section className="rounded-md border border-admin-border bg-admin-surface p-4 sm:p-5" aria-labelledby="order-status-title">
          <h2 id="order-status-title" className="text-sm font-semibold text-admin-text">Trạng thái đơn hàng hiện tại</h2>
          <p className="mt-1 text-xs text-admin-muted">Tính trên toàn bộ đơn hàng, không phụ thuộc khoảng thời gian đã chọn.</p>
          {data?.statuses.length ? <ul className="mt-4 space-y-3">
            {data.statuses.map((item) => <li key={item.status} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-xs">
              <StatusBadge tone={statusTone(item.status)}>{statusLabels[item.status] ?? 'Trạng thái khác'}</StatusBadge>
                <span className="font-medium tabular-nums text-admin-text">{number.format(item.count)}</span>
              </div>
              <div className="h-1 overflow-hidden rounded bg-admin-subtle"><div className={`h-full rounded ${statusBarClass(item.status)}`} style={{ width: `${Math.max(3, item.count / statusMax * 100)}%` }} /></div>
            </li>)}
          </ul> : <EmptyState title="Chưa có đơn hàng" />}
        </section>
      </div>

      <section className="border-t border-admin-border pt-4" aria-labelledby="quick-actions-title">
        <h2 id="quick-actions-title" className="mb-2 text-xs font-semibold uppercase tracking-wide text-admin-muted">Truy cập nhanh</h2>
        <div className="grid gap-x-5 sm:grid-cols-2 xl:grid-cols-4">
          <Shortcut asButton onClick={onOpenOrders} title="Xử lý đơn hàng" detail="Cập nhật trạng thái và giao hàng" />
          <Shortcut href="/admin/san-pham" title="Quản lý sản phẩm" detail="Hình ảnh, biến thể và định mức" />
          <Shortcut href="/admin/san-xuat" title="Kế hoạch sản xuất" detail="Kế hoạch in, công việc và kiểm tra chất lượng" />
          <Shortcut href="/admin/nhan-su" title="Quyền nhân viên" detail="Quản lý quyền truy cập xưởng" />
        </div>
      </section>
    </section>
  );
}

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' | 'info' {
  if (status === 'COMPLETED') return 'success';
  if (status === 'CANCELLED') return 'danger';
  if (status === 'PENDING_PAYMENT') return 'warning';
  if (status === 'IN_PRODUCTION' || status === 'CONFIRMED') return 'info';
  return 'neutral';
}

function statusBarClass(status: string): string {
  if (status === 'COMPLETED') return 'bg-admin-success';
  if (status === 'CANCELLED') return 'bg-admin-danger';
  if (status === 'PENDING_PAYMENT') return 'bg-admin-warning';
  if (status === 'IN_PRODUCTION' || status === 'CONFIRMED') return 'bg-admin-info';
  return 'bg-admin-secondary';
}

function Metric({ title, value, note, tone }: { title: string; value: string; note: string; tone: 'info' | 'success' | 'warning' }) {
  const tones = {
    info: { border: 'border-t-admin-info', text: 'text-admin-info' },
    success: { border: 'border-t-admin-success', text: 'text-admin-success' },
    warning: { border: 'border-t-admin-warning', text: 'text-admin-warning' },
  };
  return <article className={`min-w-0 rounded-md border border-t-2 border-admin-border bg-admin-surface p-3 sm:p-4 ${tones[tone].border}`}><h2 className="text-xs font-medium text-admin-secondary">{title}</h2><p className={`mt-2 text-base font-semibold leading-6 tracking-tight tabular-nums min-[360px]:text-lg sm:text-2xl ${tones[tone].text}`}>{value}</p><p className="mt-1 text-xs text-admin-muted">{note}</p></article>;
}

function Shortcut({ title, detail, href, onClick, asButton = false }: { title: string; detail: string; href?: string; onClick?: () => void; asButton?: boolean }) {
  const className = 'group flex min-h-[60px] items-center justify-between gap-3 border-b border-admin-border py-3 text-left transition-colors hover:text-admin-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent';
  const content = <><span><span className="block text-sm font-medium text-admin-text">{title}</span><span className="mt-1 block text-xs text-admin-muted">{detail}</span></span><ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0 text-admin-accent transition-transform group-hover:translate-x-0.5" /></>;
  if (asButton) return <button type="button" onClick={onClick} className={className}>{content}</button>;
  return <Link href={href ?? '/admin'} className={className}>{content}</Link>;
}

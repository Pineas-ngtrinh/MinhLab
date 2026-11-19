import {
  ADMIN_OVERVIEW_PERIODS,
  type AdminOverview,
  type AdminOverviewPeriod,
} from '../contracts/admin-overview';
import { AppError } from '../lib/errors';
import { adminOverviewRepository } from '../repositories/admin/admin-overview.repository';

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Chờ thanh toán',
  DEPOSIT_PAID: 'Đã cọc',
  CONFIRMED: 'Đã xác nhận',
  IN_PRODUCTION: 'Đang sản xuất',
  READY_TO_SHIP: 'Chờ giao hàng',
  SHIPPED: 'Đang giao',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
};
const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: 'Chưa thanh toán',
  PARTIALLY_PAID: 'Đã thanh toán một phần',
  PAID: 'Đã thanh toán',
  PARTIALLY_REFUNDED: 'Đã hoàn một phần',
  REFUNDED: 'Đã hoàn tiền',
};

export function parseAdminOverviewPeriod(value: string | null): AdminOverviewPeriod {
  const period = value ?? '30d';
  if (ADMIN_OVERVIEW_PERIODS.includes(period as AdminOverviewPeriod)) return period as AdminOverviewPeriod;
  throw new AppError('Khoảng thời gian báo cáo không hợp lệ.', 400);
}

function getPeriodRange(period: AdminOverviewPeriod, now: Date) {
  const local = new Date(now.getTime() + VN_OFFSET_MS);
  const fromLocal = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
  if (period === '12m') {
    fromLocal.setUTCDate(1);
    fromLocal.setUTCMonth(fromLocal.getUTCMonth() - 11);
  } else {
    fromLocal.setUTCDate(fromLocal.getUTCDate() - (period === '7d' ? 6 : 29));
  }
  return {
    from: new Date(fromLocal.getTime() - VN_OFFSET_MS).toISOString(),
    to: now.toISOString(),
    granularity: period === '12m' ? 'month' as const : 'day' as const,
    bucketCount: period === '7d' ? 7 : period === '30d' ? 30 : 12,
  };
}

function trendBuckets(period: AdminOverviewPeriod, range: ReturnType<typeof getPeriodRange>, rows: Array<{ key: string; order_count: number }>) {
  const counts = new Map(rows.map((row) => [row.key, row.order_count]));
  const cursor = new Date(new Date(range.from).getTime() + VN_OFFSET_MS);
  const buckets: AdminOverview['trend'] = [];
  for (let index = 0; index < range.bucketCount; index += 1) {
    const year = cursor.getUTCFullYear();
    const month = String(cursor.getUTCMonth() + 1).padStart(2, '0');
    const day = String(cursor.getUTCDate()).padStart(2, '0');
    const key = period === '12m' ? `${year}-${month}` : `${year}-${month}-${day}`;
    buckets.push({
      key,
      label: period === '12m' ? `${month}/${String(year).slice(-2)}` : `${day}/${month}`,
      orderCount: counts.get(key) ?? 0,
    });
    if (period === '12m') cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    else cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return buckets;
}

export async function getAdminOverview(period: AdminOverviewPeriod, now = new Date()): Promise<AdminOverview> {
  const range = getPeriodRange(period, now);
  const result = await adminOverviewRepository.read(range);
  const summary = result.summary;
  return {
    period,
    updatedAt: now.toISOString(),
    metrics: {
      ordersInPeriod: Number(summary?.orders_in_period ?? 0),
      confirmedPaymentsVnd: Number(summary?.confirmed_payments_vnd ?? 0),
      pendingPaymentReviews: Number(summary?.pending_payment_reviews ?? 0),
      activeProductionOrders: Number(summary?.active_production_orders ?? 0),
    },
    trend: trendBuckets(period, range, result.trend),
    statuses: [...result.statuses].sort((left, right) => right.count - left.count),
  };
}

function csvCell(value: string | number): string {
  const raw = String(value);
  const safe = /^[\t\r ]*[=+@-]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

export async function createAdminOrdersCsv(period: AdminOverviewPeriod, now = new Date()): Promise<string> {
  const range = getPeriodRange(period, now);
  const orders = await adminOverviewRepository.readOrdersForExport(range);
  const lines = [
    'sep=;',
    ['Mã đơn', 'Ngày đặt', 'Trạng thái đơn', 'Trạng thái thanh toán', 'Tổng đơn (VND)', 'Đã xác nhận thu (VND)'].map(csvCell).join(';'),
    ...orders.map((order) => [
      order.order_number,
      order.placed_at,
      ORDER_STATUS_LABELS[order.order_status] ?? order.order_status,
      PAYMENT_STATUS_LABELS[order.payment_status] ?? order.payment_status,
      order.grand_total,
      order.confirmed_paid,
    ].map(csvCell).join(';')),
  ];
  return `\uFEFF${lines.join('\r\n')}`;
}

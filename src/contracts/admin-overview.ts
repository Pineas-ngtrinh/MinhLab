export const ADMIN_OVERVIEW_PERIODS = ['7d', '30d', '12m'] as const;
export type AdminOverviewPeriod = (typeof ADMIN_OVERVIEW_PERIODS)[number];

export interface AdminOverview {
  period: AdminOverviewPeriod;
  updatedAt: string;
  metrics: {
    ordersInPeriod: number;
    confirmedPaymentsVnd: number;
    pendingPaymentReviews: number;
    activeProductionOrders: number;
  };
  trend: Array<{ key: string; label: string; orderCount: number }>;
  statuses: Array<{ status: string; count: number }>;
}

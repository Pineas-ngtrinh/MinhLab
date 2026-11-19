import { query } from '../../lib/db';

export interface AdminOrderExportRow {
  order_number: string;
  placed_at: string;
  order_status: string;
  payment_status: string;
  grand_total: string;
  confirmed_paid: string;
}

export const adminOverviewRepository = {
  async read(input: { from: string; to: string; granularity: 'day' | 'month' }) {
    const [summary, trend, statuses] = await Promise.all([
      query<{
        orders_in_period: number;
        confirmed_payments_vnd: string;
        pending_payment_reviews: number;
        active_production_orders: number;
      }>(
        `SELECT
           (SELECT count(*)::integer FROM orders WHERE placed_at >= $1 AND placed_at <= $2) AS orders_in_period,
           (SELECT COALESCE(sum(amount),0)::text FROM payments
             WHERE verification_status IN ('VERIFIED','REFUNDED') AND verified_at >= $1 AND verified_at <= $2) AS confirmed_payments_vnd,
           (SELECT count(*)::integer FROM payments p JOIN orders o ON o.id=p.order_id
             WHERE p.verification_status='PENDING' AND p.transferred_at IS NOT NULL
               AND o.order_status='PENDING_PAYMENT' AND o.payment_status='UNPAID'
               AND o.admin_archived_at IS NULL) AS pending_payment_reviews,
           (SELECT count(*)::integer FROM orders WHERE order_status='IN_PRODUCTION') AS active_production_orders`,
        [input.from, input.to],
      ),
      query<{ key: string; order_count: number }>(
        `SELECT to_char(date_trunc($3::text, placed_at AT TIME ZONE 'Asia/Ho_Chi_Minh'),
                        CASE WHEN $3='day' THEN 'YYYY-MM-DD' ELSE 'YYYY-MM' END) AS key,
                count(*)::integer AS order_count
           FROM orders
          WHERE placed_at >= $1 AND placed_at <= $2
          GROUP BY 1 ORDER BY 1`,
        [input.from, input.to, input.granularity],
      ),
      query<{ status: string; count: number }>(
        `SELECT order_status AS status,count(*)::integer AS count
           FROM orders GROUP BY order_status ORDER BY order_status`,
      ),
    ]);
    return {
      summary: summary.rows[0],
      trend: trend.rows,
      statuses: statuses.rows,
    };
  },

  async readOrdersForExport(input: { from: string; to: string }) {
    const result = await query<AdminOrderExportRow>(
      `SELECT o.order_number,
              to_char(o.placed_at AT TIME ZONE 'Asia/Ho_Chi_Minh','YYYY-MM-DD HH24:MI:SS') AS placed_at,
              o.order_status,o.payment_status,o.grand_total::text,
              COALESCE(sum(p.amount) FILTER (WHERE p.verification_status IN ('VERIFIED','REFUNDED')),0)::text AS confirmed_paid
         FROM orders o
         LEFT JOIN payments p ON p.order_id=o.id
        WHERE o.placed_at >= $1 AND o.placed_at <= $2
        GROUP BY o.id
        ORDER BY o.placed_at,o.order_number`,
      [input.from, input.to],
    );
    return result.rows;
  },
};

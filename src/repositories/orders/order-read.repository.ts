import { pageInfo } from "../../lib/pagination";
import type { PageOptions } from "../../contracts/pagination";
import { query } from "../../lib/db";
import type {
  Order,
  OrderItem,
  Payment,
  PaymentAttachment,
} from "../../domain/orders/order";
import type { OrderReturnRequest, OrderReturnStatus } from '../../domain/orders/order-return';
import type { OrderReadRepository } from "../../services/orders/order.ports";
import {
  ORDER_COLUMNS,
  PAYMENT_COLUMNS,
  toOrder,
  toOrderItem,
  toPayment,
  toAttachment,
  type OrderRow,
  type OrderItemRow,
  type PaymentRow,
  type AttachmentRow,
} from "./order-mapping";

async function loadAttachments(
  paymentIds: string[],
): Promise<Map<string, PaymentAttachment[]>> {
  if (paymentIds.length === 0) return new Map();
  const result = await query<AttachmentRow>(
    `SELECT a.id, a.entity_id,
            CASE WHEN f.storage_provider='LOCAL_PRIVATE'
              THEN '/api/admin/payments/' || a.entity_id || '/proof/' || f.id
              ELSE f.secure_url END AS file_url,
            a.created_at
       FROM attachments a
       JOIN file_assets f ON f.id = a.file_asset_id
      WHERE a.entity_type = 'PAYMENT' AND a.entity_id = ANY($1::uuid[])
        AND a.is_current = true
        AND (f.storage_provider<>'LOCAL_PRIVATE' OR
          (f.upload_status='AVAILABLE' AND f.malware_scan_status='CLEAN'))
      ORDER BY a.sort_order, a.created_at`,
    [paymentIds],
  );
  const grouped = new Map<string, PaymentAttachment[]>();
  for (const row of result.rows) {
    const list = grouped.get(row.entity_id) ?? [];
    list.push(toAttachment(row));
    grouped.set(row.entity_id, list);
  }
  return grouped;
}

async function loadOrderRelations(orders: Order[]) {
  if (orders.length === 0) return [];
  const ids = orders.map((order) => order.id);
  const [itemResult, paymentResult, returnResult] = await Promise.all([
    query<OrderItemRow>(
      `SELECT id, order_id, item_type, item_name_snapshot, quantity,
              unit_price AS "unitPrice", line_total, color_snapshot, material_snapshot
         FROM order_items WHERE order_id = ANY($1::uuid[]) ORDER BY id`,
      [ids],
    ),
    query<PaymentRow>(
      `SELECT DISTINCT ON (order_id) ${PAYMENT_COLUMNS} FROM payments WHERE order_id = ANY($1::uuid[]) ORDER BY order_id, created_at DESC, id DESC`,
      [ids],
    ),
    query<{
      id: string;
      order_id: string;
      status: OrderReturnStatus;
      reason: string;
      requested_at: Date | string;
      received_at: Date | string | null;
      refunded_at: Date | string | null;
      amount: number | string | null;
      transaction_reference: string | null;
    }>(
      `SELECT r.id,r.order_id,r.status,r.reason,r.requested_at,r.received_at,
              r.refunded_at,f.amount,f.transaction_reference
         FROM order_return_requests r
         LEFT JOIN refunds f ON f.return_request_id=r.id AND f.status='COMPLETED'
        WHERE r.order_id = ANY($1::uuid[])`,
      [ids],
    ),
  ]);
  const payments = paymentResult.rows.map(toPayment);
  const attachmentMap = await loadAttachments(
    payments.map((payment) => payment.id),
  );
  const itemsByOrder = new Map<string, OrderItem[]>();
  for (const row of itemResult.rows) {
    const list = itemsByOrder.get(row.order_id) ?? [];
    list.push(toOrderItem(row));
    itemsByOrder.set(row.order_id, list);
  }
  const paymentByOrder = new Map<string, Payment>();
  for (const payment of payments) {
    if (!paymentByOrder.has(payment.orderId))
      paymentByOrder.set(payment.orderId, payment);
  }
  const returnByOrder = new Map<string, OrderReturnRequest>();
  for (const row of returnResult.rows) {
    const asIso = (value: Date | string | null) => value
      ? value instanceof Date ? value.toISOString() : new Date(value).toISOString()
      : undefined;
    returnByOrder.set(row.order_id, {
      id: row.id,
      orderId: row.order_id,
      status: row.status,
      reason: row.reason,
      requestedAt: asIso(row.requested_at)!,
      receivedAt: asIso(row.received_at),
      refundedAt: asIso(row.refunded_at),
      refundedAmount: row.amount === null ? undefined : Number(row.amount),
      transactionReference: row.transaction_reference ?? undefined,
    });
  }
  return orders.map((order) => {
    const payment = paymentByOrder.get(order.id);
    return {
      order,
      items: itemsByOrder.get(order.id) ?? [],
      payment,
      returnRequest: returnByOrder.get(order.id),
      attachments: payment ? (attachmentMap.get(payment.id) ?? []) : [],
    };
  });
}

async function getOrderDetail(orderNumber: string) {
  const result = await query<OrderRow>(
    `SELECT ${ORDER_COLUMNS} FROM orders WHERE order_number = $1`,
    [orderNumber],
  );
  if (!result.rows[0]) return null;
  const [detail] = await loadOrderRelations([toOrder(result.rows[0])]);
  return detail;
}

async function getOrdersPage(options: PageOptions) {
  const values = [options.status ?? null, options.search ?? null];
  const [count, result] = await Promise.all([
    query<{ total: string }>(
      `SELECT count(*) AS total FROM orders
        WHERE admin_archived_at IS NULL
          AND ($1::varchar IS NULL OR order_status = $1)
          AND ($2::text IS NULL OR order_number ILIKE '%'||$2||'%'
            OR customer_name_snapshot ILIKE '%'||$2||'%'
            OR customer_email_snapshot ILIKE '%'||$2||'%'
            OR customer_phone_snapshot ILIKE '%'||$2||'%')`,
      values,
    ),
    query<OrderRow>(
      `SELECT ${ORDER_COLUMNS} FROM orders
        WHERE admin_archived_at IS NULL
          AND ($1::varchar IS NULL OR order_status = $1)
          AND ($2::text IS NULL OR order_number ILIKE '%'||$2||'%'
            OR customer_name_snapshot ILIKE '%'||$2||'%'
            OR customer_email_snapshot ILIKE '%'||$2||'%'
            OR customer_phone_snapshot ILIKE '%'||$2||'%')
        ORDER BY created_at DESC, id DESC LIMIT $3 OFFSET $4`,
      [...values, options.pageSize, (options.page - 1) * options.pageSize],
    ),
  ]);
  return {
    data: await loadOrderRelations(result.rows.map(toOrder)),
    pagination: pageInfo(options, Number(count.rows[0].total)),
  };
}

async function getPaymentsPage(options: PageOptions) {
  const values = [options.status ?? null];
  const [count, result] = await Promise.all([
    query<{ total: string }>(
      `SELECT count(*) AS total FROM payments
        WHERE order_id IN (SELECT id FROM orders WHERE admin_archived_at IS NULL)
          AND ($1::varchar IS NULL OR verification_status = $1)`,
      values,
    ),
    query<PaymentRow>(
      `SELECT ${PAYMENT_COLUMNS} FROM payments
        WHERE order_id IN (SELECT id FROM orders WHERE admin_archived_at IS NULL)
          AND ($1::varchar IS NULL OR verification_status = $1)
      ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3`,
      [...values, options.pageSize, (options.page - 1) * options.pageSize],
    ),
  ]);
  const payments = result.rows.map(toPayment);
  const orders = payments.length
    ? await query<OrderRow>(
        `SELECT ${ORDER_COLUMNS} FROM orders WHERE id = ANY($1::uuid[])`,
        [payments.map((payment) => payment.orderId)],
      )
    : { rows: [] };
  const orderById = new Map(orders.rows.map((row) => [row.id, toOrder(row)]));
  const attachments = await loadAttachments(
    payments.map((payment) => payment.id),
  );
  return {
    data: payments.map((payment) => ({
      payment,
      order: orderById.get(payment.orderId),
      attachments: attachments.get(payment.id) ?? [],
    })),
    pagination: pageInfo(options, Number(count.rows[0].total)),
  };
}

async function getCustomerOrdersPage(customerId: string, options: PageOptions) {
  const [counts,result] = await Promise.all([
    query<{total: string; pending: string; active: string; completed: string; matched: string}>(`SELECT count(*) AS total,
      count(*) FILTER (WHERE order_status='PENDING_PAYMENT') AS pending,
      count(*) FILTER (WHERE order_status IN ('CONFIRMED','DEPOSIT_PAID','IN_PRODUCTION','READY_TO_SHIP','SHIPPED')) AS active,
      count(*) FILTER (WHERE order_status='COMPLETED') AS completed,
      count(*) FILTER (WHERE $2::varchar IS NULL OR order_status=$2) AS matched
      FROM orders WHERE customer_id=$1::uuid`,[customerId,options.status ?? null]),
    query<OrderRow>(`SELECT ${ORDER_COLUMNS} FROM orders WHERE customer_id=$1::uuid
      AND ($2::varchar IS NULL OR order_status=$2) ORDER BY created_at DESC,id DESC LIMIT $3 OFFSET $4`,
      [customerId,options.status ?? null,options.pageSize,(options.page-1)*options.pageSize]),
  ]);
  const count = counts.rows[0];
  return {data:await loadOrderRelations(result.rows.map(toOrder)),pagination:pageInfo(options,Number(count.matched)),
    summary:{total:Number(count.total),pendingPayment:Number(count.pending),active:Number(count.active),completed:Number(count.completed)}};
}
async function hasTrackingAccess(number: string, hash: string) {
  const result = await query<{ allowed: boolean }>(
    `SELECT EXISTS (
    SELECT 1 FROM order_tracking_tokens t JOIN orders o ON o.id = t.order_id
    WHERE o.order_number = $1 AND t.token_hash = $2 AND t.expires_at > now()
  ) AS allowed`,
    [number, hash],
  );
  return result.rows[0]?.allowed === true;
}
async function isOwner(number: string, customerId: string) {
  const result = await query<{ allowed: boolean }>(
    `SELECT EXISTS (
    SELECT 1 FROM orders WHERE order_number = $1 AND customer_id = $2::uuid
  ) AS allowed`,
    [number, customerId],
  );
  return result.rows[0]?.allowed === true;
}
export const orderReadRepository: OrderReadRepository = {
  getOrderDetail,
  getCustomerOrdersPage,
  getOrdersPage,
  getPaymentsPage,
  hasTrackingAccess,
  isOwner,
};

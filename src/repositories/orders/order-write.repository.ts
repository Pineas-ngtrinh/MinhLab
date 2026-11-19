import type { PoolClient } from 'pg';
import type { Order, OrderStatus } from '../../domain/orders/order';
import type { DeclarePaymentInput } from '../../contracts/orders';
import type { NewOrder, OrderWriteRepository, PricedOrderItem } from '../../services/orders/order.ports';
import { ORDER_COLUMNS, PAYMENT_COLUMNS, asNumber, toOrder, toOrderItem, toPayment,
  type OrderRow, type OrderItemRow, type PaymentRow, type NumericValue } from './order-mapping';

const ITEM_COLUMNS = `id, order_id, item_type, item_name_snapshot, quantity,
  unit_price AS "unitPrice", line_total, color_snapshot, material_snapshot`;

/** All instances in one application transaction share its PoolClient. */
export class PostgresOrderWriteRepository implements OrderWriteRepository {
  constructor(private readonly client: PoolClient) {}

  async lockOrder(number: string) {
    const result = await this.client.query<OrderRow>(
      `SELECT ${ORDER_COLUMNS} FROM orders WHERE order_number = $1 AND admin_archived_at IS NULL FOR UPDATE`, [number]);
    return result.rows[0] ? toOrder(result.rows[0]) : null;
  }

  async latestPayment(orderId: string) {
    const result = await this.client.query<PaymentRow>(`SELECT ${PAYMENT_COLUMNS} FROM payments
      WHERE order_id = $1 ORDER BY created_at DESC, id DESC LIMIT 1 FOR UPDATE`, [orderId]);
    return result.rows[0] ? toPayment(result.rows[0]) : null;
  }

  async isPaymentVerifier(userId: string, telegramUserId?: string) {
    const result = await this.client.query<{ id: string }>(
      `SELECT u.id
         FROM users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id AND r.is_active = true
        WHERE u.id = $1 AND u.status = 'ACTIVE' AND u.deleted_at IS NULL
          AND r.code IN ('ADMIN') AND ($2::varchar IS NULL OR u.telegram_user_id=$2)`,
      [userId, telegramUserId ?? null],
    );
    return result.rows.length > 0;
  }

  async orderItems(orderId: string) {
    const result = await this.client.query<OrderItemRow>(
      `SELECT ${ITEM_COLUMNS} FROM order_items WHERE order_id = $1 ORDER BY id`, [orderId]);
    return result.rows.map(toOrderItem);
  }

  async lockCheckout(keyHash: string) {
    await this.client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [keyHash]);
    const result = await this.client.query<OrderRow & { checkout_request_hash: string }>(
      `SELECT ${ORDER_COLUMNS}, checkout_request_hash FROM orders WHERE checkout_key_hash = $1`, [keyHash]);
    const row = result.rows[0];
    return row ? { order: toOrder(row), requestHash: row.checkout_request_hash } : null;
  }

  async findVariant(productId: string, color: string | undefined, requirePublished: boolean, variantId?: string) {
    const result = await this.client.query<{
      id: string; sku: string; name: string; sale_price: NumericValue; color_name: string | null; material_description: string | null;
    }>(`SELECT v.id, v.sku, p.name, v.sale_price, v.color_name, p.material_description
      FROM product_variants v JOIN products p ON p.id = v.product_id
      WHERE p.slug = $1 AND v.status = 'ACTIVE'
        AND p.publication_status IN ('DRAFT','PUBLISHED') AND p.compliance_status <> 'REJECTED'
        AND ($3::boolean = false OR (p.publication_status = 'PUBLISHED' AND p.compliance_status = 'APPROVED'))
        AND ($4::uuid IS NULL OR v.id = $4::uuid)
        AND ($4::uuid IS NOT NULL OR $2::varchar IS NULL OR v.color_name = $2)
      ORDER BY v.created_at, v.id LIMIT 1`, [productId, color ?? null, requirePublished, variantId ?? null]);
    const row = result.rows[0];
    return row ? { id: row.id, sku: row.sku, name: row.name, price: asNumber(row.sale_price),
      color: row.color_name ?? undefined, material: row.material_description ?? undefined } : null;
  }

  async createOrder(input: NewOrder) {
    const customer = input.customer;
    const result = await this.client.query<OrderRow>(`INSERT INTO orders (
      order_number, customer_id, customer_name_snapshot, customer_email_snapshot,
      customer_phone_snapshot, shipping_recipient_name, shipping_recipient_phone,
      shipping_address_line, shipping_province_name, order_status, payment_status,
      payment_timing, currency, subtotal, shipping_fee, grand_total,
      required_deposit_amount, customer_note, placed_at
    ) VALUES ($1,$2,$3,$4,$5,$3,$5,$6,'Việt Nam',$7,'UNPAID',$8,'VND',$9,$10,$11,$12,$13,$14)
    RETURNING ${ORDER_COLUMNS}`, [input.orderNumber, input.customerId ?? null,
      customer.customerName.trim(), customer.customerEmail.trim(), customer.customerPhone.trim(),
      customer.shippingAddress.trim(), input.status, input.timing, input.subtotal, input.shippingFee,
      input.grandTotal, input.requiredDepositAmount, customer.customerNote?.trim() || null, input.placedAt]);
    return toOrder(result.rows[0]);
  }

  async addItem(orderId: string, input: PricedOrderItem) {
    const result = await this.client.query<OrderItemRow>(`INSERT INTO order_items (
      order_id, product_variant_id, print_specification_id, item_type, item_name_snapshot,
      sku_snapshot, material_snapshot, color_snapshot, specification_snapshot, quantity, unit_price, line_total, manufacturing_revision_id
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12,
      (SELECT id FROM manufacturing_revisions WHERE kind='BOM' AND variant_id=$2 AND status='PUBLISHED'
       ORDER BY published_at DESC,revision DESC,id DESC LIMIT 1)) RETURNING ${ITEM_COLUMNS}`,
    [orderId, input.productVariantId, input.printSpecificationId ?? null, input.itemType,
      input.itemName.slice(0, 200), input.skuSnapshot, input.material?.slice(0, 80) ?? null,
      input.color?.slice(0, 60) ?? null,
      input.itemType === 'CUSTOM_PRINT' && input.printSpecificationId
        ? JSON.stringify({ printSpecificationId: input.printSpecificationId }) : null,
      input.quantity, input.unitPrice, input.unitPrice * input.quantity]);
    return toOrderItem(result.rows[0]);
  }

  async productionTransitionBlocker(orderId: string, next: OrderStatus) {
    if (next === 'CANCELLED') {
      const activeJobs = await this.client.query(`SELECT j.id FROM production_jobs j
        LEFT JOIN order_items direct_item ON direct_item.id=j.order_item_id
        LEFT JOIN production_supplies s ON s.job_id=j.id
        LEFT JOIN order_items supply_item ON supply_item.id=s.order_item_id
        WHERE (direct_item.order_id=$1 OR supply_item.order_id=$1)
          AND j.status NOT IN ('COMPLETED','FAILED','CANCELLED')`, [orderId]);
      if (activeJobs.rowCount) return 'Đơn đang có công việc sản xuất chưa kết thúc; cần xử lý tại hàng đợi trước khi xóa.';
    }
    const managed = await this.client.query(`SELECT i.id FROM order_items i LEFT JOIN production_requirements r ON r.order_item_id=i.id
      WHERE i.order_id=$1 AND (i.manufacturing_revision_id IS NOT NULL OR r.order_item_id IS NOT NULL OR EXISTS(SELECT 1 FROM orders o WHERE o.id=i.order_id AND o.accepted_quote_id IS NOT NULL))`, [orderId]);
    if (!managed.rowCount) return null;
    if (next === 'IN_PRODUCTION') return 'Ghi nhận bắt đầu thực tế trong bàn sản xuất; không đổi trạng thái đơn để bỏ qua job.';
    if (next === 'READY_TO_SHIP') {
      const pending = await this.client.query(`SELECT i.id FROM order_items i LEFT JOIN production_requirements r ON r.order_item_id=i.id
        WHERE i.order_id=$1 AND ((i.item_type='READY_PRODUCT' AND r.dispatch_ready_at IS NULL) OR (i.item_type='CUSTOM_PRINT' AND i.custom_dispatch_ready_at IS NULL))`, [orderId]);
      if (pending.rowCount) return 'Chưa hoàn tất QC và đóng gói đủ mọi dòng của đơn.';
    }
    if (next === 'CANCELLED') {
      const assigned = await this.client.query(`SELECT r.order_item_id FROM production_requirements r JOIN order_items i ON i.id=r.order_item_id WHERE i.order_id=$1 AND r.group_id IS NOT NULL`, [orderId]);
      if (assigned.rowCount) return 'Đơn có allocation sản xuất; cần xử lý tài nguyên trước khi hủy.';
    }
    return null;
  }

  async saveCheckoutHashes(orderId: string, key: string, request: string) {
    await this.client.query('UPDATE orders SET checkout_key_hash = $2, checkout_request_hash = $3 WHERE id = $1', [orderId, key, request]);
  }

  async addTrackingToken(orderId: string, hash: string) {
    await this.client.query(`INSERT INTO order_tracking_tokens (order_id, token_hash, expires_at)
      VALUES ($1, $2, now() + interval '90 days')`, [orderId, hash]);
  }

  async createPrepayment(order: Order, destination: import('../../contracts/payments').BankDestination) {
    const result = await this.client.query<PaymentRow>(`INSERT INTO payments (
      order_id, payment_number, payment_method, payment_purpose, amount, currency, verification_status,receiving_account
    ) VALUES ($1,$2,'VIETQR','FULL_PAYMENT',$3,'VND','PENDING',$4::jsonb) RETURNING ${PAYMENT_COLUMNS}`,
    [order.id, `PAY-${order.orderNumber.slice(3)}`, order.grandTotal,JSON.stringify(destination)]);
    return toPayment(result.rows[0]);
  }

  async declarePayment(id: string, input: DeclarePaymentInput) {
    const result = await this.client.query<PaymentRow>(`UPDATE payments
      SET transaction_reference=$2, bank_name=$3, sender_account_name=$4, transferred_at=now(),
        verification_status='PENDING', verified_by=NULL, verified_at=NULL, rejection_reason=NULL
      WHERE id=$1 RETURNING ${PAYMENT_COLUMNS}`,
      [id, input.transactionReference?.trim() || null, input.bankName?.trim() || null, input.senderAccountName?.trim() || null]);
    return toPayment(result.rows[0]);
  }

  async verifyPayment(id: string, actorId: string | null, telegramUserId?: string) {
    const result = await this.client.query<PaymentRow>(`UPDATE payments p SET verification_status='VERIFIED',
      verified_by=$2, verified_at=now(), rejection_reason=NULL WHERE p.id=$1 AND EXISTS (
        SELECT 1 FROM users u JOIN user_roles ur ON ur.user_id=u.id
        JOIN roles r ON r.id=ur.role_id AND r.is_active=true
        WHERE u.id=$2 AND u.status='ACTIVE' AND u.deleted_at IS NULL AND r.code IN ('ADMIN')
      AND ($3::varchar IS NULL OR u.telegram_user_id=$3)
      ) RETURNING ${PAYMENT_COLUMNS}`, [id, actorId, telegramUserId ?? null]);
    return result.rows[0] ? toPayment(result.rows[0]) : null;
  }

  async rejectPayment(id: string, actorId: string | null, reason: string, telegramUserId?: string) {
    const result = await this.client.query<PaymentRow>(`UPDATE payments p SET verification_status='REJECTED',
      verified_by=$2, rejection_reason=$3, verified_at=now() WHERE p.id=$1 AND EXISTS (
        SELECT 1 FROM users u JOIN user_roles ur ON ur.user_id=u.id
        JOIN roles r ON r.id=ur.role_id AND r.is_active=true
        WHERE u.id=$2 AND u.status='ACTIVE' AND u.deleted_at IS NULL AND r.code IN ('ADMIN')
      AND ($4::varchar IS NULL OR u.telegram_user_id=$4)
      ) RETURNING ${PAYMENT_COLUMNS}`, [id, actorId, reason, telegramUserId ?? null]);
    return result.rows[0] ? toPayment(result.rows[0]) : null;
  }

  async confirmPaidOrder(id: string) {
    const result = await this.client.query<OrderRow>(`UPDATE orders SET payment_status='PAID',
      order_status='CONFIRMED', updated_at=now() WHERE id=$1 RETURNING ${ORDER_COLUMNS}`, [id]);
    await this.client.query("INSERT INTO production_events(event_type,entity_id) VALUES('OrderEligible',$1)", [id]);
    return toOrder(result.rows[0]);
  }

  async collectCod(order: Order, actorId: string | null) {
    await this.client.query(`INSERT INTO payments (order_id,payment_number,payment_method,payment_purpose,
      amount,currency,verification_status,verified_by,verified_at)
      VALUES ($1,$2,'COD','FULL_PAYMENT',$3,'VND','VERIFIED',$4,now())`,
    [order.id, `PAY-${order.orderNumber.slice(3)}`, order.grandTotal, actorId]);
  }

  async setOrderStatus(id: string, status: OrderStatus, paymentStatus: Order['paymentStatus']) {
    const result = await this.client.query<OrderRow>(`UPDATE orders SET order_status=$2::varchar,
      payment_status=$3, completed_at=CASE WHEN $2::varchar='COMPLETED' THEN now() ELSE completed_at END,
      cancelled_at=CASE WHEN $2::varchar='CANCELLED' THEN now() ELSE cancelled_at END,
      updated_at=now() WHERE id=$1 RETURNING ${ORDER_COLUMNS}`, [id, status, paymentStatus]);
    return toOrder(result.rows[0]);
  }

  async archiveOrder(id: string, actorId: string) {
    const result = await this.client.query<{ admin_archived_at: Date }>(
      `UPDATE orders SET admin_archived_at=now(), updated_at=now()
        WHERE id=$1 AND admin_archived_at IS NULL
        RETURNING admin_archived_at`, [id]);
    const archivedAt = result.rows[0]?.admin_archived_at;
    if (!archivedAt) return false;
    await this.client.query(`INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,old_values,new_values)
      VALUES ($1,'ORDER_ARCHIVED','ORDER',$2,'{"adminArchivedAt":null}'::jsonb,$3::jsonb)`,
    [actorId, id, JSON.stringify({ adminArchivedAt: archivedAt.toISOString() })]);
    return true;
  }

  async recordDecision(entity: 'ORDER' | 'PAYMENT', id: string, action: string, from: string, to: string, actorId: string | null) {
    await this.client.query(`INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,old_values,new_values)
      VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb)`, [actorId, action, entity, id, JSON.stringify({status:from}), JSON.stringify({status:to})]);
    if (entity === 'PAYMENT') await this.client.query(`INSERT INTO status_history(entity_type,entity_id,from_status,to_status,changed_by)
      VALUES ($1,$2,$3,$4,$5)`, [entity, id, from, to, actorId]);
  }

  async recordOrderHistory(id: string, from: OrderStatus | null, to: OrderStatus, actorId: string | null = null, reason?: string) {
    await this.client.query(`INSERT INTO status_history(entity_type,entity_id,from_status,to_status,changed_by,reason)
      VALUES ('ORDER',$1,$2,$3,$4,$5)`, [id, from, to, actorId, reason ?? null]);
  }
}

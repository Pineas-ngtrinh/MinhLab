import type { PoolClient } from 'pg';
import type { OrderReturnRequest, OrderReturnStatus } from '../../domain/orders/order-return';
import type { OrderStatus, PaymentStatus } from '../../domain/orders/order';
import { AppError } from '../../lib/errors';

type DateValue = Date | string;
type NumericValue = number | string;

interface ReturnOrderRow {
  id: string;
  order_number: string;
  customer_id: string | null;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
}

interface ReturnRequestRow {
  id: string;
  order_id: string;
  status: OrderReturnStatus;
  reason: string;
  requested_at: DateValue;
  received_at: DateValue | null;
  refunded_at: DateValue | null;
  refunded_amount: NumericValue | null;
  transaction_reference: string | null;
}

function toIso(value: DateValue | null): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapRequest(row: ReturnRequestRow): OrderReturnRequest {
  return {
    id: row.id,
    orderId: row.order_id,
    status: row.status,
    reason: row.reason,
    requestedAt: toIso(row.requested_at)!,
    receivedAt: toIso(row.received_at),
    refundedAt: toIso(row.refunded_at),
    refundedAmount: row.refunded_amount === null ? undefined : Number(row.refunded_amount),
    transactionReference: row.transaction_reference ?? undefined,
  };
}

export class PostgresOrderReturnRepository {
  constructor(private readonly client: PoolClient) {}

  async lockOrder(orderNumber: string) {
    const result = await this.client.query<ReturnOrderRow>(
      `SELECT id,order_number,customer_id,order_status,payment_status
         FROM orders WHERE order_number=$1 FOR UPDATE`,
      [orderNumber],
    );
    const row = result.rows[0];
    return row ? {
      id: row.id,
      orderNumber: row.order_number,
      customerId: row.customer_id ?? undefined,
      orderStatus: row.order_status,
      paymentStatus: row.payment_status,
    } : null;
  }

  async getRequestForOrder(orderId: string): Promise<OrderReturnRequest | null> {
    const result = await this.client.query<ReturnRequestRow>(
      `SELECT r.id,r.order_id,r.status,r.reason,r.requested_at,r.received_at,r.refunded_at,
              f.amount AS refunded_amount,f.transaction_reference
         FROM order_return_requests r
         LEFT JOIN refunds f ON f.return_request_id=r.id AND f.status='COMPLETED'
        WHERE r.order_id=$1
        FOR UPDATE OF r`,
      [orderId],
    );
    return result.rows[0] ? mapRequest(result.rows[0]) : null;
  }

  async createRequest(input: {
    orderId: string;
    requestedByUserId: string | null;
    reason: string;
  }): Promise<OrderReturnRequest> {
    const result = await this.client.query<ReturnRequestRow>(
      `INSERT INTO order_return_requests(order_id,requested_by_user_id,reason,status)
       VALUES($1,$2,$3,'REQUESTED')
       RETURNING id,order_id,status,reason,requested_at,received_at,refunded_at,
                 NULL::numeric AS refunded_amount,NULL::varchar AS transaction_reference`,
      [input.orderId, input.requestedByUserId, input.reason],
    );
    const request = mapRequest(result.rows[0]);
    await this.recordEvent({
      request,
      actorUserId: input.requestedByUserId,
      action: 'ORDER_RETURN_REQUESTED',
      from: '',
      to: 'REQUESTED',
    });
    return request;
  }

  async markReceived(input: { requestId: string; actorUserId: string }): Promise<OrderReturnRequest> {
    const result = await this.client.query<ReturnRequestRow>(
      `UPDATE order_return_requests SET status='RETURN_RECEIVED',received_by_user_id=$2,received_at=now()
        WHERE id=$1 AND status='REQUESTED'
        RETURNING id,order_id,status,reason,requested_at,received_at,refunded_at,
                  NULL::numeric AS refunded_amount,NULL::varchar AS transaction_reference`,
      [input.requestId, input.actorUserId],
    );
    if (!result.rows[0]) throw new AppError('Yêu cầu hoàn hàng đã được xử lý ở nơi khác.', 409);
    const request = mapRequest(result.rows[0]);
    await this.recordEvent({
      request,
      actorUserId: input.actorUserId,
      action: 'ORDER_RETURN_RECEIVED',
      from: 'REQUESTED',
      to: 'RETURN_RECEIVED',
    });
    return request;
  }

  async recordRefund(input: {
    orderId: string;
    requestId: string;
    actorUserId: string;
    amount: number;
    transactionReference: string;
    refundNumber: string;
  }): Promise<{ request: OrderReturnRequest; paymentStatus: PaymentStatus }> {
    const requestResult = await this.client.query<ReturnRequestRow>(
      `SELECT r.id,r.order_id,r.status,r.reason,r.requested_at,r.received_at,r.refunded_at,
              f.amount AS refunded_amount,f.transaction_reference
         FROM order_return_requests r
         LEFT JOIN refunds f ON f.return_request_id=r.id AND f.status='COMPLETED'
        WHERE r.id=$1 AND r.order_id=$2
        FOR UPDATE OF r`,
      [input.requestId, input.orderId],
    );
    const requestRow = requestResult.rows[0];
    if (!requestRow) throw new AppError('Không tìm thấy yêu cầu hoàn hàng.', 404);
    if (requestRow.status !== 'RETURN_RECEIVED') {
      throw new AppError('Yêu cầu hoàn hàng chưa được nhận và kiểm tra.', 409);
    }

    const paymentResult = await this.client.query<{ id: string; amount: NumericValue }>(
      `SELECT id,amount FROM payments
        WHERE order_id=$1 AND verification_status IN ('VERIFIED','REFUNDED')
        ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE`,
      [input.orderId],
    );
    const payment = paymentResult.rows[0];
    if (!payment) throw new AppError('Không tìm thấy khoản thanh toán đã xác nhận để hoàn.', 409);

    const refundedResult = await this.client.query<{ amount: NumericValue }>(
      `SELECT COALESCE(sum(amount),0)::numeric AS amount
         FROM refunds WHERE payment_id=$1 AND status='COMPLETED'`,
      [payment.id],
    );
    const refundedBefore = Number(refundedResult.rows[0]?.amount ?? 0);
    const paymentAmount = Number(payment.amount);
    const available = paymentAmount - refundedBefore;
    if (input.amount > available) {
      throw new AppError(`Số tiền hoàn vượt quá số tiền còn có thể hoàn (${available.toLocaleString('vi-VN')} ₫).`, 409);
    }

    await this.client.query(
      `INSERT INTO refunds(payment_id,processed_by,refund_number,amount,reason,status,
                           transaction_reference,return_request_id)
       VALUES($1,$2,$3,$4,$5,'COMPLETED',$6,$7)`,
      [payment.id, input.actorUserId, input.refundNumber, input.amount,
        `Hoàn hàng sau giao: ${requestRow.reason}`, input.transactionReference, input.requestId],
    );

    const [paidTotalResult, refundTotalResult] = await Promise.all([
      this.client.query<{ amount: NumericValue }>(
        `SELECT COALESCE(sum(amount),0)::numeric AS amount FROM payments
          WHERE order_id=$1 AND verification_status IN ('VERIFIED','REFUNDED')`,
        [input.orderId],
      ),
      this.client.query<{ amount: NumericValue }>(
        `SELECT COALESCE(sum(r.amount),0)::numeric AS amount
           FROM refunds r JOIN payments p ON p.id=r.payment_id
          WHERE p.order_id=$1 AND r.status='COMPLETED'`,
        [input.orderId],
      ),
    ]);
    const totalPaid = Number(paidTotalResult.rows[0]?.amount ?? 0);
    const totalRefunded = Number(refundTotalResult.rows[0]?.amount ?? 0);
    if (totalPaid <= 0 || totalRefunded > totalPaid) {
      throw new AppError('Tổng tiền hoàn không hợp lệ so với các khoản đã nhận.', 409);
    }
    const paymentStatus: PaymentStatus = totalRefunded >= totalPaid ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
    const paymentStatusForRow = refundedBefore + input.amount >= paymentAmount ? 'REFUNDED' : 'VERIFIED';
    await this.client.query('UPDATE payments SET verification_status=$2 WHERE id=$1', [payment.id, paymentStatusForRow]);
    await this.client.query('UPDATE orders SET payment_status=$2,updated_at=now() WHERE id=$1', [input.orderId, paymentStatus]);

    await this.client.query(
      `UPDATE order_return_requests SET status='REFUNDED',refunded_by_user_id=$2,refunded_at=now()
        WHERE id=$1 AND status='RETURN_RECEIVED'`,
      [input.requestId, input.actorUserId],
    );
    const refreshed = await this.getRequestForOrder(input.orderId);
    if (!refreshed) throw new AppError('Không tìm thấy yêu cầu hoàn hàng.', 404);
    await this.recordEvent({
      request: refreshed,
      actorUserId: input.actorUserId,
      action: 'ORDER_RETURN_REFUNDED',
      from: 'RETURN_RECEIVED',
      to: 'REFUNDED',
    }, input.amount);
    return { request: refreshed, paymentStatus };
  }

  private async recordEvent(input: {
    request: OrderReturnRequest;
    actorUserId: string | null;
    action: string;
    from: string;
    to: string;
  }, amount?: number) {
    await this.client.query(
      `INSERT INTO status_history(entity_type,entity_id,from_status,to_status,changed_by,reason)
       VALUES('ORDER_RETURN',$1,$2,$3,$4,$5)`,
      [input.request.id, input.from || null, input.to, input.actorUserId, amount ? `Đã ghi nhận hoàn ${amount} VND` : null],
    );
    await this.client.query(
      `INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,old_values,new_values)
       VALUES($1,$2,'ORDER',$3,$4::jsonb,$5::jsonb)`,
      [input.actorUserId, input.action, input.request.orderId,
        JSON.stringify({ returnRequestStatus: input.from || null }),
        JSON.stringify({ returnRequestId: input.request.id, returnRequestStatus: input.to, amount: amount ?? null })],
    );
  }
}

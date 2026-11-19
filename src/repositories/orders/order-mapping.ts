import type { Order, OrderItem, Payment, PaymentAttachment } from '../../domain/orders/order';

export type DateValue = Date | string;
export type NumericValue = number | string;

export interface OrderRow {
  id: string;
  order_number: string;
  customer_id: string | null;
  customer_name_snapshot: string;
  customer_email_snapshot: string;
  customer_phone_snapshot: string;
  shipping_recipient_name: string;
  shipping_recipient_phone: string;
  shipping_address_line: string;
  shipping_province_name: string;
  order_status: Order['orderStatus'];
  payment_status: Order['paymentStatus'];
  payment_timing: Order['paymentTiming'];
  currency: 'VND';
  subtotal: NumericValue;
  shipping_fee: NumericValue;
  grand_total: NumericValue;
  required_deposit_amount: NumericValue;
  customer_note: string | null;
  placed_at: DateValue;
  created_at: DateValue;
  updated_at: DateValue;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  item_type: OrderItem['itemType'];
  item_name_snapshot: string;
  quantity: number;
  unitPrice: NumericValue;
  line_total: NumericValue;
  color_snapshot: string | null;
  material_snapshot: string | null;
}

export interface PaymentRow {
  receiving_account: import('../../contracts/payments').BankDestination | null;
  id: string;
  order_id: string;
  payment_number: string;
  payment_method: Payment['paymentMethod'];
  payment_purpose: Payment['paymentPurpose'];
  amount: NumericValue;
  currency: 'VND';
  transaction_reference: string | null;
  bank_name: string | null;
  sender_account_name: string | null;
  transferred_at: DateValue | null;
  verification_status: Payment['verificationStatus'];
  verified_by: string | null;
  verified_at: DateValue | null;
  rejection_reason: string | null;
  created_at: DateValue;
}

export interface AttachmentRow {
  id: string;
  entity_id: string;
  file_url: string;
  created_at: DateValue;
}

export const ORDER_COLUMNS = `
  id, order_number, customer_id, customer_name_snapshot, customer_email_snapshot,
  customer_phone_snapshot, shipping_recipient_name, shipping_recipient_phone,
  shipping_address_line, shipping_province_name, order_status, payment_status,
  payment_timing, currency, subtotal, shipping_fee, grand_total,
  required_deposit_amount, customer_note, placed_at, created_at, updated_at
`;

export const PAYMENT_COLUMNS = `
  receiving_account,
  id, order_id, payment_number, payment_method, payment_purpose, amount, currency,
  transaction_reference, bank_name, sender_account_name, transferred_at,
  verification_status, verified_by, verified_at, rejection_reason, created_at
`;

export function asNumber(value: NumericValue): number {
  return typeof value === 'number' ? value : Number(value);
}

function asIso(value: DateValue): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function asOptionalIso(value: DateValue | null): string | undefined {
  return value ? asIso(value) : undefined;
}

export function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    orderNumber: row.order_number,
    customerId: row.customer_id ?? undefined,
    customerNameSnapshot: row.customer_name_snapshot,
    customerEmailSnapshot: row.customer_email_snapshot,
    customerPhoneSnapshot: row.customer_phone_snapshot,
    shippingRecipientName: row.shipping_recipient_name,
    shippingRecipientPhone: row.shipping_recipient_phone,
    shippingAddressLine: row.shipping_address_line,
    shippingProvinceName: row.shipping_province_name,
    orderStatus: row.order_status,
    paymentStatus: row.payment_status,
    paymentTiming: row.payment_timing,
    currency: row.currency,
    subtotal: asNumber(row.subtotal),
    shippingFee: asNumber(row.shipping_fee),
    grandTotal: asNumber(row.grand_total),
    requiredDepositAmount: asNumber(row.required_deposit_amount),
    customerNote: row.customer_note ?? undefined,
    placedAt: asIso(row.placed_at),
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  };
}

export function toOrderItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    itemType: row.item_type,
    itemNameSnapshot: row.item_name_snapshot,
    quantity: row.quantity,
    unitPrice: asNumber(row.unitPrice),
    lineTotal: asNumber(row.line_total),
    colorSnapshot: row.color_snapshot ?? undefined,
    materialSnapshot: row.material_snapshot ?? undefined,
  };
}

export function toPayment(row: PaymentRow): Payment {
  return {
    receivingBank: row.receiving_account ? {
      bin: row.receiving_account.bin,
      name: row.receiving_account.name,
      accountNumber: row.receiving_account.accountNumber,
      accountName: row.receiving_account.accountName,
    } : undefined,
    id: row.id,
    orderId: row.order_id,
    paymentNumber: row.payment_number,
    paymentMethod: row.payment_method,
    paymentPurpose: row.payment_purpose,
    amount: asNumber(row.amount),
    currency: row.currency,
    transactionReference: row.transaction_reference ?? undefined,
    bankName: row.bank_name ?? undefined,
    senderAccountName: row.sender_account_name ?? undefined,
    transferredAt: asOptionalIso(row.transferred_at),
    verificationStatus: row.verification_status,
    verifiedBy: row.verified_by ?? undefined,
    verifiedAt: asOptionalIso(row.verified_at),
    rejectionReason: row.rejection_reason ?? undefined,
    createdAt: asIso(row.created_at),
  };
}

export function toAttachment(row: AttachmentRow): PaymentAttachment {
  return {
    id: row.id,
    entityType: 'PAYMENT',
    entityId: row.entity_id,
    fileUrl: row.file_url,
    purpose: 'PAYMENT_PROOF',
    createdAt: asIso(row.created_at),
  };
}

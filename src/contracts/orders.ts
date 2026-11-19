import type { OrderStatus, PaymentStatus, PaymentTiming } from '../domain/orders/order';

export interface CustomerOrderSummary {
  pendingPayment: number;
  active: number;
  completed: number;
  total: number;
}

export interface OrderItemInput {
  productId?: string;
  productVariantId?: string;
  printSpecificationId?: string;
  itemType: 'READY_PRODUCT' | 'CUSTOM_PRINT';
  itemName: string;
  quantity: number;
  unitPrice: number;
  color?: string;
  material?: string;
}

export interface CreateOrderInput {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  customerNote?: string;
  paymentMethod: 'VIETQR';
  items: OrderItemInput[];
}

export interface OrderRecord {
  id: string;
  order_number: string;
  customer_id?: string;
  customer_name_snapshot: string;
  customer_email_snapshot: string;
  customer_phone_snapshot: string;
  shipping_recipient_name: string;
  shipping_recipient_phone: string;
  shipping_address_line: string;
  shipping_province_name: string;
  order_status: OrderStatus;
  payment_status: PaymentStatus;
  payment_timing: PaymentTiming;
  currency: 'VND';
  subtotal: number;
  shipping_fee: number;
  grand_total: number;
  required_deposit_amount: number;
  customer_note?: string;
  placed_at: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRecord {
  id: string;
  order_id: string;
  item_type: 'READY_PRODUCT' | 'CUSTOM_PRINT';
  item_name_snapshot: string;
  quantity: number;
  unitPrice: number;
  line_total: number;
  color_snapshot?: string;
  material_snapshot?: string;
}

export interface PaymentRecord {
  receivingBank?: import('./payments').BankDestination;
  id: string;
  order_id: string;
  payment_number: string;
  payment_method: 'VIETQR' | 'BANK_TRANSFER' | 'CASH' | 'COD';
  payment_purpose: 'FULL_PAYMENT' | 'DEPOSIT' | 'BALANCE';
  amount: number;
  currency: 'VND';
  transaction_reference?: string;
  bank_name?: string;
  sender_account_name?: string;
  transferred_at?: string;
  verification_status: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'REFUNDED';
  verified_by?: string;
  verified_at?: string;
  rejection_reason?: string;
  created_at: string;
}

export interface AttachmentRecord {
  id: string;
  entity_type: 'PAYMENT';
  entity_id: string;
  file_url: string;
  purpose: 'PAYMENT_PROOF';
  created_at: string;
}

export interface DeclarePaymentInput {
  orderNumber: string;
  transactionReference?: string;
  bankName?: string;
  senderAccountName?: string;
  paymentProofUrl?: string;
  trackingToken?: string;
}

/** HTTP DTOs shared with browser callers; legacy snake_case records above stay server-facing. */
export interface CreatedOrderData {
  orderNumber: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentTiming: PaymentTiming;
  grandTotal: number;
  trackingToken: string;
  payment: Pick<PaymentSummaryData, 'paymentNumber' | 'amount' | 'verificationStatus' | 'receivingBank'> | null;
}
export interface PaymentSummaryData {
  receivingBank?: import('./payments').BankDestination;
  paymentNumber: string;
  paymentMethod: PaymentRecord['payment_method'];
  amount: number;
  verificationStatus: PaymentRecord['verification_status'];
  transferredAt?: string;
  verifiedAt?: string;
  rejectionReason?: string;
}
export interface OrderItemData {
  itemName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}
export interface CustomerOrderData {
  production?: ProductionProgressData[];
  returnRequest?: OrderReturnData;
  orderNumber: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentTiming: PaymentTiming;
  grandTotal: number;
  placedAt: string;
  shippingAddress: string;
  items: OrderItemData[];
  payment: Pick<PaymentSummaryData, 'paymentMethod' | 'verificationStatus' | 'amount'> | null;
}
export interface TrackedOrderData extends Omit<CustomerOrderData, 'placedAt' | 'payment'> {
  placedAt?: string;
  customerName: string;
  customerEmail: string;
  payment: PaymentSummaryData | null;
}

export interface ProductionProgressData {
  itemName: string;
  quantity: number;
  status: 'WAITING_DATA' | 'WAITING_PLAN' | 'SCHEDULED' | 'IN_PROGRESS' | 'POST_PROCESSING' | 'WAITING_QC' | 'FINISHING_REVIEW' | 'PACKING' | 'READY_FOR_DISPATCH';
}

export interface OrderReturnData {
  status: import('../domain/orders/order-return').OrderReturnStatus;
  reason: string;
  requestedAt: string;
  receivedAt?: string;
  refundedAt?: string;
  refundedAmount?: number;
  transactionReference?: string;
}

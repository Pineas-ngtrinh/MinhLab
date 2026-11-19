export const ORDER_STATUSES = ['PENDING_PAYMENT', 'DEPOSIT_PAID', 'CONFIRMED', 'IN_PRODUCTION', 'READY_TO_SHIP', 'SHIPPED', 'COMPLETED', 'CANCELLED'] as const;
export type OrderStatus = typeof ORDER_STATUSES[number];
export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'PARTIALLY_REFUNDED' | 'REFUNDED';
export type PaymentTiming = 'PREPAID' | 'COD';

export interface Order {
  id: string;
  orderNumber: string;
  customerId?: string;
  customerNameSnapshot: string;
  customerEmailSnapshot: string;
  customerPhoneSnapshot: string;
  shippingRecipientName: string;
  shippingRecipientPhone: string;
  shippingAddressLine: string;
  shippingProvinceName: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentTiming: PaymentTiming;
  currency: 'VND';
  subtotal: number;
  shippingFee: number;
  grandTotal: number;
  requiredDepositAmount: number;
  customerNote?: string;
  placedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  itemType: 'READY_PRODUCT' | 'CUSTOM_PRINT';
  itemNameSnapshot: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  colorSnapshot?: string;
  materialSnapshot?: string;
}

export interface Payment {
  receivingBank?: import('../../contracts/payments').BankDestination;
  id: string;
  orderId: string;
  paymentNumber: string;
  paymentMethod: 'VIETQR' | 'BANK_TRANSFER' | 'CASH' | 'COD';
  paymentPurpose: 'FULL_PAYMENT' | 'DEPOSIT' | 'BALANCE';
  amount: number;
  currency: 'VND';
  transactionReference?: string;
  bankName?: string;
  senderAccountName?: string;
  transferredAt?: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'REFUNDED';
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export interface PaymentAttachment {
  id: string;
  entityType: 'PAYMENT';
  entityId: string;
  fileUrl: string;
  purpose: 'PAYMENT_PROOF';
  createdAt: string;
}

export interface OrderDetails {
  order: Order;
  items: OrderItem[];
  payment?: Payment;
  returnRequest?: import('./order-return').OrderReturnRequest;
  attachments: PaymentAttachment[];
}
export interface CheckoutResult {
  order: Order;
  items: OrderItem[];
  payment?: Payment;
  trackingToken: string;
}

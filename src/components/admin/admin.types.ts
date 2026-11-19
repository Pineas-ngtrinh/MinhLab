export interface PaymentItem {
  id: string;
  paymentNumber: string;
  orderNumber: string;
  orderStatus: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  amount: number;
  paymentMethod: string;
  paymentPurpose: string;
  transactionReference: string;
  bankName: string;
  senderAccountName: string;
  transferredAt?: string;
  verificationStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | 'REFUNDED';
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  attachments: string[];
  createdAt: string;
}

export interface OrderItemAdmin {
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  orderStatus: string;
  paymentStatus: string;
  paymentTiming: string;
  grandTotal: number;
  placedAt: string;
  itemsCount: number;
  customerNote?: string;
  items?: {
    itemName: string;
    quantity: number;
    unitPrice: number;
    itemType: string;
    material?: string;
  }[];
  returnRequest?: {
    status: 'REQUESTED' | 'RETURN_RECEIVED' | 'REFUNDED';
    reason: string;
    requestedAt: string;
    receivedAt?: string;
    refundedAt?: string;
    refundedAmount?: number;
    transactionReference?: string;
  } | null;
}

import type { Order, OrderItem, Payment, PaymentAttachment, OrderDetails, CheckoutResult } from '../../domain/orders/order';
import type { OrderRecord, OrderItemRecord, PaymentRecord, AttachmentRecord } from '../../contracts/orders';

export function presentOrder(value: Order): OrderRecord {
  return {
    id: value.id,
    order_number: value.orderNumber,
    customer_id: value.customerId,
    customer_name_snapshot: value.customerNameSnapshot,
    customer_email_snapshot: value.customerEmailSnapshot,
    customer_phone_snapshot: value.customerPhoneSnapshot,
    shipping_recipient_name: value.shippingRecipientName,
    shipping_recipient_phone: value.shippingRecipientPhone,
    shipping_address_line: value.shippingAddressLine,
    shipping_province_name: value.shippingProvinceName,
    order_status: value.orderStatus,
    payment_status: value.paymentStatus,
    payment_timing: value.paymentTiming,
    currency: value.currency,
    subtotal: value.subtotal,
    shipping_fee: value.shippingFee,
    grand_total: value.grandTotal,
    required_deposit_amount: value.requiredDepositAmount,
    customer_note: value.customerNote,
    placed_at: value.placedAt,
    created_at: value.createdAt,
    updated_at: value.updatedAt,
  };
}

export function presentOrderItem(value: OrderItem): OrderItemRecord {
  return {
    id: value.id,
    order_id: value.orderId,
    item_type: value.itemType,
    item_name_snapshot: value.itemNameSnapshot,
    quantity: value.quantity,
    unitPrice: value.unitPrice,
    line_total: value.lineTotal,
    color_snapshot: value.colorSnapshot,
    material_snapshot: value.materialSnapshot,
  };
}

export function presentPayment(value: Payment): PaymentRecord {
  return {
    receivingBank:value.receivingBank,
    id: value.id,
    order_id: value.orderId,
    payment_number: value.paymentNumber,
    payment_method: value.paymentMethod,
    payment_purpose: value.paymentPurpose,
    amount: value.amount,
    currency: value.currency,
    transaction_reference: value.transactionReference,
    bank_name: value.bankName,
    sender_account_name: value.senderAccountName,
    transferred_at: value.transferredAt,
    verification_status: value.verificationStatus,
    verified_by: value.verifiedBy,
    verified_at: value.verifiedAt,
    rejection_reason: value.rejectionReason,
    created_at: value.createdAt,
  };
}

export function presentPaymentAttachment(value: PaymentAttachment): AttachmentRecord {
  return {
    id: value.id,
    entity_type: value.entityType,
    entity_id: value.entityId,
    file_url: value.fileUrl,
    purpose: value.purpose,
    created_at: value.createdAt,
  };
}

export function presentDetails(value: OrderDetails) {
  return { order: presentOrder(value.order), items: value.items.map(presentOrderItem),
    payment: value.payment ? presentPayment(value.payment) : undefined,
    returnRequest: value.returnRequest,
    attachments: value.attachments.map(presentPaymentAttachment) };
}
export function presentCheckout(value: CheckoutResult) {
  return { order: presentOrder(value.order), items: value.items.map(presentOrderItem),
    payment: value.payment ? presentPayment(value.payment) : undefined, trackingToken: value.trackingToken };
}

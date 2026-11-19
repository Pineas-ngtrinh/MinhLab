import type { OrderItemInput, CreateOrderInput, DeclarePaymentInput, CustomerOrderSummary } from '../../contracts/orders';
import type { PageOptions, PageResult } from '../../contracts/pagination';
import type { Order, OrderItem, OrderDetails, OrderStatus, Payment, PaymentAttachment } from '../../domain/orders/order';

export interface PricedOrderItem extends Omit<OrderItemInput, 'productVariantId'> {
  productVariantId: string | null;
  skuSnapshot: string | null;
}
export interface NewOrder {
  orderNumber: string;
  customerId?: string;
  customer: Pick<CreateOrderInput, 'customerName' | 'customerEmail' | 'customerPhone' | 'shippingAddress' | 'customerNote'>;
  status: OrderStatus;
  timing: Order['paymentTiming'];
  subtotal: number;
  shippingFee: number;
  grandTotal: number;
  requiredDepositAmount: number;
  placedAt: string;
}
export interface OrderReadRepository {
  getOrderDetail(number: string): Promise<OrderDetails | null>;
  getCustomerOrdersPage(id: string, options: PageOptions): Promise<PageResult<OrderDetails> & {summary: CustomerOrderSummary}>;
  hasTrackingAccess(number: string, tokenHash: string): Promise<boolean>;
  isOwner(number: string, customerId: string): Promise<boolean>;
  getOrdersPage(options: PageOptions): Promise<PageResult<OrderDetails>>;
  getPaymentsPage(options: PageOptions): Promise<PageResult<{
    payment: Payment; order?: Order; attachments: PaymentAttachment[];
  }>>;
}
export interface OrderWriteRepository {
  lockOrder(number: string): Promise<Order | null>;
  latestPayment(orderId: string): Promise<Payment | null>;
  isPaymentVerifier(userId: string, telegramUserId?: string): Promise<boolean>;
  orderItems(orderId: string): Promise<OrderItem[]>;
  lockCheckout(keyHash: string): Promise<{ order: Order; requestHash: string } | null>;
  findVariant(productId: string, color: string | undefined, requirePublished: boolean, variantId?: string): Promise<{
    id: string; sku: string; name: string; price: number; color?: string; material?: string;
  } | null>;
  createOrder(input: NewOrder): Promise<Order>;
  addItem(orderId: string, input: PricedOrderItem): Promise<OrderItem>;
  saveCheckoutHashes(orderId: string, key: string, request: string): Promise<void>;
  addTrackingToken(orderId: string, hash: string): Promise<void>;
  createPrepayment(order: Order, destination: import('../../contracts/payments').BankDestination): Promise<Payment>;
  declarePayment(id: string, input: DeclarePaymentInput): Promise<Payment>;
  verifyPayment(id: string, actorId: string | null, telegramUserId?: string): Promise<Payment | null>;
  rejectPayment(id: string, actorId: string | null, reason: string, telegramUserId?: string): Promise<Payment | null>;
  confirmPaidOrder(id: string): Promise<Order>;
  collectCod(order: Order, actorId: string | null): Promise<void>;
  setOrderStatus(id: string, status: OrderStatus, paymentStatus: Order['paymentStatus']): Promise<Order>;
  productionTransitionBlocker(id: string, next: OrderStatus): Promise<string | null>;
  archiveOrder?(id: string, actorId: string): Promise<boolean>;
  recordDecision(entity: 'ORDER' | 'PAYMENT', id: string, action: string, from: string, to: string, actorId: string | null): Promise<void>;
  recordOrderHistory(id: string, from: OrderStatus | null, to: OrderStatus, actorId?: string | null, reason?: string): Promise<void>;
}

interface CustomerMail {
  orderNumber: string;
  customerEmailSnapshot: string;
  customerNameSnapshot: string;
  grandTotal: number;
  orderItems: { itemName: string; quantity: number; unitPrice: number }[];
  trackingUrl: string;
}
export interface OrderNotifications {
  storeOrderCreated(payload: { orderNumber: string; grandTotal: number; paymentMethod: 'VIETQR' }): Promise<void>;
  storePaymentDeclared(payload: {
    orderNumber: string;
    amount: number;
    transactionReference?: string;
    customer: {
      name: string;
      email: string;
      phone: string;
      recipientName: string;
      recipientPhone: string;
      address: string;
      province: string;
    };
    items: { name: string; quantity: number; unitPrice: number; lineTotal: number }[];
    declarationId: string;
  }): Promise<void>;
  storePaymentVerified(payload: { orderNumber: string; amount: number }): Promise<void>;
  paymentVerified(payload: CustomerMail & {
    amountPaid: number; paymentPurpose: 'FULL_PAYMENT'; remainingBalance: number;
  }): Promise<void>;
  paymentDeclared(payload: Omit<DeclarePaymentInput, 'trackingToken' | 'paymentProofUrl'> & {
    amount: number; adminVerifyUrl: string;
  }): Promise<void>;
}
export interface OrderTransactionContext {
  orders: OrderWriteRepository;
  notifications: OrderNotifications;
}
export interface OrderDependencies {
  paymentDestination(): import('../../contracts/payments').BankDestination | null;
  read: OrderReadRepository;
  transaction: <T>(operation: (context: OrderTransactionContext) => Promise<T>) => Promise<T>;
  requirePublishedCatalog: () => boolean;
}

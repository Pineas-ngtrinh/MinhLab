import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CreateOrderInput } from '../../../contracts/orders';
import type { Order } from '../../../domain/orders/order';
import { AppError } from '../../../lib/errors';
import { shortOrderNumber } from '../../../lib/format';
import { createCheckout } from '../order-checkout.service';
import { createOrderNumber } from '../order-number';
import type { NewOrder, OrderDependencies, OrderWriteRepository, PricedOrderItem } from '../order.ports';

test('new order numbers are compact, grouped, and avoid confusing characters', () => {
  const values = Array.from({ length: 100 }, () => createOrderNumber());
  const pattern = /^ML-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{5}$/;

  for (const value of values) assert.match(value, pattern);
  assert.equal(new Set(values).size, values.length);
});

test('compact operator order references preserve enough distinguishing characters for new and legacy numbers', () => {
  assert.equal(shortOrderNumber('ML-ABCD-EFGH-JKLMN'), '#EFGH-JKLMN');
  assert.equal(shortOrderNumber('ML-MWC30UL3-B69CD8B98E'), '#9CD8B98E');
});

function unexpectedOperation(): never {
  throw new Error('Unexpected checkout dependency');
}
const unusedDependencies: OrderDependencies = {
  paymentDestination: unexpectedOperation,
  requirePublishedCatalog: unexpectedOperation,
  transaction: unexpectedOperation,
  read: {
    getOrderDetail: unexpectedOperation,
    getCustomerOrdersPage: unexpectedOperation,
    hasTrackingAccess: unexpectedOperation,
    isOwner: unexpectedOperation,
    getOrdersPage: unexpectedOperation,
    getPaymentsPage: unexpectedOperation,
  },
};

const orderInput = (): CreateOrderInput => ({
  customerName: 'Khách đặt hàng',
  customerEmail: 'customer@example.test',
  customerPhone: '0901234567',
  shippingAddress: 'Địa chỉ giao hàng',
  paymentMethod: 'VIETQR',
  items: [{ itemType: 'READY_PRODUCT', itemName: 'Tên từ trình duyệt', productId: 'model', quantity: 2, unitPrice: 1 }],
});

test('checkout rejects conflicting catalogue and custom-print references before opening a transaction', async () => {
  let transactionOpened = false;
  const checkout = createCheckout({
    ...unusedDependencies,
    transaction: async () => { transactionOpened = true; throw new Error('Unexpected transaction'); },
  });
  const ready = orderInput();
  ready.items[0].printSpecificationId = '12345678-1234-4123-8123-123456789abc';
  await assert.rejects(checkout(ready), (error: unknown) => error instanceof AppError && error.status === 400);

  for (const reference of ['productId', 'productVariantId'] as const) {
    const custom = orderInput();
    custom.items = [{
      itemType: 'CUSTOM_PRINT', itemName: 'Mẫu đã duyệt', quantity: 1, unitPrice: 1,
      printSpecificationId: '12345678-1234-4123-8123-123456789abc',
      [reference]: 'catalogue-reference',
    }];
    await assert.rejects(checkout(custom), (error: unknown) => error instanceof AppError && error.status === 400);
  }
  assert.equal(transactionOpened, false);
});

test('checkout persists catalogue prices and snapshots instead of browser values', async () => {
  let created: NewOrder | undefined;
  const savedItems: PricedOrderItem[] = [];
  const orders = {
    lockOrder: unexpectedOperation,
    latestPayment: unexpectedOperation,
    orderItems: unexpectedOperation,
    lockCheckout: unexpectedOperation,
    saveCheckoutHashes: unexpectedOperation,
    declarePayment: unexpectedOperation,
    verifyPayment: unexpectedOperation,
    rejectPayment: unexpectedOperation,
    confirmPaidOrder: unexpectedOperation,
    collectCod: unexpectedOperation,
    setOrderStatus: unexpectedOperation,
    productionTransitionBlocker: unexpectedOperation,
    recordDecision: unexpectedOperation,
    async findVariant() {
      return { id: 'variant-id', sku: 'ML-S-1', name: 'Tên trong catalogue', price: 250000, color: 'Đỏ', material: 'PETG' };
    },
    async createOrder(input: NewOrder): Promise<Order> {
      created = input;
      return {
        id: 'order-id', orderNumber: input.orderNumber, customerNameSnapshot: input.customer.customerName,
        customerEmailSnapshot: input.customer.customerEmail, customerPhoneSnapshot: input.customer.customerPhone,
        shippingRecipientName: input.customer.customerName, shippingRecipientPhone: input.customer.customerPhone,
        shippingAddressLine: input.customer.shippingAddress, shippingProvinceName: 'Việt Nam',
        orderStatus: input.status, paymentStatus: 'UNPAID', paymentTiming: input.timing, currency: 'VND',
        subtotal: input.subtotal, shippingFee: input.shippingFee, grandTotal: input.grandTotal,
        requiredDepositAmount: input.requiredDepositAmount, placedAt: input.placedAt,
        createdAt: input.placedAt, updatedAt: input.placedAt,
      };
    },
    async addTrackingToken() {},
    async isPaymentVerifier() { return true; },
    async addItem(orderId: string, input: PricedOrderItem) {
      savedItems.push(input);
      return {
        id: 'item-id', orderId, itemType: input.itemType, itemNameSnapshot: input.itemName,
        quantity: input.quantity, unitPrice: input.unitPrice, lineTotal: input.unitPrice * input.quantity,
      };
    },
    async recordOrderHistory() {},
    async createPrepayment(order: Order) {
      return {
        id: 'payment-id', orderId: order.id, paymentNumber: 'PAY-1', paymentMethod: 'VIETQR' as const,
        paymentPurpose: 'FULL_PAYMENT' as const, amount: order.grandTotal, currency: 'VND' as const,
        verificationStatus: 'PENDING' as const, createdAt: order.createdAt,
      };
    },
  } satisfies OrderWriteRepository;
  const dependencies = {
    ...unusedDependencies,
    requirePublishedCatalog: () => true,
    paymentDestination: () => ({ bin: '123456', name: 'Configured bank', accountNumber: '1234567890', accountName: 'RECEIVER' }),
    transaction: async (operation) => operation({
      orders,
      notifications: {
        async storeOrderCreated() {},
        storePaymentDeclared: unexpectedOperation,
        storePaymentVerified: unexpectedOperation,
        paymentVerified: unexpectedOperation,
        paymentDeclared: unexpectedOperation,
      },
    }),
  } satisfies OrderDependencies;
  const input = orderInput();
  input.items[0].color = 'Màu giả';
  input.items[0].material = 'Vật liệu giả';
  const result = await createCheckout(dependencies)(input);
  assert.equal(created?.subtotal, 500000);
  assert.equal(created?.shippingFee, 0);
  assert.equal(result.payment?.amount, 500000);
  assert.equal(savedItems[0].itemName, 'Tên trong catalogue');
  assert.equal(savedItems[0].unitPrice, 250000);
  assert.equal(savedItems[0].productVariantId, 'variant-id');
  assert.equal(savedItems[0].material, 'PETG');
  assert.equal(savedItems[0].color, 'Đỏ');
});

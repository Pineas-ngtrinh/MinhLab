import type { PoolClient } from 'pg';
import type { OrderNotifications } from '../../services/orders/order.ports';
import { orderEmailNotifications } from './order-email';
import {
  enqueueTelegramNotification,
  paymentDeclarationDedupKey,
  telegramOrderCreatedMessage,
  telegramPaymentDeclaredMessage,
} from './telegram-outbox';

/** Combines customer/store email outbox with internal Telegram alerts. */
export function orderNotifications(client: PoolClient): OrderNotifications {
  const email = orderEmailNotifications(client);
  return {
    ...email,
    async storeOrderCreated(payload) {
      await enqueueTelegramNotification(client, {
        dedupKey: `order-created:${payload.orderNumber}`,
        type: 'STORE_ORDER_CREATED',
        orderNumber: payload.orderNumber,
        body: telegramOrderCreatedMessage(payload),
      });
    },
    async storePaymentDeclared(payload) {
      await enqueueTelegramNotification(client, {
        dedupKey: paymentDeclarationDedupKey(payload.orderNumber, payload.transactionReference, payload.declarationId),
        type: 'STORE_PAYMENT_DECLARED',
        orderNumber: payload.orderNumber,
        body: telegramPaymentDeclaredMessage(payload),
      });
    },
    async storePaymentVerified() {},
  };
}

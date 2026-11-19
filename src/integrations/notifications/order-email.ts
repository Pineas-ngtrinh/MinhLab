import type { PoolClient } from 'pg';
import type { OrderNotifications } from '../../services/orders/order.ports';
import { EmailService } from './payment-email';

type OrderEmailNotifications = Pick<OrderNotifications, 'paymentVerified' | 'paymentDeclared'>;

/** These calls only persist outbox records, using the order transaction's client. */
export function orderEmailNotifications(client: PoolClient): OrderEmailNotifications {
  return {
    async paymentVerified(payload) { await EmailService.sendCustomerPaymentVerifiedEmail(payload, client); },
    async paymentDeclared(payload) { await EmailService.sendPaymentDeclaredToStore(payload, client); },
  };
}

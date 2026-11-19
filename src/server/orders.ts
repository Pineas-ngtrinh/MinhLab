import { lockPrivateFileLifecycle } from '../repositories/print-requests/file-retention.repository';
import { withTransaction } from '../lib/db';
import { manualVietQrDestination } from './payment-config';
import type { ProductionQueueItem } from '../contracts/workshop';
import { readProductionProgress } from '../repositories/orders/production-progress.repository';
import { orderReadRepository } from '../repositories/orders/order-read.repository';
import { PostgresOrderWriteRepository } from '../repositories/orders/order-write.repository';
import { orderNotifications } from '../integrations/notifications/order-notifications';
import { createCheckout } from '../services/orders/order-checkout.service';
import { createOrderWorkflows } from '../services/orders/order-workflows.service';
import {
  presentOrder,
  presentPayment,
  presentDetails,
  presentCheckout,
  presentPaymentAttachment,
} from '../services/orders/order-presenter';
import type { OrderDependencies } from '../services/orders/order.ports';

const dependencies: OrderDependencies = {
  paymentDestination: manualVietQrDestination,
  read: orderReadRepository,
  requirePublishedCatalog: () => process.env.NODE_ENV === 'production',
  transaction: (operation) =>
    withTransaction(async (client) => {
      await lockPrivateFileLifecycle(client);
      return operation({
        orders: new PostgresOrderWriteRepository(client),
        notifications: orderNotifications(client),
      });
    }),
};
const checkout = createCheckout(dependencies);
const workflows = createOrderWorkflows(dependencies);

/** Public server facade: preserve the existing API shapes at this boundary. */
export const OrderService = {
  async getProductionQueue(options: Parameters<typeof dependencies.read.getOrdersPage>[0]) {
    const page = await dependencies.read.getOrdersPage({
      ...options,
      status: options.status ?? 'IN_PRODUCTION',
    });
    return {
      ...page,
      data: page.data.map(
        ({ order, items }): ProductionQueueItem => ({
          orderNumber: order.orderNumber,
          status: order.orderStatus,
          items: items.map((item) => ({
            name: item.itemNameSnapshot,
            quantity: item.quantity,
            material: item.materialSnapshot,
            color: item.colorSnapshot,
          })),
        }),
      ),
    };
  },
  async createOrder(...args: Parameters<typeof checkout>) {
    return presentCheckout(await checkout(...args));
  },
  async getOrderByNumber(...args: Parameters<typeof workflows.getOrderByNumber>) {
    const value = await workflows.getOrderByNumber(...args);
    if(!value)return null;
    const progress=await readProductionProgress([value.order.orderNumber]);
    return {...presentDetails(value),production:progress.get(value.order.orderNumber)??[]};
  },
  async getCustomerOrdersPage(
    id: string,
    options: Parameters<typeof dependencies.read.getCustomerOrdersPage>[1],
  ) {
    const page = await dependencies.read.getCustomerOrdersPage(id, options);
    const progress=await readProductionProgress(page.data.map(v=>v.order.orderNumber));
    return { ...page, data: page.data.map(v=>({...presentDetails(v),production:progress.get(v.order.orderNumber)??[]})) };
  },
  async getOrdersPage(...args: Parameters<typeof dependencies.read.getOrdersPage>) {
    const page = await dependencies.read.getOrdersPage(...args);
    return { ...page, data: page.data.map(presentDetails) };
  },
  async getPaymentsPage(...args: Parameters<typeof dependencies.read.getPaymentsPage>) {
    const page = await dependencies.read.getPaymentsPage(...args);
    return {
      ...page,
      data: page.data.map((value) => ({
        payment: presentPayment(value.payment),
        order: value.order ? presentOrder(value.order) : undefined,
        attachments: value.attachments.map(presentPaymentAttachment),
      })),
    };
  },
  async declarePayment(...args: Parameters<typeof workflows.declarePayment>) {
    const value = await workflows.declarePayment(...args);
    return { order: presentOrder(value.order), payment: presentPayment(value.payment) };
  },
  async verifyPayment(...args: Parameters<typeof workflows.verifyPayment>) {
    const value = await workflows.verifyPayment(...args);
    return {
      order: presentOrder(value.order),
      payment: presentPayment(value.payment),
      alreadyVerified: value.alreadyVerified,
    };
  },
  async rejectPayment(...args: Parameters<typeof workflows.rejectPayment>) {
    const value = await workflows.rejectPayment(...args);
    return { order: presentOrder(value.order), payment: presentPayment(value.payment), alreadyRejected: value.alreadyRejected };
  },
  async updateOrderStatus(...args: Parameters<typeof workflows.updateOrderStatus>) {
    return presentOrder(await workflows.updateOrderStatus(...args));
  },
  async archiveOrder(...args: Parameters<typeof workflows.archiveOrder>) {
    return workflows.archiveOrder(...args);
  },
};

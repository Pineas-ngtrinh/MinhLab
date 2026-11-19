import { lockPrivateFileLifecycle } from '../repositories/print-requests/file-retention.repository';
import { withTransaction } from '../lib/db';
import { PostgresOrderReturnRepository } from '../repositories/orders/order-return.repository';
import { createOrderReturnService } from '../services/orders/order-return.service';

const service = createOrderReturnService({
  transaction: (operation) => withTransaction(async (client) => {
    await lockPrivateFileLifecycle(client);
    return operation(new PostgresOrderReturnRepository(client));
  }),
});

export const OrderReturns = service;

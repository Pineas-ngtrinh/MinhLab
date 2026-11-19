import { getDbPool } from '../lib/db';
import { deliverQueuedMail } from '../integrations/notifications/mail-delivery';

/** The account transaction has committed; a provider outage must not undo registration. */
export async function deliverAccountMail(id: string | null): Promise<void> {
  if (!id) return;
  try {
    await deliverQueuedMail(getDbPool(), id);
  } catch {
    process.stderr.write('Không thể gửi email ngay; email vẫn nằm trong outbox để thử lại.\n');
  }
}

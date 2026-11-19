import { AppError } from '../lib/errors';
import { query } from '../lib/db';
import { OrderService } from './orders';
import {
  answerTelegramCallback,
  completeTelegramPaymentMessage,
  updateTelegramPaymentKeyboard,
  type TelegramPaymentCallback,
} from '../integrations/notifications/telegram-webhook';
import {parseTelegramPaymentAction, telegramPaymentActions, telegramPaymentRejectionChoices} from '../integrations/notifications/telegram-payment-actions';

export async function handleTelegramPaymentCallback(callback: TelegramPaymentCallback, baseUrl: string): Promise<void> {
  const configuredChatId = process.env.TELEGRAM_CHAT_ID?.trim();
  const action = parseTelegramPaymentAction(callback.data);
  if (!action || !configuredChatId || callback.chatId !== configuredChatId) {
    await answerTelegramCallback(callback.callbackQueryId, 'Bạn không có quyền hoặc nút xác nhận không còn hợp lệ.', true);
    return;
  }

  const notificationId = action.notificationId;
  const notification = await query<{
    approver_id: string;
    order_number: string;
    body_text: string;
    transaction_reference: string | null;
    transferred_at: Date;
    verification_status: string;
  }>(
    `SELECT u.id AS approver_id, t.order_number, t.body_text, p.transaction_reference, p.transferred_at, p.verification_status
       FROM telegram_outbox t
       JOIN orders o ON o.order_number = t.order_number
       JOIN LATERAL (
         SELECT transaction_reference, transferred_at, verification_status
           FROM payments
          WHERE order_id = o.id
          ORDER BY created_at DESC, id DESC
          LIMIT 1
      ) p ON p.transferred_at IS NOT NULL AND t.created_at = p.transferred_at
      JOIN users u ON u.telegram_user_id=$3 AND u.status='ACTIVE' AND u.deleted_at IS NULL
      JOIN user_roles ur ON ur.user_id=u.id
      JOIN roles r ON r.id=ur.role_id AND r.is_active=true AND r.code IN ('ADMIN')
      WHERE t.id = $1 AND t.notification_type = 'STORE_PAYMENT_DECLARED'
        AND t.status = 'SENT' AND t.provider_message_id = $2`,
    [notificationId, callback.messageId, callback.telegramUserId],
  );
  const row = notification.rows[0];
  if (!row) {
    await answerTelegramCallback(callback.callbackQueryId, 'Thông báo đã hết hiệu lực hoặc tài khoản không còn quyền đối soát. Hãy kiểm tra trên website.', true);
    return;
  }

  const approverId = row.approver_id;
  if (action.kind === 'reject-menu' || action.kind === 'back') {
    if (row.verification_status !== 'PENDING') {
      await answerTelegramCallback(callback.callbackQueryId, 'Khai báo này đã được xử lý. Hãy kiểm tra trên website.', true);
      return;
    }
    try {
      await updateTelegramPaymentKeyboard(callback.chatId, callback.messageId,
        action.kind === 'reject-menu' ? telegramPaymentRejectionChoices(notificationId) : telegramPaymentActions(notificationId));
      await answerTelegramCallback(callback.callbackQueryId, action.kind === 'reject-menu' ? 'Chọn lý do từ chối; đơn vẫn chờ thanh toán.' : 'Chọn thao tác sau khi đã kiểm tra ngân hàng.');
    } catch {
      await answerTelegramCallback(callback.callbackQueryId, 'Chưa đổi được các nút. Hãy mở website để xử lý.', true);
    }
    return;
  }

  const declaration = {telegramUserId: callback.telegramUserId, reference: row.transaction_reference, transferredAt: row.transferred_at.toISOString()};
  if (action.kind === 'reject') {
    try {
      const result = await OrderService.rejectPayment(row.order_number, approverId, action.reason, declaration);
      await answerTelegramCallback(callback.callbackQueryId, result.alreadyRejected ? 'Khai báo này đã được từ chối trước đó.' : 'Đã từ chối khai báo. Đơn vẫn chờ thanh toán.');
    } catch (error) {
      if (!(error instanceof AppError) || error.status >= 500) throw error;
      await answerTelegramCallback(callback.callbackQueryId, 'Không thể từ chối: quyền hoặc khai báo đã thay đổi. Hãy kiểm tra trên website.', true);
      return;
    }
    try {
      await completeTelegramPaymentMessage(callback.chatId, callback.messageId,
        `${row.body_text.slice(0, 3800)}\n\n❌ Đã từ chối khai báo: ${action.reason}\nĐơn vẫn chờ thanh toán; khách có thể bổ sung và khai báo lại.`);
    } catch { process.stderr.write('Telegram payment callback: could not update the rejected message.\n'); }
    return;
  }

  let result;
  try {
    result = await OrderService.verifyPayment(row.order_number, approverId, baseUrl, declaration);
  } catch (error) {
    if (error instanceof AppError && error.status === 403) {
      await answerTelegramCallback(callback.callbackQueryId, 'Tài khoản website không còn quyền đối soát.', true);
      return;
    }
    if (error instanceof AppError && error.status < 500) {
      await answerTelegramCallback(callback.callbackQueryId, 'Đơn đã thay đổi hoặc chưa thể xác nhận. Hãy kiểm tra lại trong website.', true);
      return;
    }
    throw error;
  }

  await answerTelegramCallback(
    callback.callbackQueryId,
    result.alreadyVerified ? 'Khoản này đã được xác nhận trước đó.' : 'Đã xác nhận và cập nhật đơn trên website.',
  );
  try {
    await completeTelegramPaymentMessage(
      callback.chatId,
      callback.messageId,
      `${row.body_text}\n\n✅ ${result.alreadyVerified ? 'Khoản thanh toán đã được xác nhận trước đó.' : 'Đã đối soát trên Telegram; website đã cập nhật đơn.'}`,
    );
  } catch {
    process.stderr.write('Telegram payment callback: could not update the notification message.\n');
  }
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
export const PAYMENT_REJECTION_REASONS = {
  short: 'Khách chuyển khoản thiếu; cần bổ sung và khai báo lại.',
  missing: 'Chưa tìm thấy tiền vào tài khoản; cần kiểm tra và khai báo lại.',
  mismatch: 'Thông tin chuyển khoản chưa khớp với đơn; cần kiểm tra và khai báo lại.',
} as const;
type ReasonCode = keyof typeof PAYMENT_REJECTION_REASONS;
export type TelegramPaymentAction =
  | {kind: 'verify' | 'reject-menu' | 'back'; notificationId: string}
  | {kind: 'reject'; notificationId: string; reason: string};

export function parseTelegramPaymentAction(data: string): TelegramPaymentAction | null {
  const action = new RegExp(`^(verify-payment|reject-payment|payment-actions):(${UUID})$`, 'i').exec(data);
  if (action) return {kind: action[1].toLowerCase() === 'verify-payment' ? 'verify' : action[1].toLowerCase() === 'reject-payment' ? 'reject-menu' : 'back', notificationId: action[2]};
  const rejection = new RegExp(`^reject-payment:(short|missing|mismatch):(${UUID})$`, 'i').exec(data);
  if (!rejection) return null;
  return {kind: 'reject', notificationId: rejection[2], reason: PAYMENT_REJECTION_REASONS[rejection[1].toLowerCase() as ReasonCode]};
}

export function telegramPaymentActions(notificationId: string) {
  return {inline_keyboard: [
    [{text: 'Đã kiểm tra, xác nhận tiền về', callback_data: `verify-payment:${notificationId}`}],
    [{text: 'Từ chối khai báo chuyển khoản', callback_data: `reject-payment:${notificationId}`}],
  ]};
}

export function telegramPaymentRejectionChoices(notificationId: string) {
  return {inline_keyboard: [
    [{text: 'Chuyển khoản thiếu', callback_data: `reject-payment:short:${notificationId}`}],
    [{text: 'Chưa thấy tiền về', callback_data: `reject-payment:missing:${notificationId}`}],
    [{text: 'Thông tin chưa khớp', callback_data: `reject-payment:mismatch:${notificationId}`}],
    [{text: 'Quay lại', callback_data: `payment-actions:${notificationId}`}],
  ]};
}

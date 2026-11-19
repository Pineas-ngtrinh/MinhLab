export interface TelegramLinkStatus {
  linkedId: string | null;
  pending: { requestId: string; name: string; telegramId: string } | null;
  waiting: boolean;
}
export interface TelegramStartIdentity { token: string; telegramId: string; name: string }

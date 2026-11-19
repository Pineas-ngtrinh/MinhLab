import { AppError, RateLimitError } from '../../lib/errors';
import type { TelegramLinkStatus, TelegramStartIdentity } from '../../contracts/telegram-link';

export interface TelegramLinkRepository {
  status(userId: string): Promise<TelegramLinkStatus>;
  start(userId: string, requestId: string, hash: string): Promise<void>;
  propose(hash: string, identity: TelegramStartIdentity): Promise<boolean>;
  confirm(userId: string, requestId: string): Promise<void>;
  unlink(userId: string): Promise<void>;
}
export interface TelegramLinkDependencies {
  repository: TelegramLinkRepository;
  recordAttempt(key: string): Promise<number>;
  hash(value: string): string;
  token(): string;
  requestId(): string;
  botUsername(): Promise<string>;
}

export function createTelegramLinkService(deps: TelegramLinkDependencies) {
  return {
    status: (id: string) => deps.repository.status(id),
    async start(userId: string) {
      if (await deps.recordAttempt(deps.hash(`telegram-link:${userId}`)) > 5) throw new RateLimitError('Đã tạo quá nhiều liên kết. Vui lòng thử lại sau 15 phút.');
      const username = await deps.botUsername();
      const token = deps.token();
      await deps.repository.start(userId, deps.requestId(), deps.hash(token));
      return { url: `https://t.me/${username}?start=link_${token}` };
    },
    async propose(identity: TelegramStartIdentity) {
      if (!/^[A-Za-z0-9_-]{43}$/.test(identity.token) || !/^[1-9][0-9]{0,19}$/.test(identity.telegramId)) return false;
      return deps.repository.propose(deps.hash(identity.token), { ...identity, name: identity.name.slice(0, 160) });
    },
    async confirm(userId: string, requestId: string) {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestId)) throw new AppError('Yêu cầu liên kết không hợp lệ.');
      await deps.repository.confirm(userId, requestId);
      return deps.repository.status(userId);
    },
    async unlink(userId: string) {
      await deps.repository.unlink(userId);
      return deps.repository.status(userId);
    },
  };
}

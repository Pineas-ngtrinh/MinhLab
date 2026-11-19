import { randomUUID } from 'node:crypto';
import { withTransaction, query } from '../lib/db';
import { authTokens } from '../integrations/auth/credentials';
import { telegramBotUsername } from '../integrations/notifications/telegram-link';
import { PostgresTelegramLinkRepository } from '../repositories/auth/telegram-link.repository';
import { PostgresAuthRepository } from '../repositories/auth/auth.repository';
import { createTelegramLinkService } from '../services/auth/telegram-link.service';
import { requiresEmailVerification } from './auth-config';

export const TelegramLinkService = createTelegramLinkService({
  repository: new PostgresTelegramLinkRepository(withTransaction, requiresEmailVerification),
  recordAttempt: key => new PostgresAuthRepository({ query }).recordAttempt(key),
  hash: authTokens.hash, token: authTokens.create, requestId: randomUUID, botUsername: telegramBotUsername,
});

import { query, withTransaction } from '../lib/db';
import { authPasswords, authTokens } from '../integrations/auth/credentials';
import { accountEmailNotifications } from '../integrations/notifications/account-email';
import { PostgresAuthRepository } from '../repositories/auth/auth.repository';
import { createAuthService } from '../services/auth/auth.service';
import { adminBootstrapAccount, assertMailConfigured, requiresEmailVerification } from './auth-config';

/** Composition root keeps PostgreSQL, crypto and environment outside the use cases. */
export const AuthService = createAuthService({
  accounts: new PostgresAuthRepository({ query }),
  passwords: authPasswords,
  tokens: authTokens,
  requireVerifiedEmail: requiresEmailVerification,
  assertMailConfigured,
  bootstrapAccount: adminBootstrapAccount,
  transaction: operation => withTransaction(client => operation({
    accounts: new PostgresAuthRepository(client),
    notifications: accountEmailNotifications(client, () => process.env.NEXT_PUBLIC_SITE_URL),
  })),
});

export const verifyAccountEmail = AuthService.verifyAccountEmail;

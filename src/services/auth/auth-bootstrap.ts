import { ROLES } from '../../lib/auth-roles';
import { normalizeAccountEmail } from '../../domain/auth/account';
import type { AuthDependencies } from './auth.ports';

/** Bootstrap is retriable and never promotes an existing account from environment data. */
export function createAuthBootstrap(dependencies: AuthDependencies): () => Promise<void> {
  let pending: Promise<void> | undefined;
  return async () => {
    pending ??= dependencies.transaction(async ({ accounts }) => {
      for (const role of Object.values(ROLES)) await accounts.ensureRole(role);
      const admin = dependencies.bootstrapAccount();
      if (!admin) return;
      const normalizedEmail = normalizeAccountEmail(admin.email);
      const id = await accounts.createBootstrapAccount({
        email: admin.email,
        normalizedEmail,
        phone: null,
        passwordHash: await dependencies.passwords.hash(admin.password),
        fullName: admin.fullName,
        role: 'ADMIN',
        status: 'ACTIVE',
      });
      if (id) await accounts.grantRole(id, 'ADMIN');
      else if (!await accounts.hasRole(normalizedEmail, 'ADMIN')) {
        throw new Error('Bootstrap từ chối tự nâng quyền tài khoản đã tồn tại. Hãy cấp quyền qua quy trình quản trị riêng.');
      }
    }).catch((error: unknown) => {
      pending = undefined;
      throw error;
    });
    await pending;
  };
}

import { AppError, RateLimitError } from '../../lib/errors';
import { accountIdentity, isAuthToken, normalizeAccountEmail, type AccountActionPurpose } from '../../domain/auth/account';
import { createAuthBootstrap } from './auth-bootstrap';
import type { AuthDependencies, AuthTransaction, RegisterAccountInput } from './auth.ports';

const INVALID_LOGIN = 'Email hoặc mật khẩu không chính xác.';
const INVALID_RESET = 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.';
const INVALID_VERIFICATION = 'Mã xác minh không hợp lệ hoặc đã hết hạn. Bạn có thể yêu cầu gửi mã mới.';

function validatePassword(password: string): void {
  if (password.length < 8 || password.length > 128) throw new AppError('Mật khẩu cần từ 8 đến 128 ký tự.');
}

export function createAuthService(dependencies: AuthDependencies) {
  const bootstrap = createAuthBootstrap(dependencies);

  async function queueAccountAction(context: AuthTransaction, user: { id: string; email: string }, purpose: AccountActionPurpose) {
    const token = purpose === 'EMAIL_VERIFICATION' ? dependencies.tokens.createEmailCode() : dependencies.tokens.create();
    const hash = dependencies.tokens.hash(purpose === 'EMAIL_VERIFICATION' ? `email-code:${normalizeAccountEmail(user.email)}:${token}` : token);
    await context.accounts.replaceAccountToken(user.id, purpose, hash);
    return context.notifications.accountAction(user, purpose, token, hash);
  }

  return {
    async register(input: RegisterAccountInput) {
      const email = input.email.trim();
      const normalizedEmail = normalizeAccountEmail(email);
      if (!normalizedEmail || !input.fullName?.trim() || !input.password) {
        throw new AppError('Vui lòng điền đầy đủ Họ tên, Email và Mật khẩu.');
      }
      if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new AppError('Email không hợp lệ.');
      validatePassword(input.password);
      if (input.fullName.trim().length > 120) throw new AppError('Họ tên không được vượt quá 120 ký tự.');
      if (input.phone && !/^\+?[0-9 ()-]{8,20}$/.test(input.phone)) throw new AppError('Số điện thoại không hợp lệ.');
      const verifyEmail = dependencies.requireVerifiedEmail();
      if (verifyEmail) dependencies.assertMailConfigured();
      await bootstrap();
      const passwordHash = await dependencies.passwords.hash(input.password);
      try {
        return await dependencies.transaction(async context => {
          const account = await context.accounts.createAccount({
            email, normalizedEmail, phone: input.phone?.trim() || null,
            passwordHash, fullName: input.fullName.trim(),
            status: verifyEmail ? 'PENDING' : 'ACTIVE', role: 'CUSTOMER',
          });
          await context.accounts.grantRole(account.id, 'CUSTOMER');
          const notificationId = verifyEmail ? await queueAccountAction(context, account, 'EMAIL_VERIFICATION') : null;
          return { ...accountIdentity(account), notificationId };
        });
      } catch (error: unknown) {
        if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
          throw new AppError('Email hoặc số điện thoại này đã được sử dụng. Vui lòng đăng nhập hoặc chọn thông tin khác.');
        }
        throw error;
      }
    },

    async login(email: string, password: string) {
      if (email.length > 255 || password.length > 128) throw new AppError(INVALID_LOGIN, 401);
      await bootstrap();
      const normalizedEmail = normalizeAccountEmail(email);
      const key = dependencies.tokens.hash(normalizedEmail);
      if (await dependencies.accounts.recordAttempt(key) > 10) {
        throw new RateLimitError('Đã thử đăng nhập quá nhiều lần. Vui lòng thử lại sau 15 phút.');
      }
      const account = await dependencies.accounts.findAccount(normalizedEmail);
      if (!account || !await dependencies.passwords.verify(password, account.passwordHash)) {
        throw new AppError(INVALID_LOGIN, 401);
      }
      if (dependencies.requireVerifiedEmail() && !account.emailVerifiedAt) throw new AppError('Vui lòng xác minh email trước khi đăng nhập.', 401);
      if (account.status !== 'ACTIVE') throw new AppError('Tài khoản hiện đang bị khóa hoặc chưa kích hoạt.', 401);
      await dependencies.accounts.clearAttempts(key);
      await dependencies.accounts.recordLogin(account.id);
      return accountIdentity(account);
    },

    async requestAccountEmail(email: string, purpose: AccountActionPurpose): Promise<string | null> {
      dependencies.assertMailConfigured();
      const normalizedEmail = normalizeAccountEmail(email);
      const key = dependencies.tokens.hash(`${purpose}:${normalizedEmail}`);
      if (await dependencies.accounts.recordAttempt(key) > 3) {
        throw new RateLimitError('Đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau 15 phút.');
      }
      return dependencies.transaction(async context => {
        const account = await context.accounts.lockAccountContact(normalizedEmail);
        if (!account || (purpose === 'EMAIL_VERIFICATION' && account.emailVerifiedAt)) return null;
        return queueAccountAction(context, account, purpose);
      });
    },

    // Đổi trạng thái và đánh dấu mã đã dùng trong cùng giao dịch để mã không bị dùng hai lần.
    async verifyAccountEmail(token: string, email?: string): Promise<void> {
      const isCode = /^[0-9]{8}$/.test(token);
      const normalized = normalizeAccountEmail(email ?? '');
      if (isCode && (!normalized || normalized.length > 255)) throw new AppError(INVALID_VERIFICATION);
      if (!isCode && !isAuthToken(token)) throw new AppError(INVALID_VERIFICATION);
      if (isCode && await dependencies.accounts.recordAttempt(dependencies.tokens.hash(`verify-code:${normalized}`)) > 10) {
        throw new RateLimitError('Đã nhập mã quá nhiều lần. Vui lòng thử lại sau 15 phút.');
      }
      const hash = dependencies.tokens.hash(isCode ? `email-code:${normalized}:${token}` : token);
      await dependencies.transaction(async ({ accounts }) => {
        const id = await accounts.lockTokenAccount(hash, 'EMAIL_VERIFICATION');
        if (!id || !await accounts.hasUsableTokenAtCurrentTime(hash, 'EMAIL_VERIFICATION')) throw new AppError(INVALID_VERIFICATION);
        await accounts.verifyEmail(id);
        await accounts.consumeAccountTokens(id, 'EMAIL_VERIFICATION');
        if (isCode) await accounts.clearAttempts(dependencies.tokens.hash(`verify-code:${normalized}`));
      });
    },

    async resetPassword(token: string, password: string): Promise<void> {
      validatePassword(password);
      if (!isAuthToken(token)) throw new AppError(INVALID_RESET);
      const tokenHash = dependencies.tokens.hash(token);
      if (!await dependencies.accounts.hasUsableToken(tokenHash, 'PASSWORD_RESET')) {
        throw new AppError(INVALID_RESET);
      }
      const passwordHash = await dependencies.passwords.hash(password);
      await dependencies.transaction(async ({ accounts }) => {
        const id = await accounts.lockTokenAccount(tokenHash, 'PASSWORD_RESET');
        if (!id) throw new AppError(INVALID_RESET);
        if (!await accounts.hasUsableTokenAtCurrentTime(tokenHash, 'PASSWORD_RESET')) {
          throw new AppError(INVALID_RESET);
        }
        await accounts.updatePassword(id, passwordHash);
        await accounts.consumeAccountTokens(id, 'PASSWORD_RESET');
        await accounts.revokeAccountSessions(id);
      });
    },

    async createSession(user: { id: string }): Promise<string> {
      const token = dependencies.tokens.create();
      await dependencies.accounts.createSession(user.id, dependencies.tokens.hash(token));
      return token;
    },

    // Đọc lại vai trò và trạng thái tài khoản để việc thu hồi quyền có hiệu lực trên phiên cũ.
    async readSession(token: string | undefined) {
      if (!isAuthToken(token)) return null;
      return dependencies.accounts.findSession(dependencies.tokens.hash(token), dependencies.requireVerifiedEmail());
    },

    async revokeSession(token: string | undefined): Promise<void> {
      if (isAuthToken(token)) await dependencies.accounts.revokeSession(dependencies.tokens.hash(token));
    },
  };
}

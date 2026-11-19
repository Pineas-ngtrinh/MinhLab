import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { QueryResult, QueryResultRow } from 'pg';
import { createAuthService } from '../auth.service';
import type { AuthDependencies, AuthRepository, NewAccount } from '../auth.ports';
import type { Account, AccountActionPurpose } from '../../../domain/auth/account';
import { isAuthToken } from '../../../domain/auth/account';
import { authPasswords, authTokens } from '../../../integrations/auth/credentials';
import { mapAccount, mapSession } from '../../../repositories/auth/auth-mapping';
import { PostgresAuthRepository } from '../../../repositories/auth/auth.repository';
import { AppError, RateLimitError } from '../../../lib/errors';

const registration = { email: 'User@Example.test ', fullName: ' Người dùng ', password: 'password123' };

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 'account-1', email: 'user@example.test', fullName: 'Người dùng', role: 'CUSTOMER',
    status: 'ACTIVE', passwordHash: 'hash:password123', emailVerifiedAt: '2026-10-29T00:00:00.000Z',
    createdAt: '2026-10-29T00:00:00.000Z', updatedAt: '2026-10-29T00:00:00.000Z', ...overrides,
  };
}

interface StoredToken {
  userId: string;
  purpose: AccountActionPurpose;
  hash: string;
  used: boolean;
  expired: boolean;
}

/** In-memory unit of work exercises complete use cases without PostgreSQL or email delivery. */
function fixture(options: { requireVerification?: boolean; accounts?: Account[]; bootstrap?: boolean } = {}) {
  let state = {
    accounts: options.accounts ?? [] as Account[],
    tokens: [] as StoredToken[],
    sessions: [] as { userId: string; hash: string; revoked: boolean }[],
    outbox: [] as { email: string; purpose: AccountActionPurpose; token: string; hash: string }[],
    attempts: new Map<string, number>(),
    grants: [] as string[],
    transactionCount: 0,
    passwordHashes: 0,
    preflightChecks: 0,
    loginCount: 0,
  };
  let outboxFails = false;
  let revokeFails = false;
  let preflightRace: 'consume-token' | 'expire-token' | 'lock-account' | null = null;
  let expireWhileLockWait = false;
  let finalTokenChecks = 0;
  let lockedResetTokenHash: string | null = null;
  let transactionTail: Promise<void> = Promise.resolve();
  let tokenNumber = 0;

  function newAccount(input: NewAccount): Account {
    return account({
      id: `account-${state.accounts.length + 1}`, email: input.email, phone: input.phone ?? undefined,
      fullName: input.fullName, passwordHash: input.passwordHash, role: input.role,
      status: input.status, emailVerifiedAt: null,
    });
  }

  const accounts: AuthRepository = {
    async ensureRole() {},
    async createBootstrapAccount(input) {
      if (state.accounts.some(value => value.email.toLowerCase() === input.normalizedEmail)) return null;
      const value = newAccount(input);
      value.emailVerifiedAt = value.createdAt;
      state.accounts.push(value);
      return value.id;
    },
    async hasRole(email, role) { return state.accounts.some(value => value.email.toLowerCase() === email && value.role === role); },
    async grantRole(id, role) { state.grants.push(`${id}:${role}`); },
    async createAccount(input) {
      if (state.accounts.some(value => value.email.toLowerCase() === input.normalizedEmail)) throw { code: '23505' };
      const value = newAccount(input);
      state.accounts.push(value);
      return value;
    },
    async findAccount(email) { return state.accounts.find(value => value.email.toLowerCase() === email) ?? null; },
    async lockAccountContact(email) {
      const value = state.accounts.find(value => value.email.toLowerCase() === email && ['ACTIVE', 'PENDING'].includes(value.status));
      return value ? { id: value.id, email: value.email, emailVerifiedAt: value.emailVerifiedAt } : null;
    },
    async recordAttempt(key) {
      const count = (state.attempts.get(key) ?? 0) + 1;
      state.attempts.set(key, count);
      return count;
    },
    async clearAttempts(key) { state.attempts.delete(key); },
    async recordLogin() { state.loginCount++; },
    async replaceAccountToken(userId, purpose, hash) {
      await accounts.consumeAccountTokens(userId, purpose);
      state.tokens.push({ userId, purpose, hash, used: false, expired: false });
    },
    async hasUsableToken(hash, purpose) {
      state.preflightChecks++;
      const token = state.tokens.find(value => value.hash === hash && value.purpose === purpose && !value.used && !value.expired);
      const eligible = Boolean(token && state.accounts.some(value => value.id === token.userId && ['ACTIVE', 'PENDING'].includes(value.status)));
      if (eligible && token && preflightRace) {
        if (preflightRace === 'consume-token') token.used = true;
        if (preflightRace === 'expire-token') token.expired = true;
        if (preflightRace === 'lock-account') {
          const value = state.accounts.find(item => item.id === token.userId);
          if (value) value.status = 'LOCKED';
        }
        preflightRace = null;
      }
      return eligible;
    },
    async lockTokenAccount(hash, purpose) {
      const token = state.tokens.find(value => value.hash === hash && value.purpose === purpose && !value.used && !value.expired);
      const userId = token && state.accounts.some(value => value.id === token.userId && ['ACTIVE', 'PENDING'].includes(value.status)) ? token.userId : null;
      if (purpose === 'PASSWORD_RESET') lockedResetTokenHash = userId ? hash : null;
      if (userId && token && purpose === 'PASSWORD_RESET' && expireWhileLockWait) {
        token.expired = true;
        expireWhileLockWait = false;
      }
      return userId;
    },
    async hasUsableTokenAtCurrentTime(hash, purpose) {
      finalTokenChecks++;
      const followsLock = purpose === 'EMAIL_VERIFICATION' || (purpose === 'PASSWORD_RESET' && lockedResetTokenHash === hash);
      lockedResetTokenHash = null;
      const token = state.tokens.find(value => value.hash === hash && value.purpose === purpose && !value.used && !value.expired);
      const eligible = Boolean(token && state.accounts.some(value => value.id === token.userId && ['ACTIVE', 'PENDING'].includes(value.status)));
      return followsLock && eligible;
    },
    async consumeAccountTokens(userId, purpose) {
      for (const token of state.tokens) if (token.userId === userId && token.purpose === purpose) token.used = true;
    },
    async verifyEmail(id) {
      const value = state.accounts.find(item => item.id === id);
      if (value) { value.emailVerifiedAt = value.createdAt; value.status = 'ACTIVE'; }
    },
    async updatePassword(id, hash) {
      const value = state.accounts.find(item => item.id === id);
      if (value) value.passwordHash = hash;
    },
    async revokeAccountSessions(userId) {
      if (revokeFails) throw new Error('Session update failed');
      for (const session of state.sessions) if (session.userId === userId) session.revoked = true;
    },
    async createSession(userId, hash) { state.sessions.push({ userId, hash, revoked: false }); },
    async findSession(hash, requireVerification) {
      const session = state.sessions.find(value => value.hash === hash && !value.revoked);
      const value = state.accounts.find(item => item.id === session?.userId && item.status === 'ACTIVE');
      if (!value || (requireVerification && !value.emailVerifiedAt)) return null;
      return { id: value.id, email: value.email, fullName: value.fullName, phone: value.phone, role: value.role, expiresAt: 1234 };
    },
    async revokeSession(hash) {
      for (const session of state.sessions) if (session.hash === hash) session.revoked = true;
    },
  };
  const dependencies: AuthDependencies = {
    accounts,
    async transaction(operation) {
      state.transactionCount++;
      const previous = transactionTail;
      let release = () => {};
      transactionTail = new Promise<void>(resolve => { release = resolve; });
      await previous;
      const before = structuredClone(state);
      try {
        return await operation({
          accounts,
          notifications: {
            async accountAction(user, purpose, token, hash) {
              if (outboxFails) throw new Error('Outbox failed');
              state.outbox.push({ email: user.email, purpose, token, hash });
              return `mail-${state.outbox.length}`;
            },
          },
        });
      } catch (error: unknown) {
        state = before;
        throw error;
      } finally {
        release();
      }
    },
    passwords: {
      async hash(password) { state.passwordHashes++; return `hash:${password}`; },
      async verify(password, hash) { return hash === `hash:${password}`; },
    },
    tokens: { createEmailCode: () => (++tokenNumber).toString().padStart(8, '0'), create: () => (++tokenNumber).toString().padStart(43, 'a'), hash: authTokens.hash },
    requireVerifiedEmail: () => options.requireVerification ?? false,
    assertMailConfigured() {},
    bootstrapAccount: () => options.bootstrap ? { email: 'user@example.test', fullName: 'Quản trị viên', password: 'secure-admin-password' } : null,
  };
  return {
    service: createAuthService(dependencies),
    get state() { return { ...state, finalTokenChecks }; },
    failOutbox() { outboxFails = true; },
    failRevocation() { revokeFails = true; },
    invalidateAfterNextPreflight() { preflightRace = 'consume-token'; },
    expireAfterNextPreflight() { preflightRace = 'expire-token'; },
    lockAccountAfterNextPreflight() { preflightRace = 'lock-account'; },
    expireDuringNextLockWait() { expireWhileLockWait = true; },
  };
}

test('scrypt uses separate salts, validates the correct password and rejects malformed hashes', async () => {
  const first = await authPasswords.hash('password123');
  const second = await authPasswords.hash('password123');
  assert.notEqual(first, second);
  assert.equal(await authPasswords.verify('password123', first), true);
  assert.equal(await authPasswords.verify('wrong-password', first), false);
  for (const malformed of ['', 'sha256$abc$abc', first + '$', first + '$extra', first.replace('scrypt$', 'scrypt$bad')]) {
    assert.equal(await authPasswords.verify('password123', malformed), false);
  }
});

test('post-lock repository check uses PostgreSQL wall-clock time in a separate query', async () => {
  let statement = '';
  let values: unknown[] = [];
  const repository = new PostgresAuthRepository({
    async query<Row extends QueryResultRow>(text: string, queryValues?: unknown[]): Promise<QueryResult<Row>> {
      statement = text;
      values = queryValues ?? [];
      return {
        command: 'SELECT', rowCount: 1, oid: 0, fields: [],
        rows: [{ usable: true } as unknown as Row],
      };
    },
  });
  assert.equal(await repository.hasUsableTokenAtCurrentTime('hashed-token', 'PASSWORD_RESET'), true);
  assert.match(statement, /expires_at\s*>\s*clock_timestamp\(\)/);
  assert.doesNotMatch(statement, /expires_at\s*>\s*now\(\)/);
  assert.deepEqual(values, ['hashed-token', 'PASSWORD_RESET']);
});

test('reset preflight and row-lock queries share token and account eligibility predicates', async () => {
  const statements: string[] = [];
  const repository = new PostgresAuthRepository({
    async query<Row extends QueryResultRow>(text: string): Promise<QueryResult<Row>> {
      statements.push(text);
      return {
        command: 'SELECT', rowCount: 1, oid: 0, fields: [],
        rows: (text.includes('FOR UPDATE') ? [{ user_id: 'account-1' }] : [{ usable: true }]) as unknown as Row[],
      };
    },
  });

  assert.equal(await repository.hasUsableToken('hashed-token', 'PASSWORD_RESET'), true);
  assert.equal(await repository.lockTokenAccount('hashed-token', 'PASSWORD_RESET'), 'account-1');
  assert.equal(statements.length, 2);

  const eligibility = [
    /t\.token_hash\s*=\s*\$1/i,
    /t\.purpose\s*=\s*\$2/i,
    /t\.used_at\s+IS\s+NULL/i,
    /t\.expires_at\s*>\s*now\(\)/i,
    /u\.deleted_at\s+IS\s+NULL/i,
    /u\.status\s+IN\s*\('ACTIVE','PENDING'\)/i,
  ];
  for (const statement of statements) {
    for (const condition of eligibility) assert.match(statement, condition);
  }
  assert.match(statements[1], /FOR UPDATE OF t,u/i);
});

test('opaque tokens remain 32 random bytes and hashes remain compatible SHA-256', () => {
  const token = authTokens.create();
  assert.equal(isAuthToken(token), true);
  assert.notEqual(authTokens.create(), token);
  assert.equal(authTokens.hash(token).length, 64);
  assert.equal(authTokens.hash('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('registration normalizes identity, assigns only CUSTOMER and returns no credentials', async () => {
  const context = fixture();
  const input = { ...registration, role: 'ADMIN' };
  const result = await context.service.register(input);
  assert.equal(result.email, 'User@Example.test');
  assert.equal(result.fullName, 'Người dùng');
  assert.equal(result.role, 'CUSTOMER');
  assert.equal(result.status, 'ACTIVE');
  assert.equal(result.notificationId, null);
  assert.deepEqual(context.state.grants, ['account-1:CUSTOMER']);
  assert.equal('passwordHash' in result, false);
  assert.equal('password_hash' in result, false);
  assert.equal('emailVerifiedAt' in result, false);
});

test('invalid registration performs no bootstrap, hashing, persistence or email', async () => {
  const context = fixture();
  for (const input of [
    { ...registration, email: 'invalid' }, { ...registration, password: 'short' },
    { ...registration, fullName: ' ' }, { ...registration, phone: 'letters' },
  ]) await assert.rejects(context.service.register(input), AppError);
  assert.equal(context.state.transactionCount, 0);
  assert.equal(context.state.passwordHashes, 0);
  assert.equal(context.state.outbox.length, 0);
});

test('verification registration stores a token hash and queues its raw capability only in the email', async () => {
  const context = fixture({ requireVerification: true });
  const result = await context.service.register(registration);
  assert.equal(result.status, 'PENDING');
  assert.equal(result.notificationId, 'mail-1');
  assert.equal(context.state.tokens.length, 1);
  assert.equal(context.state.outbox.length, 1);
  assert.equal(context.state.tokens[0].hash, authTokens.hash(`email-code:user@example.test:${context.state.outbox[0].token}`));
  assert.notEqual(context.state.tokens[0].hash, context.state.outbox[0].token);
  assert.equal(context.state.tokens[0].purpose, 'EMAIL_VERIFICATION');
});

test('outbox failure rolls registration and token creation back together', async () => {
  const context = fixture({ requireVerification: true });
  context.failOutbox();
  await assert.rejects(context.service.register(registration), /Outbox failed/);
  assert.equal(context.state.accounts.length, 0);
  assert.equal(context.state.tokens.length, 0);
  assert.equal(context.state.grants.length, 0);
});

test('duplicate registration returns a deliberate validation error', async () => {
  const context = fixture({ accounts: [account()] });
  await assert.rejects(context.service.register(registration), (error: unknown) => error instanceof AppError && error.status === 400);
});

test('login enforces verification/status, shares normalized rate-limit keys and hides private fields', async () => {
  const context = fixture({ requireVerification: true, accounts: [account({ emailVerifiedAt: null })] });
  await assert.rejects(context.service.login('USER@example.test ', 'password123'), /xác minh email/);
  context.state.accounts[0].emailVerifiedAt = '2026-10-29T00:00:00.000Z';
  context.state.accounts[0].status = 'LOCKED';
  await assert.rejects(context.service.login('user@example.test', 'password123'), /bị khóa/);
  context.state.accounts[0].status = 'ACTIVE';
  const result = await context.service.login('user@example.test', 'password123');
  assert.equal('passwordHash' in result, false);
  assert.equal(context.state.attempts.size, 0);
  assert.equal(context.state.loginCount, 1);
});

test('login refuses the eleventh attempt before credential verification', async () => {
  const context = fixture();
  for (let index = 0; index < 10; index++) await assert.rejects(context.service.login('user@example.test', 'bad'), /không chính xác/);
  await assert.rejects(context.service.login('USER@example.test ', 'bad'), RateLimitError);
  assert.equal(context.state.loginCount, 0);
});

test('unknown accounts and already-verified verification requests enqueue no email', async () => {
  const context = fixture({ accounts: [account()] });
  assert.equal(await context.service.requestAccountEmail('unknown@example.test', 'PASSWORD_RESET'), null);
  assert.equal(await context.service.requestAccountEmail('USER@example.test ', 'EMAIL_VERIFICATION'), null);
  assert.equal(context.state.outbox.length, 0);
  assert.equal(context.state.tokens.length, 0);
});

test('account-email attempts are purpose-scoped and stop after three requests', async () => {
  const context = fixture({ accounts: [account({ emailVerifiedAt: null })] });
  for (let index = 0; index < 3; index++) await context.service.requestAccountEmail('user@example.test', 'PASSWORD_RESET');
  await assert.rejects(context.service.requestAccountEmail('USER@example.test ', 'PASSWORD_RESET'), RateLimitError);
  await context.service.requestAccountEmail('user@example.test', 'EMAIL_VERIFICATION');
  assert.equal(context.state.outbox.length, 4);
  assert.equal(context.state.tokens.filter(token => token.purpose === 'PASSWORD_RESET' && !token.used).length, 1);
});

test('verification consumes its tokens once, activates pending accounts and cannot reset a password', async () => {
  const context = fixture({ accounts: [account({ status: 'PENDING', emailVerifiedAt: null })] });
  await context.service.requestAccountEmail('user@example.test', 'EMAIL_VERIFICATION');
  const token = context.state.outbox[0].token;
  await assert.rejects(context.service.resetPassword(token, 'new-password'), /không hợp lệ/);
  await context.service.verifyAccountEmail(token, 'user@example.test');
  assert.equal(context.state.accounts[0].status, 'ACTIVE');
  assert.ok(context.state.accounts[0].emailVerifiedAt);
  await assert.rejects(context.service.verifyAccountEmail(token, 'user@example.test'), /không hợp lệ/);
});

test('malformed reset token returns the existing generic error without a preflight query or scrypt', async () => {
  const context = fixture({ accounts: [account()] });
  await assert.rejects(context.service.resetPassword('malformed-token', 'new-password'), (error: unknown) =>
    error instanceof AppError && error.message === 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.' && error.status === 400);
  assert.equal(context.state.preflightChecks, 0);
  assert.equal(context.state.passwordHashes, 0);
});

test('fabricated reset token returns the existing generic error without scrypt', async () => {
  const context = fixture({ accounts: [account()] });
  await assert.rejects(context.service.resetPassword('a'.repeat(43), 'new-password'), (error: unknown) =>
    error instanceof AppError && error.message === 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.' && error.status === 400);
  assert.equal(context.state.preflightChecks, 1);
  assert.equal(context.state.passwordHashes, 0);
});

test('expired and consumed reset tokens fail preflight without scrypt', async () => {
  for (const stateName of ['expired', 'consumed'] as const) {
    const context = fixture({ accounts: [account()] });
    await context.service.requestAccountEmail('user@example.test', 'PASSWORD_RESET');
    const token = context.state.outbox[0].token;
    if (stateName === 'expired') context.state.tokens[0].expired = true;
    else context.state.tokens[0].used = true;
    await assert.rejects(context.service.resetPassword(token, 'new-password'), (error: unknown) =>
      error instanceof AppError && error.message === 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.' && error.status === 400);
    assert.equal(context.state.preflightChecks, 1);
    assert.equal(context.state.passwordHashes, 0);
    assert.equal(context.state.accounts[0].passwordHash, 'hash:password123');
  }
});

test('reset token for an ineligible account fails preflight without changing credentials', async () => {
  const context = fixture({ accounts: [account()] });
  await context.service.requestAccountEmail('user@example.test', 'PASSWORD_RESET');
  const token = context.state.outbox[0].token;
  context.state.accounts[0].status = 'LOCKED';
  await assert.rejects(context.service.resetPassword(token, 'new-password'), (error: unknown) =>
    error instanceof AppError && error.message === 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.' && error.status === 400);
  assert.equal(context.state.preflightChecks, 1);
  assert.equal(context.state.passwordHashes, 0);
  assert.equal(context.state.accounts[0].passwordHash, 'hash:password123');
});

test('token invalidated after preflight is rejected by final transactional verification', async () => {
  const context = fixture({ accounts: [account()] });
  await context.service.requestAccountEmail('user@example.test', 'PASSWORD_RESET');
  const token = context.state.outbox[0].token;
  context.invalidateAfterNextPreflight();
  await assert.rejects(context.service.resetPassword(token, 'new-password'), (error: unknown) =>
    error instanceof AppError && error.message === 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.' && error.status === 400);
  assert.equal(context.state.preflightChecks, 1);
  assert.equal(context.state.passwordHashes, 1);
  assert.equal(context.state.accounts[0].passwordHash, 'hash:password123');
});

test('expiration and account-status changes after preflight are rejected transactionally', async () => {
  for (const race of ['expiration', 'account-status'] as const) {
    const context = fixture({ accounts: [account()] });
    await context.service.requestAccountEmail('user@example.test', 'PASSWORD_RESET');
    const token = context.state.outbox[0].token;
    if (race === 'expiration') context.expireAfterNextPreflight();
    else context.lockAccountAfterNextPreflight();
    await assert.rejects(context.service.resetPassword(token, 'new-password'), (error: unknown) =>
      error instanceof AppError && error.message === 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.' && error.status === 400);
    assert.equal(context.state.passwordHashes, 1);
    assert.equal(context.state.accounts[0].passwordHash, 'hash:password123');
    if (race === 'expiration') assert.equal(context.state.tokens[0].expired, true);
    else assert.equal(context.state.accounts[0].status, 'LOCKED');
  }
});

test('token expiring while the final row lock waits is rejected before writes', async () => {
  const context = fixture({ accounts: [account()] });
  const session = await context.service.createSession({ id: 'account-1' });
  await context.service.requestAccountEmail('user@example.test', 'PASSWORD_RESET');
  const token = context.state.outbox[0].token;
  context.expireDuringNextLockWait();
  await assert.rejects(context.service.resetPassword(token, 'new-password'), (error: unknown) =>
    error instanceof AppError && error.message === 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.' && error.status === 400);
  assert.equal(context.state.preflightChecks, 1);
  assert.equal(context.state.finalTokenChecks, 1);
  assert.equal(context.state.passwordHashes, 1);
  assert.equal(context.state.accounts[0].passwordHash, 'hash:password123');
  assert.equal(context.state.tokens[0].used, false);
  assert.equal(context.state.sessions[0].revoked, false);
  assert.ok(await context.service.readSession(session));
});

test('concurrent resets using the same token allow at most one password change', async () => {
  const context = fixture({ accounts: [account()] });
  const session = await context.service.createSession({ id: 'account-1' });
  await context.service.requestAccountEmail('user@example.test', 'PASSWORD_RESET');
  const token = context.state.outbox[0].token;
  const attempts = await Promise.allSettled([
    context.service.resetPassword(token, 'first-new-password'),
    context.service.resetPassword(token, 'second-new-password'),
  ]);
  assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(attempts.filter(result => result.status === 'rejected').length, 1);
  assert.ok(['hash:first-new-password', 'hash:second-new-password'].includes(context.state.accounts[0].passwordHash));
  assert.equal(context.state.tokens[0].used, true);
  assert.equal(context.state.preflightChecks, 2);
  assert.equal(context.state.finalTokenChecks, 1);
  assert.equal(await context.service.readSession(session), null);
});

test('reset flow never logs raw tokens, token hashes or new passwords', async () => {
  const context = fixture({ accounts: [account()] });
  await context.service.requestAccountEmail('user@example.test', 'PASSWORD_RESET');
  const token = context.state.outbox[0].token;
  const writes: unknown[][] = [];
  const capture = (...values: unknown[]) => { writes.push(values); };
  const original = { log: console.log, info: console.info, warn: console.warn, error: console.error, debug: console.debug };
  console.log = capture;
  console.info = capture;
  console.warn = capture;
  console.error = capture;
  console.debug = capture;
  try {
    await context.service.resetPassword(token, 'new-password');
  } finally {
    console.log = original.log;
    console.info = original.info;
    console.warn = original.warn;
    console.error = original.error;
    console.debug = original.debug;
  }
  assert.deepEqual(writes, []);
  assert.equal(context.state.passwordHashes, 1);
});

test('password reset updates credentials, consumes tokens and revokes all account sessions atomically', async () => {
  const context = fixture({ accounts: [account()] });
  const session = await context.service.createSession({ id: 'account-1' });
  await context.service.createSession({ id: 'account-1' });
  await context.service.requestAccountEmail('user@example.test', 'PASSWORD_RESET');
  const token = context.state.outbox[0].token;
  await context.service.resetPassword(token, 'new-password');
  assert.equal(context.state.accounts[0].passwordHash, 'hash:new-password');
  assert.equal(context.state.passwordHashes, 1);
  assert.equal(context.state.preflightChecks, 1);
  assert.equal(context.state.finalTokenChecks, 1);
  assert.ok(context.state.sessions.every(value => value.revoked));
  assert.equal(await context.service.readSession(session), null);
  await assert.rejects(context.service.resetPassword(token, 'another-password'), /không hợp lệ/);
});

test('failed session revocation rolls password and token consumption back', async () => {
  const context = fixture({ accounts: [account()] });
  await context.service.requestAccountEmail('user@example.test', 'PASSWORD_RESET');
  context.failRevocation();
  await assert.rejects(context.service.resetPassword(context.state.outbox[0].token, 'new-password'), /Session update failed/);
  assert.equal(context.state.accounts[0].passwordHash, 'hash:password123');
  assert.equal(context.state.tokens[0].used, false);
});

test('expired tokens and tokens belonging to locked accounts cannot mutate credentials', async () => {
  const context = fixture({ accounts: [account()] });
  await context.service.requestAccountEmail('user@example.test', 'PASSWORD_RESET');
  const token = context.state.outbox[0].token;
  context.state.tokens[0].expired = true;
  await assert.rejects(context.service.resetPassword(token, 'new-password'), /không hợp lệ/);
  context.state.tokens[0].expired = false;
  context.state.accounts[0].status = 'LOCKED';
  await assert.rejects(context.service.resetPassword(token, 'new-password'), /không hợp lệ/);
  assert.equal(context.state.preflightChecks, 2);
  assert.equal(context.state.passwordHashes, 0);
  assert.equal(context.state.accounts[0].passwordHash, 'hash:password123');
});

test('sessions persist hashed capabilities, observe current role and verification and revoke on replay', async () => {
  const context = fixture({ accounts: [account()], requireVerification: true });
  const token = await context.service.createSession({ id: 'account-1' });
  assert.equal(context.state.sessions[0].hash, authTokens.hash(token));
  context.state.accounts[0].role = 'WORKSHOP_OPERATOR';
  assert.equal((await context.service.readSession(token))?.role, 'WORKSHOP_OPERATOR');
  context.state.accounts[0].emailVerifiedAt = null;
  assert.equal(await context.service.readSession(token), null);
  context.state.accounts[0].emailVerifiedAt = '2026-10-29T00:00:00.000Z';
  await context.service.revokeSession(token);
  assert.equal(await context.service.readSession(token), null);
  for (const invalid of [undefined, '', 'bad', 'a'.repeat(42), 'a'.repeat(44), '!'.repeat(43)]) {
    assert.equal(await context.service.readSession(invalid), null);
    await context.service.revokeSession(invalid);
  }
  assert.equal(context.state.sessions.length, 1);
});

test('bootstrap never elevates an existing customer and can retry after correcting deployment config', async () => {
  const context = fixture({ accounts: [account()], bootstrap: true });
  await assert.rejects(context.service.login('user@example.test', 'password123'), /từ chối tự nâng quyền/);
  assert.deepEqual(context.state.grants, []);
  assert.equal(context.state.accounts[0].role, 'CUSTOMER');
  context.state.accounts[0].role = 'ADMIN';
  assert.equal((await context.service.login('user@example.test', 'password123')).role, 'ADMIN');
});

test('database mappers enumerate domain fields and reject unknown roles', () => {
  const row = {
    id: 'id', email: 'user@example.test', phone: null, password_hash: 'secret', email_verified_at: null,
    full_name: 'Người dùng', status: 'ACTIVE' as const, role_code: 'CUSTOMER',
    created_at: new Date('2026-10-29T00:00:00Z'), updated_at: '2026-10-29T00:00:00Z', internal_note: 'private',
  };
  const mapped = mapAccount(row);
  assert.equal(mapped.phone, undefined);
  assert.equal(mapped.createdAt, '2026-10-29T00:00:00.000Z');
  assert.equal('internal_note' in mapped, false);
  assert.throws(() => mapAccount({ ...row, role_code: 'FORGED' }), /vai trò hợp lệ/);
  const sessionRow = { ...row, code: 'CUSTOMER', expires_at: row.created_at };
  const session = mapSession(sessionRow);
  assert.deepEqual(Object.keys(session ?? {}).sort(), ['email', 'expiresAt', 'fullName', 'id', 'phone', 'role']);
  assert.equal(mapSession({ ...sessionRow, code: 'FORGED' }), null);
});

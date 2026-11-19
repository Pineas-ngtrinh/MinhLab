import type { RegisterAccountInput } from '../../contracts/auth';
import type { RoleCode, RoleInfo } from '../../lib/auth-roles';
import type { Account, AccountContact, AccountActionPurpose, AuthSession } from '../../domain/auth/account';

export interface NewAccount {
  email: string;
  normalizedEmail: string;
  phone: string | null;
  passwordHash: string;
  fullName: string;
  status: Account['status'];
  role: RoleCode;
}

export interface AdminBootstrapAccount {
  email: string;
  password: string;
  fullName: string;
}

export interface AuthRepository {
  ensureRole(role: RoleInfo): Promise<void>;
  createBootstrapAccount(input: NewAccount): Promise<string | null>;
  hasRole(normalizedEmail: string, role: RoleCode): Promise<boolean>;
  grantRole(id: string, role: RoleCode): Promise<void>;
  createAccount(input: NewAccount): Promise<Account>;
  findAccount(normalizedEmail: string): Promise<Account | null>;
  lockAccountContact(normalizedEmail: string): Promise<AccountContact | null>;
  recordAttempt(keyHash: string): Promise<number>;
  clearAttempts(keyHash: string): Promise<void>;
  recordLogin(id: string): Promise<void>;
  replaceAccountToken(id: string, purpose: AccountActionPurpose, hash: string): Promise<void>;
  hasUsableToken(hash: string, purpose: AccountActionPurpose): Promise<boolean>;
  hasUsableTokenAtCurrentTime(hash: string, purpose: AccountActionPurpose): Promise<boolean>;
  lockTokenAccount(hash: string, purpose: AccountActionPurpose): Promise<string | null>;
  consumeAccountTokens(id: string, purpose: AccountActionPurpose): Promise<void>;
  verifyEmail(id: string): Promise<void>;
  updatePassword(id: string, hash: string): Promise<void>;
  revokeAccountSessions(id: string): Promise<void>;
  createSession(id: string, hash: string): Promise<void>;
  findSession(hash: string, requireVerifiedEmail: boolean): Promise<AuthSession | null>;
  revokeSession(hash: string): Promise<void>;
}

export interface AccountNotifications {
  accountAction(user: Pick<AccountContact, 'id' | 'email'>, purpose: AccountActionPurpose, token: string, hash: string): Promise<string>;
}

export interface AuthTransaction {
  accounts: AuthRepository;
  notifications: AccountNotifications;
}

export interface AuthDependencies {
  accounts: AuthRepository;
  transaction<T>(operation: (context: AuthTransaction) => Promise<T>): Promise<T>;
  passwords: {
    hash(password: string): Promise<string>;
    verify(password: string, hash: string): Promise<boolean>;
  };
  tokens: {
    create(): string;
    createEmailCode(): string;
    hash(token: string): string;
  };
  requireVerifiedEmail(): boolean;
  assertMailConfigured(): void;
  bootstrapAccount(): AdminBootstrapAccount | null;
}

export type { RegisterAccountInput };

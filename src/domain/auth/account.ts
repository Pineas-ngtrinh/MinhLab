import type { AuthUser } from '../../contracts/auth';

export type AccountStatus = 'ACTIVE' | 'PENDING' | 'LOCKED' | 'DISABLED';
export type AccountActionPurpose = 'EMAIL_VERIFICATION' | 'PASSWORD_RESET';

export interface AccountIdentity extends AuthUser {
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
}

/** Server-internal authentication record, never an API response. */
export interface Account extends AccountIdentity {
  passwordHash: string;
  emailVerifiedAt: string | null;
}

export interface AccountContact {
  id: string;
  email: string;
  emailVerifiedAt: string | null;
}

export interface AuthSession extends AuthUser {
  expiresAt: number;
}

export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

export function isAuthToken(token: string | undefined): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function normalizeAccountEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function accountIdentity(account: Account): AccountIdentity {
  return {
    id: account.id,
    email: account.email,
    fullName: account.fullName,
    phone: account.phone,
    role: account.role,
    status: account.status,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

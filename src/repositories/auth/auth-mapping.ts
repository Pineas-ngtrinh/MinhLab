import { isRoleCode } from '../../lib/auth-roles';
import type { Account, AuthSession } from '../../domain/auth/account';

export interface AccountRow {
  id: string;
  email: string;
  phone: string | null;
  password_hash: string;
  email_verified_at: Date | string | null;
  full_name: string;
  status: Account['status'];
  role_code: string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface SessionRow {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  code: string;
  expires_at: Date | string;
}

export function authTimestamp(value: Date | string): string {
  return new Date(value).toISOString();
}

export function mapAccount(row: AccountRow): Account {
  if (!isRoleCode(row.role_code)) throw new Error(`Tài khoản ${row.email} chưa được gán vai trò hợp lệ.`);
  return {
    id: row.id,
    email: row.email,
    phone: row.phone ?? undefined,
    passwordHash: row.password_hash,
    emailVerifiedAt: row.email_verified_at ? authTimestamp(row.email_verified_at) : null,
    fullName: row.full_name,
    status: row.status,
    role: row.role_code,
    createdAt: authTimestamp(row.created_at),
    updatedAt: authTimestamp(row.updated_at),
  };
}

export function mapSession(row: SessionRow): AuthSession | null {
  if (!isRoleCode(row.code)) return null;
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone ?? undefined,
    role: row.code,
    expiresAt: new Date(row.expires_at).getTime(),
  };
}

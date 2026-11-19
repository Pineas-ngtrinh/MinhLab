import type { RoleCode } from '../lib/auth-roles';
import type { PageResult } from './pagination';

export interface WorkshopOperatorAccount {
  id: string;
  email: string;
  fullName: string;
  status: string;
  emailVerified: boolean;
}

export interface ManagedAccount extends WorkshopOperatorAccount {
  telegramUserId?: string | null;
  roles: RoleCode[];
  effectiveRole: RoleCode | null;
}

export interface LinkTelegramAccount {
  action: 'LINK_TELEGRAM';
  userId: string;
  telegramUserId: string | null;
  expectedTelegramUserId: string | null;
  reason: string;
}

export type ManagedAccountsPage = PageResult<ManagedAccount> & { requireVerifiedEmail: boolean };

export interface AssignAccountRole {
  userId: string;
  role: RoleCode;
  expectedRoles: RoleCode[];
  reason: string;
}

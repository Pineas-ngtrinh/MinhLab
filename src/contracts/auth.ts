import type { RoleCode } from '../lib/auth-roles';

/** Public account data; credentials and database rows never cross this boundary. */
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: RoleCode;
}

export interface RegisterAccountInput {
  email: string;
  fullName: string;
  phone?: string;
  password: string;
}

export interface RegistrationResult {
  user: AuthUser;
  requiresEmailVerification: boolean;
}

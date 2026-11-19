import { NextRequest, NextResponse } from 'next/server';
import type { RoleCode } from './auth-roles';
import { SESSION_MAX_AGE_SECONDS } from '../domain/auth/account';
import { AuthService } from '../server/auth';
import type { AuthSession } from '../domain/auth/account';

export type { AuthSession } from '../domain/auth/account';

export const AUTH_SESSION_COOKIE = 'minhlab_session';

// Store only the hash; revocation and current account/roles are checked in DB.
export async function createAuthSessionToken(user: { id: string }): Promise<string> {
  return AuthService.createSession(user);
}

export async function readAuthSession(request: NextRequest): Promise<AuthSession | null> {
  return AuthService.readSession(request.cookies.get(AUTH_SESSION_COOKIE)?.value);
}

export async function revokeAuthSession(request: NextRequest): Promise<void> {
  await AuthService.revokeSession(request.cookies.get(AUTH_SESSION_COOKIE)?.value);
}

export function setAuthSessionCookie(response: NextResponse, token: string): NextResponse {
  response.cookies.set(AUTH_SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}

export function clearAuthSessionCookie(response: NextResponse): NextResponse {
  response.cookies.set(AUTH_SESSION_COOKIE, '', {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: 0,
  });
  return response;
}

export async function authorizeRoles(
  request: NextRequest,
  allowedRoles: readonly RoleCode[],
): Promise<{ session: AuthSession | null; response: NextResponse | null }> {
  const session = await readAuthSession(request);
  if (!session) return {
    session: null,
    response: NextResponse.json({ success: false, error: 'Vui lòng đăng nhập để tiếp tục.' }, { status: 401 }),
  };
  if (!allowedRoles.includes(session.role)) return {
    session,
    response: NextResponse.json({ success: false, error: 'Tài khoản của bạn không có quyền thực hiện thao tác này.' }, { status: 403 }),
  };
  return { session, response: null };
}

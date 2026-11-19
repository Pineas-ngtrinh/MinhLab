'use client';

/**
 * =====================================================================
 * MINHLAB 3D - AUTHENTICATION CONTEXT (QUẢN LÝ PHIÊN ĐĂNG NHẬP & PHÂN QUYỀN)
 * =====================================================================
 * Quản lý phiên đăng nhập cho 5 vai trò:
 *  - CUSTOMER, WORKSHOP_OPERATOR, FILE_REVIEWER, PRINT_OPERATOR, ADMIN
 * Phiên dùng cookie HttpOnly và được kiểm chứng với database phía server.
 * =====================================================================
 */

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { ROLES, type RoleCode, type RoleInfo } from '../lib/auth-roles';
import type { AuthUser, RegisterAccountInput, RegistrationResult } from '../contracts/auth';

interface AuthContextType {
  user: AuthUser | null;
  role: RoleCode | null;
  roleInfo: RoleInfo | null;
  isAuthenticated: boolean;
  isAuthReady: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (data: RegisterAccountInput) => Promise<RegistrationResult>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const identityRevision = useRef(0);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Lấy danh tính từ cookie HttpOnly do server xác thực, không tin phiên localStorage.
  useEffect(() => {
    const controller = new AbortController();
    const revision = identityRevision.current;

    fetch('/api/auth/session', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Không thể xác thực phiên đăng nhập.');
        const result: { data?: AuthUser | null } = await response.json();
        if (!controller.signal.aborted && identityRevision.current===revision) setUser(result.data ?? null);
      })
      .catch(() => {
        if (!controller.signal.aborted && identityRevision.current===revision) setUser(null);
      })
      .finally(() => {
        if (!controller.signal.aborted && identityRevision.current===revision) setIsAuthReady(true);
      });

    return () => controller.abort();
  }, []);

  const login = async (email: string, password: string): Promise<AuthUser> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const result: { success?: boolean; error?: string; data?: AuthUser } = await res.json();
    if (!res.ok || !result.success || !result.data) {
      throw new Error(result.error || 'Đăng nhập thất bại.');
    }

    identityRevision.current += 1;
    const authUser = result.data;
    setUser(authUser);
    setIsAuthReady(true);
    return authUser;
  };

  const register = async (input: RegisterAccountInput): Promise<RegistrationResult> => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const result: { success?: boolean; error?: string; data?: AuthUser; requiresEmailVerification?: boolean } = await res.json();
    if (!res.ok || !result.success || !result.data) {
      throw new Error(result.error || 'Đăng ký thất bại.');
    }

    identityRevision.current += 1;
    const authUser = result.data;
    const requiresEmailVerification = result.requiresEmailVerification === true;
    if (!requiresEmailVerification) setUser(authUser);
    setIsAuthReady(true);
    return { user: authUser, requiresEmailVerification };
  };

  const logout = async () => {
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    if (!response.ok) throw new Error('Chưa thể đăng xuất. Vui lòng thử lại khi có kết nối.');
    identityRevision.current += 1;
    setUser(null);
  };

  const role = user?.role || null;
  const roleInfo = role ? ROLES[role] : null;

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        roleInfo,
        isAuthenticated: !!user,
        isAuthReady,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

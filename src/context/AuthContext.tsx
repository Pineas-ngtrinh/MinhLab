'use client';

/**
 * =====================================================================
 * MINHLAB 3D - AUTHENTICATION CONTEXT (QUẢN LÝ PHIÊN ĐĂNG NHẬP & PHÂN QUYỀN)
 * =====================================================================
 * Quản lý phiên đăng nhập cho 5 vai trò:
 *  - CUSTOMER, STAFF, FILE_REVIEWER, PRINT_OPERATOR, ADMIN
 * Hỗ trợ lưu trữ phiên vào localStorage và One-Click Role Switching để test nhanh.
 * =====================================================================
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { RoleCode, RoleInfo, ROLES } from '../services/auth.service';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: RoleCode;
}

interface AuthContextType {
  user: AuthUser | null;
  role: RoleCode | null;
  roleInfo: RoleInfo | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (data: { email: string; fullName: string; phone?: string; password: string }) => Promise<AuthUser>;
  logout: () => void;
  switchRoleQuickly: (roleCode: RoleCode) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'minhlab_auth_session_v1';

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);

  // Đọc phiên từ localStorage khi load
  useEffect(() => {
    try {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved) {
        setUser(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  const saveUserSession = (userData: AuthUser | null) => {
    setUser(userData);
    try {
      if (userData) {
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(userData));
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    } catch {
      // ignore
    }
  };

  const login = async (email: string, password: string): Promise<AuthUser> => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Đăng nhập thất bại.');
    }

    const authUser: AuthUser = {
      id: data.data.id,
      email: data.data.email,
      fullName: data.data.fullName,
      phone: data.data.phone,
      role: data.data.role,
    };

    saveUserSession(authUser);
    return authUser;
  };

  const register = async (input: {
    email: string;
    fullName: string;
    phone?: string;
    password: string;
  }): Promise<AuthUser> => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Đăng ký thất bại.');
    }

    const authUser: AuthUser = {
      id: data.data.id,
      email: data.data.email,
      fullName: data.data.fullName,
      phone: data.data.phone,
      role: data.data.role,
    };

    saveUserSession(authUser);
    return authUser;
  };

  const logout = () => {
    saveUserSession(null);
  };

  // Chuyển đổi vai trò nhanh (One-Click Role Switching) phục vụ trải nghiệm & test
  const switchRoleQuickly = async (roleCode: RoleCode) => {
    const demoCredentials: Record<RoleCode, { email: string; pass: string }> = {
      ADMIN: { email: 'admin@minhlab.com', pass: 'admin123' },
      STAFF: { email: 'staff@minhlab.com', pass: 'staff123' },
      FILE_REVIEWER: { email: 'engineer@minhlab.com', pass: 'engineer123' },
      PRINT_OPERATOR: { email: 'operator@minhlab.com', pass: 'operator123' },
      CUSTOMER: { email: 'customer@minhlab.com', pass: 'customer123' },
    };

    const target = demoCredentials[roleCode];
    if (target) {
      await login(target.email, target.pass);
    }
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
        login,
        register,
        logout,
        switchRoleQuickly,
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

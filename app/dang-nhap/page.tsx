'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../src/context/AuthContext';
import { RoleCode, ROLES } from '../../src/services/auth.service';
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  AlertCircle,
  Zap,
  DollarSign,
  FileCheck,
  Printer,
  Crown,
  Check,
} from 'lucide-react';

export default function DangNhapPage() {
  const router = useRouter();
  const { login, switchRoleQuickly } = useAuth();

  // Tab đăng nhập: 'CUSTOMER' (Khách hàng) hoặc 'STAFF' (Nhân sự & Admin)
  const [activePortal, setActivePortal] = useState<'CUSTOMER' | 'STAFF'>('STAFF');

  const [email, setEmail] = useState('staff@minhlab.com');
  const [password, setPassword] = useState('staff123');
  const [selectedStaffRole, setSelectedStaffRole] = useState<RoleCode>('STAFF');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Chọn tab nhân sự
  const handleSelectStaffRole = (r: RoleCode) => {
    setSelectedStaffRole(r);
    if (r === 'STAFF') {
      setEmail('staff@minhlab.com');
      setPassword('staff123');
    } else if (r === 'FILE_REVIEWER') {
      setEmail('engineer@minhlab.com');
      setPassword('engineer123');
    } else if (r === 'PRINT_OPERATOR') {
      setEmail('operator@minhlab.com');
      setPassword('operator123');
    } else if (r === 'ADMIN') {
      setEmail('admin@minhlab.com');
      setPassword('admin123');
    }
  };

  // Chọn tab khách hàng
  const handleSelectCustomerTab = () => {
    setActivePortal('CUSTOMER');
    setEmail('customer@minhlab.com');
    setPassword('customer123');
  };

  // Chọn tab nhân viên
  const handleSelectStaffTab = () => {
    setActivePortal('STAFF');
    handleSelectStaffRole('STAFF');
  };

  // Xử lý submit form đăng nhập
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const loggedUser = await login(email, password);
      if (loggedUser.role === 'CUSTOMER') {
        router.push('/tai-khoan');
      } else {
        router.push('/admin');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Đăng nhập thất bại.');
    } finally {
      setIsLoading(false);
    }
  };

  // Xử lý 1-click test đăng nhập ngay
  const handleInstantQuickLogin = async (r: RoleCode) => {
    setErrorMessage('');
    setIsLoading(true);
    try {
      await switchRoleQuickly(r);
      if (r === 'CUSTOMER') {
        router.push('/tai-khoan');
      } else {
        router.push('/admin');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Đăng nhập thất bại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[90vh] w-full flex flex-col items-center justify-center px-4 pt-28 sm:pt-32 pb-20">
      <div className="w-full max-w-2xl space-y-6">
        
        {/* Tiêu đề trang */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-[#141A21] border border-[#27313C] text-[10px] sm:text-[11px] font-mono tracking-wider text-[#A5ADB8] uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#EB4037]" />
            <span>XÁC THỰC DANH TÍNH · MINHLAB 3D</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F4F1EA]">
            {activePortal === 'STAFF' ? 'Cổng Quản Trị & Kỹ Thuật Xưởng' : 'Đăng Nhập Khách Hàng Thành Viên'}
          </h1>

          <p className="text-xs sm:text-sm text-[#A5ADB8] max-w-lg mx-auto leading-relaxed">
            {activePortal === 'STAFF'
              ? 'Dành cho Kế toán đối soát VietQR, Kỹ sư thẩm định file mesh 3D, Kỹ thuật viên máy in FDM và Quản trị viên xưởng.'
              : 'Theo dõi tiến độ chế tác sản phẩm theo thời gian thực và quản lý lịch sử đơn hàng của bạn.'}
          </p>
        </div>

        {/* Thanh chuyển đổi Portal: Khách hàng vs Ban quản trị */}
        <div className="grid grid-cols-2 p-1.5 rounded-xl bg-[#141A21] border border-[#27313C] gap-1.5 shadow-lg">
          <button
            type="button"
            onClick={handleSelectCustomerTab}
            className={`py-2.5 px-4 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 ${
              activePortal === 'CUSTOMER'
                ? 'bg-[#0F141A] text-[#6F9576] border border-[#6F9576]/40 shadow-sm'
                : 'text-[#A5ADB8] hover:text-[#F4F1EA] hover:bg-[#1A222C]'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Khách Hàng (Customer)</span>
          </button>

          <button
            type="button"
            onClick={handleSelectStaffTab}
            className={`py-2.5 px-4 rounded-lg text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 ${
              activePortal === 'STAFF'
                ? 'bg-[#0F141A] text-[#EB4037] border border-[#EB4037]/40 shadow-sm'
                : 'text-[#A5ADB8] hover:text-[#F4F1EA] hover:bg-[#1A222C]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Nhân Sự Xưởng & Admin</span>
          </button>
        </div>

        {/* ================================================================ */}
        {/* TAB 1: NHÂN SỰ XƯỞNG & ADMIN                                      */}
        {/* ================================================================ */}
        {activePortal === 'STAFF' && (
          <div className="space-y-4">
            
            {/* 4 Thẻ Vai Trò Chuyên Môn */}
            <div className="p-4 rounded-2xl bg-[#141A21] border border-[#27313C] space-y-3 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#D48955] flex items-center gap-1.5 font-bold uppercase tracking-wider">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Chọn Vai Trò (One-Click Demo Switcher)</span>
                </span>
                <span className="text-[10px] font-mono text-[#737D89]">Bấm để nạp thông tin hoặc 1-Click test</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* 1. Kế toán & Vận hành */}
                <div
                  onClick={() => handleSelectStaffRole('STAFF')}
                  className={`p-3 rounded-xl border transition-all cursor-pointer text-left relative ${
                    selectedStaffRole === 'STAFF'
                      ? 'bg-[#0F141A] border-[#D97706] shadow-sm'
                      : 'bg-[#0F141A]/60 border-[#27313C] hover:border-[#D97706]/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-[#F4F1EA] flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-[#D97706]" />
                      <span>Kế Toán — Đối Soát VietQR</span>
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#D97706]/15 text-[#D97706] font-bold border border-[#D97706]/30">
                      STAFF
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-[#737D89]">staff@minhlab.com</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleInstantQuickLogin('STAFF');
                    }}
                    className="mt-2 text-[10px] font-mono font-bold text-[#D97706] hover:underline flex items-center gap-1"
                  >
                    <span>⚡ 1-Click vào bàn Kế toán</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {/* 2. Kỹ sư Thẩm định 3D */}
                <div
                  onClick={() => handleSelectStaffRole('FILE_REVIEWER')}
                  className={`p-3 rounded-xl border transition-all cursor-pointer text-left relative ${
                    selectedStaffRole === 'FILE_REVIEWER'
                      ? 'bg-[#0F141A] border-[#3B82F6] shadow-sm'
                      : 'bg-[#0F141A]/60 border-[#27313C] hover:border-[#3B82F6]/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-[#F4F1EA] flex items-center gap-1.5">
                      <FileCheck className="w-3.5 h-3.5 text-[#3B82F6]" />
                      <span>Kỹ Sư — Thẩm Định File 3D</span>
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#3B82F6]/15 text-[#3B82F6] font-bold border border-[#3B82F6]/30">
                      REVIEWER
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-[#737D89]">engineer@minhlab.com</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleInstantQuickLogin('FILE_REVIEWER');
                    }}
                    className="mt-2 text-[10px] font-mono font-bold text-[#3B82F6] hover:underline flex items-center gap-1"
                  >
                    <span>⚡ 1-Click vào trạm Thẩm định 3D</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {/* 3. Kỹ thuật viên cụm máy in */}
                <div
                  onClick={() => handleSelectStaffRole('PRINT_OPERATOR')}
                  className={`p-3 rounded-xl border transition-all cursor-pointer text-left relative ${
                    selectedStaffRole === 'PRINT_OPERATOR'
                      ? 'bg-[#0F141A] border-[#8B5CF6] shadow-sm'
                      : 'bg-[#0F141A]/60 border-[#27313C] hover:border-[#8B5CF6]/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-[#F4F1EA] flex items-center gap-1.5">
                      <Printer className="w-3.5 h-3.5 text-[#8B5CF6]" />
                      <span>Kỹ Thuật — Cụm Máy In FDM</span>
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#8B5CF6]/15 text-[#8B5CF6] font-bold border border-[#8B5CF6]/30">
                      OPERATOR
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-[#737D89]">operator@minhlab.com</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleInstantQuickLogin('PRINT_OPERATOR');
                    }}
                    className="mt-2 text-[10px] font-mono font-bold text-[#8B5CF6] hover:underline flex items-center gap-1"
                  >
                    <span>⚡ 1-Click vào trạm Cụm máy in</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {/* 4. Quản trị viên trưởng */}
                <div
                  onClick={() => handleSelectStaffRole('ADMIN')}
                  className={`p-3 rounded-xl border transition-all cursor-pointer text-left relative ${
                    selectedStaffRole === 'ADMIN'
                      ? 'bg-[#0F141A] border-[#EB4037] shadow-sm'
                      : 'bg-[#0F141A]/60 border-[#27313C] hover:border-[#EB4037]/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-[#F4F1EA] flex items-center gap-1.5">
                      <Crown className="w-3.5 h-3.5 text-[#EB4037]" />
                      <span>Quản Trị Viên — Toàn Quyền</span>
                    </span>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#EB4037]/15 text-[#EB4037] font-bold border border-[#EB4037]/30">
                      ADMIN
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-[#737D89]">admin@minhlab.com</p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleInstantQuickLogin('ADMIN');
                    }}
                    className="mt-2 text-[10px] font-mono font-bold text-[#EB4037] hover:underline flex items-center gap-1"
                  >
                    <span>⚡ 1-Click vào Bàn Admin Toàn Quyền</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            {/* Form đăng nhập cho nhân sự */}
            <form onSubmit={handleSubmit} className="p-6 rounded-2xl bg-[#141A21] border border-[#27313C] space-y-4 text-left shadow-xl">
              <div className="flex items-center justify-between border-b border-[#27313C] pb-3">
                <span className="text-xs font-bold text-[#F4F1EA]">
                  Đăng Nhập Với Vai Trò: <span className="text-[#EB4037] uppercase">{selectedStaffRole}</span>
                </span>
                <span className="text-[11px] font-mono text-[#737D89]">Mật khẩu mặc định: {selectedStaffRole.toLowerCase().replace('_', '')}123</span>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-lg bg-[#EB4037]/15 border border-[#EB4037]/40 flex items-start gap-2.5 text-xs text-[#EB4037]">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-[#A5ADB8] block">Email Nhân Sự *</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[#27313C] bg-[#0F141A] text-[#F4F1EA] text-xs sm:text-sm font-mono focus:outline-none focus:border-[#EB4037]"
                  />
                  <Mail className="w-4 h-4 text-[#737D89] absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-[#A5ADB8] block">Mật Khẩu *</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[#27313C] bg-[#0F141A] text-[#F4F1EA] text-xs sm:text-sm font-mono focus:outline-none focus:border-[#EB4037]"
                  />
                  <Lock className="w-4 h-4 text-[#737D89] absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-6 rounded-lg bg-[#EB4037] hover:bg-[#FF5147] text-white font-bold text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 shadow-subtle disabled:opacity-50"
              >
                <span>{isLoading ? 'Đang xác thực hệ thống...' : 'Vào Bàn Quản Trị Xưởng (Admin Workbench)'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* ================================================================ */}
        {/* TAB 2: KHÁCH HÀNG THÀNH VIÊN                                     */}
        {/* ================================================================ */}
        {activePortal === 'CUSTOMER' && (
          <div className="space-y-4">
            
            {/* Khối Điền Nhanh Tài Khoản Demo Khách Hàng */}
            <div className="p-4 rounded-xl bg-[#0F141A] border border-[#6F9576]/40 flex items-center justify-between text-left">
              <div>
                <span className="text-xs font-bold text-[#F4F1EA] block">Tài Khoản Khách Hàng Mẫu</span>
                <span className="text-[11px] font-mono text-[#737D89]">customer@minhlab.com · Mật khẩu: customer123</span>
              </div>
              <button
                type="button"
                onClick={() => handleInstantQuickLogin('CUSTOMER')}
                className="py-1.5 px-3 rounded-lg bg-[#6F9576] hover:bg-[#5E8364] text-white text-xs font-bold font-mono transition-all flex items-center gap-1.5 shadow-sm"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>1-Click Test Khách</span>
              </button>
            </div>

            {/* Form đăng nhập khách hàng */}
            <form onSubmit={handleSubmit} className="p-6 sm:p-8 rounded-2xl bg-[#141A21] border border-[#27313C] space-y-5 text-left shadow-xl">
              {errorMessage && (
                <div className="p-3.5 rounded-lg bg-[#EB4037]/15 border border-[#EB4037]/40 flex items-start gap-2.5 text-xs text-[#EB4037]">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-[#A5ADB8] block">Địa chỉ Email *</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="email@cuaban.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[#27313C] bg-[#0F141A] text-[#F4F1EA] text-xs sm:text-sm placeholder-[#737D89] focus:outline-none focus:border-[#EB4037]"
                  />
                  <Mail className="w-4 h-4 text-[#737D89] absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-mono text-[#A5ADB8] block">Mật khẩu *</label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[#27313C] bg-[#0F141A] text-[#F4F1EA] text-xs sm:text-sm placeholder-[#737D89] focus:outline-none focus:border-[#EB4037]"
                  />
                  <Lock className="w-4 h-4 text-[#737D89] absolute left-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-6 rounded-lg bg-[#EB4037] hover:bg-[#FF5147] text-white font-medium text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 shadow-subtle disabled:opacity-50"
              >
                <span>{isLoading ? 'Đang xác thực...' : 'Đăng nhập vào Cổng Khách Hàng'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="pt-2 text-center text-xs text-[#A5ADB8]">
                <span>Bạn chưa có tài khoản thành viên? </span>
                <Link href="/dang-ky" className="text-[#EB4037] hover:underline font-semibold">
                  Đăng ký ngay tại đây
                </Link>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}

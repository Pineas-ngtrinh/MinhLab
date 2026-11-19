'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, ArrowRight, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '../../src/context/AuthContext';
import type { RoleCode } from '../../src/lib/auth-roles';

export default function DangNhapPage() {
  const router = useRouter();
  const { login, user, isAuthReady } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isAuthReady || !user) return;
    router.replace(user.role === 'CUSTOMER' ? '/tai-khoan' : '/admin');
  }, [isAuthReady, user, router]);

  const goToWorkspace = (role: RoleCode) => {
    router.replace(role === 'CUSTOMER' ? '/tai-khoan' : '/admin');
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    try {
      const loggedUser = await login(email.trim(), password);
      goToWorkspace(loggedUser.role);
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Đăng nhập thất bại. Vui lòng thử lại.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthReady || user) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center px-4">
        <div role="status" aria-live="polite" className="flex items-center gap-3 text-sm font-mono text-[#A5ADB8]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#C8A261] motion-reduce:animate-none" />
          {isAuthReady ? 'Đang mở khu vực làm việc của bạn…' : 'Đang xác thực phiên đăng nhập…'}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 py-10 sm:px-8 sm:py-14">
      <div className="mx-auto w-full max-w-xl space-y-7">
        <header className="mx-auto max-w-lg space-y-3 text-center">
          <span className="inline-flex items-center gap-2 border border-white/[0.08] bg-[#111216] px-3 py-1.5 text-[10px] font-mono uppercase tracking-[0.18em] text-[#C8A261]">
            <span className="h-1.5 w-1.5 bg-[#EB4037]" />
            Xác thực tài khoản · MinhLab 3D
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-[#F4F1EA] sm:text-4xl">
            Đăng nhập MinhLab.
          </h1>
          <p className="text-sm leading-6 text-[#A5ADB8]">
            Dùng email và mật khẩu đã đăng ký hoặc được cấp. Hệ thống sẽ tự mở khu vực phù hợp với tài khoản của bạn.
          </p>
        </header>

        <section className="border border-white/[0.08] bg-[#0B0B0E] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-8">
          <div className="mb-6 border-b border-white/[0.08] pb-5">
            <h2 className="mt-1 text-xl font-semibold text-[#F4F1EA]">Thông tin đăng nhập</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {errorMessage && (
              <div role="alert" aria-live="polite" className="flex items-start gap-2.5 border border-[#EB4037]/35 bg-[#EB4037]/[0.08] p-3 text-sm text-[#FF8179]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="login-email" className="block text-xs font-medium text-[#A5ADB8]">Email</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737D89]" />
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="ten@email.com"
                  className="min-h-12 w-full border border-white/[0.1] bg-[#08090C] py-3 pl-10 pr-3 text-base sm:text-sm text-[#F4F1EA] placeholder:text-[#555D67] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C8A261]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="login-password" className="block text-xs font-medium text-[#A5ADB8]">Mật khẩu</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737D89]" />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Nhập mật khẩu"
                  className="min-h-12 w-full border border-white/[0.1] bg-[#08090C] py-3 pl-10 pr-12 text-base sm:text-sm text-[#F4F1EA] placeholder:text-[#555D67] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C8A261]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-[#737D89] transition-colors hover:text-[#F4F1EA] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C8A261]"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex min-h-12 w-full items-center justify-center gap-2 bg-[#EB4037] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#FF5147] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0B0E] disabled:cursor-wait disabled:opacity-60"
            >
              {isLoading ? 'Đang xác thực…' : 'Đăng nhập'}
              {!isLoading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>
          <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-3 text-sm text-[#C8A261]">
            <Link href="/quen-mat-khau" className="underline underline-offset-4 focus-visible:ring-1 focus-visible:ring-[#C8A261]">Quên mật khẩu</Link>
            <Link href="/gui-lai-xac-minh" className="underline underline-offset-4 focus-visible:ring-1 focus-visible:ring-[#C8A261]">Gửi lại email xác minh</Link>
          </div>

          <p className="mt-5 text-center text-xs text-[#737D89]">
            Khách hàng chưa có tài khoản?{' '}
            <Link href="/dang-ky" className="font-medium text-[#C8A261] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C8A261]">
              Tạo tài khoản
            </Link>
          </p>
        </section>

        <p className="text-center text-[11px] text-[#737D89]">
          <Link href="/" className="underline underline-offset-4 hover:text-[#F4F1EA]">Quay về trang chủ</Link>
          <span className="mx-2">·</span>
          Nhân sự cần tài khoản đăng nhập vui lòng liên hệ quản trị viên xưởng.
        </p>
      </div>
    </div>
  );
}

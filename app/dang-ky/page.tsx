'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../src/context/AuthContext';
import {
  Lock,
  Mail,
  User,
  Phone,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';

export default function DangKyPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!fullName.trim() || !email.trim() || !password) {
      setErrorMessage('Vui lòng điền đầy đủ các trường bắt buộc.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Mật khẩu phải có độ dài tối thiểu từ 6 ký tự.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Mật khẩu xác nhận không trùng khớp.');
      return;
    }

    setIsLoading(true);

    try {
      await register({
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
      });

      router.push('/tai-khoan');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Đăng ký tài khoản thất bại.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] w-full flex items-center justify-center px-4 pt-28 sm:pt-32 pb-20">
      <div className="w-full max-w-lg space-y-6">
        
        {/* Tiêu đề trang */}
        <div className="text-center space-y-2.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-[#141A21] border border-[#27313C] text-[10px] sm:text-[11px] font-mono tracking-wider text-[#A5ADB8] uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#EB4037]" />
            <span>MEMBER REGISTRATION · MINHLAB 3D</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#F4F1EA]">
            Đăng Ký Thành Viên MinhLab
          </h1>

          <p className="text-xs sm:text-sm text-[#A5ADB8] max-w-md mx-auto leading-relaxed">
            Tạo tài khoản để theo dõi tiến độ in 3D theo thời gian thực, lưu địa chỉ giao hàng và nhận đặc quyền phục dựng đồ sưu tầm.
          </p>
        </div>

        {/* Form Đăng Ký */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-8 rounded-2xl bg-[#141A21] border border-[#27313C] space-y-4 text-left shadow-xl">
          {errorMessage && (
            <div className="p-3.5 rounded-lg bg-[#EB4037]/15 border border-[#EB4037]/40 flex items-start gap-2.5 text-xs text-[#EB4037]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-mono text-[#A5ADB8] block">Họ và tên của bạn *</label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="Nguyễn Văn An"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[#27313C] bg-[#0F141A] text-[#F4F1EA] text-xs sm:text-sm placeholder-[#737D89] focus:outline-none focus:border-[#EB4037]"
              />
              <User className="w-4 h-4 text-[#737D89] absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-mono text-[#A5ADB8] block">Địa chỉ Email *</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[#27313C] bg-[#0F141A] text-[#F4F1EA] text-xs sm:text-sm placeholder-[#737D89] focus:outline-none focus:border-[#EB4037]"
                />
                <Mail className="w-4 h-4 text-[#737D89] absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono text-[#A5ADB8] block">Số điện thoại liên hệ</label>
              <div className="relative">
                <input
                  type="tel"
                  placeholder="09xx xxx xxx"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[#27313C] bg-[#0F141A] text-[#F4F1EA] font-mono text-xs sm:text-sm placeholder-[#737D89] focus:outline-none focus:border-[#EB4037]"
                />
                <Phone className="w-4 h-4 text-[#737D89] absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-mono text-[#A5ADB8] block">Mật khẩu *</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="Tối thiểu 6 ký tự"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[#27313C] bg-[#0F141A] text-[#F4F1EA] text-xs sm:text-sm placeholder-[#737D89] focus:outline-none focus:border-[#EB4037]"
                />
                <Lock className="w-4 h-4 text-[#737D89] absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono text-[#A5ADB8] block">Xác nhận mật khẩu *</label>
              <div className="relative">
                <input
                  type="password"
                  required
                  placeholder="Nhập lại mật khẩu"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[#27313C] bg-[#0F141A] text-[#F4F1EA] text-xs sm:text-sm placeholder-[#737D89] focus:outline-none focus:border-[#EB4037]"
                />
                <Lock className="w-4 h-4 text-[#737D89] absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-[#0F141A] border border-[#27313C] flex items-center gap-2.5 text-[11px] text-[#A5ADB8]">
            <ShieldCheck className="w-4 h-4 text-[#6F9576] shrink-0" />
            <span>Thông tin cá nhân được bảo mật tuyệt đối theo tiêu chuẩn xưởng MinhLab.</span>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 px-6 rounded-lg bg-[#EB4037] hover:bg-[#FF5147] text-white font-medium text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 shadow-subtle disabled:opacity-50"
          >
            <span>{isLoading ? 'Đang tạo tài khoản...' : 'Hoàn tất đăng ký thành viên'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="pt-2 text-center text-xs text-[#A5ADB8]">
            <span>Đã có tài khoản thành viên? </span>
            <Link href="/dang-nhap" className="text-[#EB4037] hover:underline font-semibold">
              Đăng nhập ngay
            </Link>
          </div>
        </form>

      </div>
    </div>
  );
}

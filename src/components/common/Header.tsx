'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { Menu, X, ShoppingBag, UploadCloud, User } from 'lucide-react';

export const Header: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { totalCount, openCart } = useCart();
  const { user, isAuthenticated, roleInfo } = useAuth();

  const navItems = [
    { label: 'Trang chủ', href: '/' },
    { label: 'Bộ sưu tập', href: '/bo-suu-tap' },
    { label: 'Tour phòng lab', href: '/phong-lab' },
    { label: 'In theo file', href: '/in-theo-file' },
    { label: 'Về MinhLab', href: '/ve-minhlab' },
  ];

  // Đóng menu mobile khi đổi trang
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  return (
    <header className="fixed top-3 sm:top-5 inset-x-0 mx-auto w-[calc(100%-1.5rem)] sm:w-[calc(100%-3rem)] max-w-6xl z-50 transition-all duration-300">
      {/* Floating Translucent Pill Bar */}
      <div className="h-16 sm:h-18 px-3.5 sm:px-6 rounded-full bg-[#08090C]/80 backdrop-blur-xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.65)] flex items-center justify-between">
        
        {/* Logo MinhLab */}
        <Link
          href="/"
          className="flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#EB4037] rounded-full px-1 py-0.5"
          aria-label="MinhLab — Về trang chủ"
        >
          <div className="relative h-7 w-24 sm:h-8 sm:w-28 transition-transform duration-200 group-hover:scale-102">
            <Image
              src="/images/logo.png"
              alt="MinhLab Logo"
              fill
              sizes="(max-width: 640px) 96px, 112px"
              priority
              className="object-contain object-left"
            />
          </div>
          <span className="hidden xl:inline-block text-[10px] font-mono tracking-wider text-[#737D89] border-l border-white/[0.1] pl-2 uppercase">
            0.12mm FDM Studio
          </span>
        </Link>

        {/* Menu Điều Hướng Desktop (Editorial Pill Navigation) */}
        <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-3.5 py-1.5 rounded-full text-xs xl:text-[13px] tracking-tight transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#EB4037] ${
                  isActive
                    ? 'text-white font-medium bg-white/[0.08]'
                    : 'text-[#A5ADB8] hover:text-white hover:bg-white/[0.04]'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span>{item.label}</span>
                {isActive && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#EB4037]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Cụm Thao Tác (Giỏ Hàng + Tài Khoản + CTA) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          
          {/* Nút Mở Giỏ Hàng */}
          <button
            type="button"
            onClick={openCart}
            className="relative min-w-[40px] min-h-[40px] sm:min-w-[42px] sm:min-h-[42px] rounded-full text-[#F4F1EA] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/[0.12] transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#EB4037]"
            title="Xem giỏ hàng"
            aria-label={`Xem giỏ hàng, hiện có ${totalCount} sản phẩm`}
          >
            <ShoppingBag className="w-4 h-4 text-[#D1D5DB]" />
            {totalCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#EB4037] text-white text-[10px] font-mono font-bold flex items-center justify-center shadow-md">
                {totalCount}
              </span>
            )}
          </button>

          {/* Nút Đăng Nhập / Trạng Thái Tài Khoản */}
          {/* Nút Đăng Nhập / Trạng Thái Tài Khoản (Hiện từ màn hình sm) */}
          {!isAuthenticated || !user ? (
            <Link
              href="/dang-nhap"
              className="hidden sm:inline-flex items-center gap-1.5 min-h-[38px] px-3 rounded-full text-xs font-mono text-[#D1D5DB] hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#EB4037]"
              title="Đăng nhập tài khoản"
              aria-label="Đăng nhập tài khoản"
            >
              <User className="w-3.5 h-3.5 text-[#EB4037]" />
              <span>Tài khoản</span>
            </Link>
          ) : (
            <Link
              href={user.role === 'CUSTOMER' ? '/tai-khoan' : '/admin'}
              className="hidden sm:inline-flex items-center gap-2 min-h-[38px] px-3 rounded-full text-xs font-mono text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.1] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#EB4037]"
              title={`Tài khoản: ${user.fullName} (${user.role})`}
              aria-label={`Tài khoản: ${user.fullName} (${user.role})`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: roleInfo?.badgeColor || '#EB4037' }}
              />
              <span className="max-w-[80px] sm:max-w-[100px] truncate">
                {user.fullName.split(' ')[0]}
              </span>
            </Link>
          )}

          {/* Nút CTA: Gửi file cần in */}
          <Link
            href="/in-theo-file"
            className="hidden sm:inline-flex items-center gap-1.5 min-h-[38px] px-4 rounded-full bg-[#EB4037] hover:bg-[#FF5147] text-white text-xs font-semibold shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Gửi file</span>
          </Link>

          {/* Nút Mở Menu Mobile */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden shrink-0 min-w-[38px] min-h-[38px] rounded-full text-[#F4F1EA] hover:bg-white/[0.06] border border-white/[0.06] transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#EB4037]"
            aria-label={mobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

      </div>

      {/* Menu Thả Xuống Trên Thiết Bị Di Động */}
      {mobileMenuOpen && (
        <div
          id="mobile-navigation"
          className="lg:hidden mt-2 rounded-2xl bg-[#08090C]/95 backdrop-blur-2xl border border-white/[0.08] p-4 shadow-[0_16px_48px_rgba(0,0,0,0.8)] space-y-3 animate-fadeIn"
        >
          <nav className="flex flex-col space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3.5 py-2.5 rounded-xl text-sm transition-colors flex items-center justify-between ${
                    isActive
                      ? 'bg-white/[0.08] font-semibold text-white'
                      : 'text-[#A5ADB8] hover:text-white hover:bg-white/[0.04]'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span>{item.label}</span>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#EB4037]" />}
                </Link>
              );
            })}
          </nav>

          <div className="pt-3 border-t border-white/[0.08] space-y-2">
            {!isAuthenticated || !user ? (
              <Link
                href="/dang-nhap"
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-white text-xs font-mono font-medium"
              >
                <User className="w-3.5 h-3.5 text-[#EB4037]" />
                <span>Đăng nhập tài khoản / Cổng xưởng</span>
              </Link>
            ) : (
              <Link
                href={user.role === 'CUSTOMER' ? '/tai-khoan' : '/admin'}
                onClick={() => setMobileMenuOpen(false)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-white text-xs font-mono font-medium"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: roleInfo?.badgeColor || '#EB4037' }}
                />
                <span>Vào trang: {user.role === 'CUSTOMER' ? 'Hồ sơ & Đơn hàng' : `Bàn Quản Trị (${user.role})`}</span>
              </Link>
            )}

            <Link
              href="/in-theo-file"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[#EB4037] hover:bg-[#FF5147] text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Gửi file cần in</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;

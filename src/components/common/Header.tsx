'use client';

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { Menu, X, ShoppingBag, UploadCloud, User, ArrowUpRight } from 'lucide-react';
import { ModalDialog } from './ModalDialog';
import { MobileBottomBar } from './MobileBottomBar';
import { returnToHomeTop } from './home-navigation';

export const Header: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const { totalCount, openCart } = useCart();
  const { user, isAuthenticated } = useAuth();
  const accountUser = isAuthenticated ? user : null;
  const accountHref = accountUser ? (accountUser.role === 'CUSTOMER' ? '/tai-khoan' : '/admin') : '/dang-nhap';
  const openMobileMenu = (trigger: HTMLButtonElement) => {
    menuTriggerRef.current = trigger;
    setMobileMenuOpen(true);
  };
  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    window.requestAnimationFrame(() => menuTriggerRef.current?.focus({ preventScroll: true }));
  };

  const navItems = [
    { label: 'Trang chủ', href: '/' },
    { label: 'Bộ sưu tập', href: '/bo-suu-tap' },
    { label: 'Tour phòng lab', href: '/phong-lab' },
    { label: 'In theo file', href: '/in-theo-file' },
    { label: 'Về MinhLab', href: '/ve-minhlab' },
  ];

  // Đóng menu mobile khi đổi trang
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronizes browser, WebGL or remote API state after mount; keep SSR hydration deterministic.
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileMenuOpen(false);
    };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, [mobileMenuOpen]);

  return (
    <>
    <header className="fixed top-0 inset-x-0 mx-auto w-full z-50 lg:top-1 lg:w-[calc(100%-3rem)] lg:max-w-7xl">
      <div className="flex h-16 items-center justify-center border-b border-white/[0.08] bg-[#08090C] px-4 sm:px-8 md:justify-between lg:h-[68px] lg:rounded-2xl lg:border lg:bg-[#08090C]/90 lg:px-5">

        {/* Logo MinhLab */}
        <Link
          href="/"
          onNavigate={returnToHomeTop}
          className="flex min-h-11 shrink-0 items-center rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#EB4037]"
          aria-label="MinhLab — Về trang chủ"
        >
          <div className="relative h-8 w-28">
            <Image
              src="/images/logo.png"
              alt="MinhLab Logo"
              fill
              sizes="112px"
              priority
              className="object-contain object-left"
            />
          </div>
        </Link>

        {/* Menu Điều Hướng Desktop */}
        <nav aria-label="Điều hướng chính" className="hidden min-w-0 flex-1 items-center justify-evenly lg:flex lg:mx-4 xl:mx-6">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onNavigate={item.href === '/' ? returnToHomeTop : undefined}
                className={`relative flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-md px-2 xl:px-3 text-xs xl:text-[13px] tracking-tight transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#EB4037] ${
                  isActive
                    ? 'text-white font-medium'
                    : 'text-[#A5ADB8] hover:text-white hover:bg-white/[0.04]'
                }`}
                aria-current={isActive ? 'page' : undefined}
              >
                <span>{item.label}</span>
                {isActive && (
                  <span className="absolute inset-x-3 bottom-1 h-0.5 rounded-full bg-[#EB4037]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Cụm Thao Tác (Giỏ Hàng + Tài Khoản + CTA) */}
        <div className="hidden shrink-0 items-center gap-1 md:flex lg:border-l lg:border-white/[0.08] lg:pl-3">

          {/* Nút Mở Giỏ Hàng */}
          <button
            type="button"
            onClick={openCart}
            className="relative flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-md px-2 text-[#F4F1EA] transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#EB4037]"
            title="Xem giỏ hàng"
            aria-label={`Xem giỏ hàng, hiện có ${totalCount} sản phẩm`}
          >
            <ShoppingBag aria-hidden="true" className="h-[18px] w-[18px] text-[#D1D5DB] lg:h-4 lg:w-4" />
            {totalCount > 0 && (
              <span aria-hidden="true" className="text-xs font-mono text-[#C8A261] lg:absolute lg:-top-1 lg:-right-1 lg:flex lg:h-[18px] lg:min-w-[18px] lg:items-center lg:justify-center lg:rounded-full lg:bg-[#EB4037] lg:px-1 lg:text-[10px] lg:font-bold lg:text-white">
                {totalCount}
              </span>
            )}
          </button>

          {/* Tài khoản */}
            <Link
              href={accountHref}
              className="hidden lg:inline-flex shrink-0 items-center gap-2 min-h-11 px-3 rounded-md text-xs text-[#D1D5DB] hover:text-white hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#EB4037]"
              title={accountUser?.fullName ?? 'Đăng nhập tài khoản'}
              aria-label={accountUser ? `Mở tài khoản của ${accountUser.fullName}` : 'Đăng nhập tài khoản'}
            >
              <User aria-hidden="true" className="w-4 h-4 shrink-0" strokeWidth={1.5} />
              <span className="max-w-28 truncate xl:max-w-36">{accountUser?.fullName ?? 'Tài khoản'}</span>
            </Link>

          {/* Nút CTA: Gửi file cần in */}
          <Link
            href="/in-theo-file"
              className="hidden lg:inline-flex shrink-0 whitespace-nowrap items-center gap-2 min-h-11 ml-1 px-4 rounded-lg bg-[#EB4037] hover:bg-[#FF5147] text-white text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Gửi file</span>
          </Link>

          {/* Nút Mở Menu Mobile */}
          <button
            type="button"
            onClick={(event) => openMobileMenu(event.currentTarget)}
            className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-sm border-l border-white/[0.12] pl-4 pr-1 text-sm text-[#F4F1EA] transition-colors hover:text-[#C8A261] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#EB4037] lg:hidden"
            aria-label={mobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
          >
            <span>Menu</span><Menu aria-hidden="true" className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>

      </div>

    </header>

    <MobileBottomBar onOpenMenu={openMobileMenu} menuOpen={mobileMenuOpen} />

    {mobileMenuOpen && (
      <ModalDialog title="Menu MinhLab" onDismiss={closeMobileMenu} className="items-end p-0 !bg-black/50 !backdrop-blur-none">
        <div id="mobile-navigation" className="max-h-[85dvh] w-full max-w-xl overflow-y-auto overscroll-contain rounded-t-2xl border border-b-0 border-white/[0.1] bg-[#0D1015] text-[#F4F1EA]">
          <div className="flex min-h-14 items-center justify-between border-b border-white/[0.06] px-6">
            <h2 className="text-sm font-medium tracking-wide">Khám phá MinhLab</h2>
            <button type="button" onClick={closeMobileMenu} aria-label="Đóng menu" className="flex min-h-11 items-center gap-2 rounded-sm px-1 text-sm hover:text-[#C8A261] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C8A261]">
              Đóng <X aria-hidden="true" className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>

          <div className="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
            <nav aria-label="Điều hướng chính">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link key={item.href} href={item.href} onClick={closeMobileMenu} onNavigate={item.href === '/' ? returnToHomeTop : undefined} aria-current={isActive ? 'page' : undefined}
                    className={`flex min-h-12 items-center justify-between gap-4 border-b border-white/[0.06] py-3 text-lg font-normal tracking-[-0.02em] transition-colors hover:text-[#C8A261] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C8A261] ${isActive ? 'text-[#C8A261]' : 'text-[#F4F1EA]'}`}>
                    <span>{item.label}</span>
                    {isActive && <ArrowUpRight aria-hidden="true" className="h-5 w-5 shrink-0" />}
                  </Link>
                );
              })}
            </nav>

            <div className="grid grid-cols-2 gap-3 pt-5">
              <Link href={accountHref}
                onClick={closeMobileMenu}
                className="flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-lg border border-white/[0.1] px-3 text-sm text-[#D1D5DB] hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C8A261]">
                <User aria-hidden="true" className="h-4 w-4 shrink-0" /><span className="truncate">{accountUser?.fullName ?? 'Tài khoản'}</span>
              </Link>
              <Link href="/in-theo-file" onClick={closeMobileMenu} className="flex min-h-12 items-center justify-between gap-4 rounded-lg bg-[#EB4037] px-4 text-sm font-medium text-white transition-colors hover:bg-[#FF5147] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261]">
                Gửi file <UploadCloud aria-hidden="true" className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </ModalDialog>
    )}
    </>
  );
};

export default Header;

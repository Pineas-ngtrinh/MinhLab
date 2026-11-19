'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { CartProvider } from '../../context/CartContext';
import { AuthProvider } from '../../context/AuthContext';
import { Header } from '../common/Header';
import { Footer } from '../common/Footer';
import { useCart } from '../../context/CartContext';

const CartDrawer = dynamic(() => import('../common/CartDrawer'));
const CheckoutModal = dynamic(() => import('../common/CheckoutModal'));

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const pathname = usePathname();
  const isSubpage = pathname !== '/';
  const isWorkspaceRoute = (pathname === '/admin' || pathname.startsWith('/admin/')) || pathname.startsWith('/tai-khoan');

  return (
    <AuthProvider>
      <CartProvider>
        <div className={`${isWorkspaceRoute ? '' : 'site-shell'} min-h-screen text-[#F4F1EA] flex flex-col justify-between selection:bg-[#EB4037]/20 selection:text-[#F4F1EA] w-full max-w-full relative ${pathname === '/' ? 'studio-shell overflow-x-clip' : 'overflow-x-hidden'}`}>

        {/* Thanh Điều Hướng Cố Định Dùng Chung */}
        {!isWorkspaceRoute && <Header />}

        {isWorkspaceRoute && pathname !== '/admin' && (
          <header className="relative z-10 border-b border-white/[0.08] bg-[#08090C]">
            <div className="mx-auto flex min-h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
              <Link
                href="/"
                aria-label="MinhLab — Về trang chủ"
                className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold tracking-wide text-[#F4F1EA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261]"
              >
                <span className="relative h-8 w-24 shrink-0 sm:w-28">
                  <Image src="/images/logo.png" alt="MinhLab" fill sizes="(max-width: 640px) 96px, 112px" preload className="object-contain object-left" />
                </span>
                <span className="text-xs font-normal text-[#737D89]">/ {pathname.startsWith('/admin') ? 'Cổng xưởng' : 'Tài khoản'}</span>
              </Link>
              <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-xs text-[#A5ADB8] transition-colors hover:text-[#F4F1EA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261]">
                Về cửa hàng <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </header>
        )}

        {/* Nội Dung Trang Hiện Tại */}
        <main className={`w-full max-w-full flex-1 relative z-[1] ${isWorkspaceRoute ? '' : isSubpage ? 'pt-20 sm:pt-24 lg:pt-28' : ''}`}>
          {children}
        </main>

        {/* Chân Trang Dùng Chung */}
        {!isWorkspaceRoute && <Footer />}

        {/* Drawer Giỏ Hàng Toàn Cục */}
        {!isWorkspaceRoute && <GlobalCommerceOverlays />}
      </div>
      </CartProvider>
    </AuthProvider>
  );
};

function GlobalCommerceOverlays() {
  const { isCartOpen, isCheckoutOpen } = useCart();
  return (
    <>
      {isCartOpen && <CartDrawer />}
      {isCheckoutOpen && <CheckoutModal />}
    </>
  );
}

export default AppLayout;

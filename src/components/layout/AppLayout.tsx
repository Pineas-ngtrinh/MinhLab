'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { CartProvider } from '../../context/CartContext';
import { AuthProvider } from '../../context/AuthContext';
import { Header } from '../common/Header';
import { Footer } from '../common/Footer';
import { CartDrawer } from '../common/CartDrawer';
import { CheckoutModal } from '../common/CheckoutModal';
import { MobileBottomBar } from '../common/MobileBottomBar';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const pathname = usePathname();
  const isSubpage = pathname !== '/';

  return (
    <AuthProvider>
      <CartProvider>
        <div className={`min-h-screen bg-[#0B0F14] text-[#F4F1EA] flex flex-col justify-between selection:bg-[#EB4037]/20 selection:text-[#F4F1EA] w-full max-w-full relative ${pathname === '/' ? 'overflow-x-clip' : 'overflow-x-hidden'}`}>
        {/* Lớp nền bản vẽ kỹ thuật CAD (Blueprint Grid) với các sọc ô lớn - nhỏ xen kẽ, hội tụ mờ ở trung tâm */}
        <div 
          className="fixed inset-0 pointer-events-none bg-blueprint-grid mask-blueprint-center z-0" 
          aria-hidden="true"
        />

        {/* Thanh Điều Hướng Cố Định Dùng Chung */}
        <Header />

        {/* Nội Dung Trang Hiện Tại */}
        <main className={`w-full max-w-full flex-1 relative z-[1] ${isSubpage ? 'pt-24 sm:pt-28 md:pt-32' : ''} pb-16 md:pb-0`}>
          {children}
        </main>

        {/* Chân Trang Dùng Chung */}
        <Footer />

        {/* Thanh Điều Hướng Nhanh Đáy Màn Hình Mobile */}
        <MobileBottomBar />

        {/* Drawer Giỏ Hàng Toàn Cục */}
        <CartDrawer />

        {/* Modal Đặt Hàng & Thanh Toán Toàn Cục */}
        <CheckoutModal />
      </div>
      </CartProvider>
    </AuthProvider>
  );
};

export default AppLayout;

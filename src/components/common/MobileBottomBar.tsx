'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Package, UploadCloud, ShoppingBag } from 'lucide-react';
import { useCart } from '../../context/CartContext';

export const MobileBottomBar: React.FC = () => {
  const pathname = usePathname();
  const { totalCount, openCart } = useCart();

  const navItems = [
    { label: 'Xưởng', href: '/', icon: Home },
    { label: 'Sản phẩm', href: '/bo-suu-tap', icon: Package },
    { label: 'Gửi file in', href: '/in-theo-file', icon: UploadCloud },
  ];

  return (
    <nav
      aria-label="Điều hướng nhanh di động"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0B0F14]/95 backdrop-blur-xl border-t border-[#27313C] px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] shadow-[0_-8px_24px_rgba(0,0,0,0.6)]"
    >
      <div className="grid grid-cols-4 items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center min-h-[48px] py-1 rounded-xl transition-all ${
                isActive
                  ? 'text-[#EB4037] font-semibold'
                  : 'text-[#8A94A6] hover:text-[#F4F1EA] active:scale-95'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110' : ''}`} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#EB4037]" />
                )}
              </div>
              <span className="text-[10px] font-mono tracking-tight mt-1">{item.label}</span>
            </Link>
          );
        })}

        {/* Nút mở giỏ hàng */}
        <button
          type="button"
          onClick={openCart}
          className="flex flex-col items-center justify-center min-h-[48px] py-1 rounded-xl text-[#8A94A6] hover:text-[#F4F1EA] active:scale-95 transition-all relative"
          aria-label={`Mở giỏ hàng, hiện có ${totalCount} sản phẩm`}
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5" />
            {totalCount > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[17px] h-[17px] px-1 rounded-full bg-[#EB4037] text-white text-[9px] font-mono font-bold flex items-center justify-center shadow-md animate-pulse">
                {totalCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-mono tracking-tight mt-1">Giỏ hàng</span>
        </button>
      </div>
    </nav>
  );
};

export default MobileBottomBar;

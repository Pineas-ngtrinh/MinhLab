'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Package, UploadCloud, ShoppingBag, Menu } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { returnToHomeTop } from './home-navigation';

interface MobileBottomBarProps {
  onOpenMenu: (trigger: HTMLButtonElement) => void;
  menuOpen: boolean;
}

export const MobileBottomBar: React.FC<MobileBottomBarProps> = ({ onOpenMenu, menuOpen }) => {
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
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#08090C] border-t border-white/[0.08] px-2 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom,0px))]"
    >
      <div className="grid grid-cols-5 items-center justify-around max-w-xl mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onNavigate={item.href === '/' ? returnToHomeTop : undefined}
              className={`flex min-w-0 flex-col items-center justify-center min-h-[48px] py-1 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C8A261] ${
                isActive
                  ? 'text-[#EB4037] font-semibold'
                  : 'text-[#8A94A6] hover:text-[#F4F1EA]'
              }`}
              aria-current={isActive ? 'page' : undefined}
              title={item.label}
            >
              <div className="relative">
                <Icon aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.5} />
              </div>
              <span className="max-w-full truncate px-1 text-[11px] tracking-tight mt-1">{item.label}</span>
            </Link>
          );
        })}

        {/* Nút mở giỏ hàng */}
        <button
          type="button"
          onClick={openCart}
          className="flex min-h-12 min-w-0 flex-col items-center justify-center rounded-lg py-1 text-[#8A94A6] transition-colors hover:text-[#F4F1EA] relative focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C8A261]"
          aria-label={`Mở giỏ hàng, hiện có ${totalCount} sản phẩm`}
        >
          <div className="relative">
            <ShoppingBag aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.5} />
            {totalCount > 0 && (
              <span aria-hidden="true" className="absolute -top-1.5 -right-2 min-w-[17px] h-[17px] px-1 rounded-full bg-[#EB4037] text-white text-[9px] font-mono font-bold flex items-center justify-center">
                {totalCount}
              </span>
            )}
          </div>
          <span className="text-[11px] tracking-tight mt-1">Giỏ hàng</span>
        </button>
        <button type="button" onClick={(event) => onOpenMenu(event.currentTarget)} aria-label="Mở menu điều hướng" aria-haspopup="dialog" aria-expanded={menuOpen} aria-controls="mobile-navigation"
          className="flex min-h-12 min-w-0 flex-col items-center justify-center rounded-lg py-1 text-[#8A94A6] transition-colors hover:text-[#F4F1EA] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C8A261]">
          <Menu aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={1.5} />
          <span className="mt-1 text-[11px] tracking-tight">Menu</span>
        </button>
      </div>
    </nav>
  );
};

export default MobileBottomBar;

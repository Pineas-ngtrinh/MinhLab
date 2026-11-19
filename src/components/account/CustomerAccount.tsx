'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Package, RefreshCw, UploadCloud } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { usePaginatedList } from '../../hooks/usePaginatedList';
import type { CustomerOrderData, CustomerOrderSummary } from '../../contracts/orders';
import { AccountProfile } from './AccountProfile';
import { CustomerOrderOverview } from './CustomerOrderOverview';
import { CustomerOrderHistory } from './CustomerOrderHistory';

export function CustomerAccount() {
  const router = useRouter();
  const { user, isAuthenticated, isAuthReady, logout } = useAuth();
  const [accountError, setAccountError] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const orderList = usePaginatedList<CustomerOrderData, CustomerOrderSummary>(
    '/api/customer/orders',
    isAuthReady && user?.role === 'CUSTOMER',
    user?.id,
  );

  useEffect(() => {
    if (!isAuthReady) return;
    if (!isAuthenticated || !user) {
      router.replace('/dang-nhap');
    } else if (user.role !== 'CUSTOMER') {
      router.replace('/admin');
    }
  }, [isAuthReady, isAuthenticated, user, router]);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setAccountError('');
    setIsLoggingOut(true);
    try {
      await logout();
      router.replace('/dang-nhap');
    } catch {
      setAccountError('Chưa thể đăng xuất. Vui lòng kiểm tra kết nối và thử lại.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (!isAuthReady || !isAuthenticated || !user || user.role !== 'CUSTOMER') {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <div role="status" aria-live="polite" className="flex items-center gap-3 text-sm font-mono text-[#A5ADB8]">
          <RefreshCw aria-hidden="true" className="h-4 w-4 animate-spin text-[#C8A261] motion-reduce:animate-none" />
          <span>{!isAuthReady ? 'Đang xác thực phiên đăng nhập…' : 'Đang chuyển đến trang phù hợp…'}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[85vh] max-w-7xl mx-auto px-4 sm:px-8 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:pb-12 text-left space-y-8">
      <AccountProfile user={user} onLogout={handleLogout} isLoggingOut={isLoggingOut} error={accountError} />
      <Link href="/yeu-cau-in" className="inline-flex min-h-11 items-center rounded-lg border border-[#27313C] px-4 text-sm text-[#C8A261] focus-visible:ring-2 focus-visible:ring-[#C8A261]">Yêu cầu in và báo giá của tôi</Link>
      <Link href="/lien-ket-telegram" className="inline-flex min-h-11 items-center px-4 text-sm text-[#C8A261] underline focus-visible:ring-2 focus-visible:ring-[#C8A261]">Liên kết Telegram của tôi</Link>
      <CustomerOrderOverview summary={orderList.summary} isLoading={orderList.isLoading} hasError={Boolean(orderList.error)} />
      <CustomerOrderHistory orderList={orderList} />

      <nav
        aria-label="Lối tắt mua sắm và gửi yêu cầu"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/[0.08] bg-[#08090C]/95 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] backdrop-blur-xl"
      >
        <div className="mx-auto grid max-w-lg grid-cols-2 gap-2">
          <Link href="/bo-suu-tap" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/[0.1] bg-[#111216] px-3 text-xs font-medium text-[#F4F1EA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261]">
            <Package aria-hidden="true" className="h-4 w-4" />
            Sản phẩm
          </Link>
          <Link href="/in-theo-file" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-[#EB4037] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#FF5147] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261]">
            <UploadCloud aria-hidden="true" className="h-4 w-4" />
            Gửi file 3D
          </Link>
        </div>
      </nav>
    </div>
  );
}

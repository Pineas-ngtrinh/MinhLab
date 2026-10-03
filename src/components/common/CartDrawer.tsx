'use client';

import React from 'react';
import Image from 'next/image';
import { useCart } from '../../context/CartContext';
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight, ShieldCheck } from 'lucide-react';

export const CartDrawer: React.FC = () => {
  const {
    items,
    isCartOpen,
    closeCart,
    updateQuantity,
    removeFromCart,
    totalPrice,
    totalCount,
    openCheckout,
  } = useCart();

  // Khóa cuộn trang nền khi mở giỏ hàng
  React.useEffect(() => {
    if (!isCartOpen) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCart();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCartOpen, closeCart]);

  if (!isCartOpen) return null;

  // Định dạng tiền VNĐ chuẩn Việt Nam
  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  // Mốc miễn phí vận chuyển: từ 500.000₫
  const FREESHIP_THRESHOLD = 500000;
  const progressFreeship = Math.min(100, (totalPrice / FREESHIP_THRESHOLD) * 100);
  const remainingForFreeship = FREESHIP_THRESHOLD - totalPrice;

  return (
    <div 
      className="fixed inset-0 z-50 flex justify-end animate-fadeIn"
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Lớp nền mờ khi mở giỏ hàng: Click để đóng */}
      <div
        onClick={closeCart}
        onTouchMove={(e) => e.preventDefault()}
        onWheel={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity cursor-pointer"
      />

      {/* Panel giỏ hàng trượt từ phải sang (Dark Workshop) */}
      <div 
        role="dialog"
        aria-modal="true"
        aria-label="Giỏ hàng MinhLab"
        data-testid="cart-drawer"
        onWheel={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-md bg-[#141A21] border-l border-[#27313C] shadow-2xl flex flex-col h-full text-[#F4F1EA]"
      >
        
        {/* Header Giỏ Hàng */}
        <div className="flex items-center justify-between p-5 border-b border-[#27313C] bg-[#0F141A]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EB4037]/15 text-[#EB4037] flex items-center justify-center">
              <ShoppingBag className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#F4F1EA]">Giỏ Hàng MinhLab</h3>
              <p className="text-xs font-mono text-[#A5ADB8]">
                {totalCount > 0 ? `${totalCount} sản phẩm được chọn` : 'Chưa có sản phẩm'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeCart}
            className="p-2 rounded-lg bg-[#141A21] hover:bg-[#1A222C] text-[#A5ADB8] hover:text-[#F4F1EA] border border-[#27313C] transition-colors"
            aria-label="Đóng giỏ hàng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thanh tiến trình Miễn phí vận chuyển */}
        <div className="p-4 bg-[#0F141A]/50 border-b border-[#27313C] text-xs">
          {totalPrice >= FREESHIP_THRESHOLD ? (
            <div className="flex items-center gap-2 text-[#6F9576] font-medium">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Đơn hàng của bạn được <strong>MIỄN PHÍ VẬN CHUYỂN</strong>.</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[#A5ADB8]">
                <span>Mua thêm <strong className="text-[#F4F1EA]">{formatVND(remainingForFreeship)}</strong> để Freeship</span>
                <span className="font-mono text-[#F4F1EA]">{Math.round(progressFreeship)}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#0B0F14] rounded-full overflow-hidden border border-[#27313C]">
                <div
                  className="h-full bg-[#6F9576] transition-all duration-300 rounded-full"
                  style={{ width: `${progressFreeship}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Danh Sách Sản Phẩm Trong Giỏ */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-[#27313C]">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="w-14 h-14 rounded-xl bg-[#0F141A] border border-[#27313C] flex items-center justify-center text-[#737D89]">
                <ShoppingBag className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-[#F4F1EA]">Giỏ hàng của bạn đang trống</h4>
                <p className="text-xs text-[#A5ADB8] mt-1">Hãy khám phá bộ sưu tập để chọn món đồ ưng ý.</p>
              </div>
              <button
                type="button"
                onClick={closeCart}
                className="mt-2 px-5 py-2.5 rounded-lg bg-[#EB4037] hover:bg-[#FF5147] text-xs font-medium text-white transition-colors"
              >
                Tiếp tục xem sản phẩm
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div key={`${item.product.id}-${item.selectedColor || ''}`} className="pt-3 first:pt-0 flex gap-3.5 items-center">
                <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-[#0F141A] border border-[#27313C] shrink-0">
                  <Image
                    src={item.product.image}
                    alt={item.product.title}
                    fill
                    className="object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0 space-y-1 text-left">
                  <h4 className="text-xs font-semibold text-[#F4F1EA] truncate">
                    {item.product.title}
                  </h4>
                  {item.selectedColor && (
                    <p className="text-[11px] text-[#A5ADB8] truncate font-mono">
                      Màu: {item.selectedColor}
                    </p>
                  )}
                  <div className="text-xs font-mono font-bold text-[#F4F1EA]">
                    {formatVND(item.product.price)}
                  </div>
                </div>

                {/* Điều khiển số lượng */}
                <div className="flex items-center gap-1 bg-[#0F141A] border border-[#27313C] rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                    className="p-1 rounded hover:bg-[#1A222C] text-[#A5ADB8] hover:text-[#F4F1EA] transition-colors"
                    aria-label="Giảm số lượng"
                  >
                    <Minus className="w-3 h-3" />
                  </button>

                  <span className="w-6 text-center text-xs font-mono font-bold text-[#F4F1EA]">
                    {item.quantity}
                  </span>

                  <button
                    type="button"
                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                    className="p-1 rounded hover:bg-[#1A222C] text-[#A5ADB8] hover:text-[#F4F1EA] transition-colors"
                    aria-label="Tăng số lượng"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                {/* Nút xóa món */}
                <button
                  type="button"
                  onClick={() => removeFromCart(item.product.id)}
                  className="p-1.5 text-[#737D89] hover:text-[#EB4037] transition-colors"
                  title="Xóa khỏi giỏ"
                  aria-label="Xóa"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer Giỏ Hàng (Tổng tiền & Nút Đặt Hàng) */}
        {items.length > 0 && (
          <div className="p-5 border-t border-[#27313C] bg-[#0F141A] space-y-3">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-[#A5ADB8]">
                <span>Tạm tính ({totalCount} món):</span>
                <span className="font-mono text-[#F4F1EA]">{formatVND(totalPrice)}</span>
              </div>
              <div className="flex justify-between text-[#A5ADB8]">
                <span>Phí vận chuyển:</span>
                <span className="text-[#6F9576] font-medium">{totalPrice >= FREESHIP_THRESHOLD ? 'Miễn phí' : 'Tính khi nhận'}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-[#F4F1EA] pt-2 border-t border-[#27313C]">
                <span>Tổng cộng:</span>
                <span className="text-base font-mono text-[#EB4037]">{formatVND(totalPrice)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                closeCart();
                openCheckout();
              }}
              className="w-full py-3.5 px-6 rounded-lg bg-[#EB4037] hover:bg-[#FF5147] text-white font-medium text-sm shadow-subtle transition-all flex items-center justify-center gap-2"
            >
              <span>Tiến hành đặt hàng</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default CartDrawer;

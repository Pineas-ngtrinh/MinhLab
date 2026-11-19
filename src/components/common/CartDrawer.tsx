'use client';

import React from 'react';
import Image from './ProductImage';
import { useCart } from '../../context/CartContext';
import { X, Trash2, ShoppingBag, ArrowRight, ShieldCheck } from 'lucide-react';
import { ModalDialog } from './ModalDialog';
import { catalogShippingFee, CATALOG_FREE_SHIPPING_FROM } from '../../domain/orders/checkout-pricing';
import { QuantityControl } from './QuantityControl';
import { formatVND } from '../../lib/format';

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
    cartLoading,
    cartError,
  } = useCart();

  if (!isCartOpen) return null;

  // Mốc miễn phí vận chuyển: từ 500.000₫
  const FREESHIP_THRESHOLD = CATALOG_FREE_SHIPPING_FROM;
  const shippingFee = catalogShippingFee(totalPrice);
  const progressFreeship = Math.min(100, (totalPrice / FREESHIP_THRESHOLD) * 100);
  const remainingForFreeship = FREESHIP_THRESHOLD - totalPrice;

  return (
    <ModalDialog title="Giỏ hàng MinhLab" onDismiss={closeCart} testId="cart-drawer" className="!justify-end items-stretch p-0 animate-fadeIn">
      {/* Panel giỏ hàng trượt từ phải sang (Dark Workshop) */}
      <div 
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
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#141A21] hover:bg-[#1A222C] text-[#A5ADB8] hover:text-[#F4F1EA] border border-[#27313C] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261]"
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
          {cartLoading || cartError ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center" role={cartError ? 'alert' : 'status'}>
              <p className="text-sm text-[#F4F1EA]">{cartError || 'Đang tải giỏ hàng…'}</p>
              {cartError && <button type="button" onClick={() => window.location.reload()}
                className="min-h-11 px-4 text-sm text-[#C8A261] underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-[#C8A261]">
                Tải lại trang
              </button>}
            </div>
          ) : items.length === 0 ? (
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
              <div key={`${item.product.id}-${item.variantId ?? item.selectedColor ?? ''}`} className="grid grid-cols-[64px_minmax(0,1fr)_44px] items-center gap-x-3 gap-y-2 pt-4 first:pt-0">
                <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-[#090D12] border border-[#27313C] shrink-0 flex items-center justify-center">
                  <Image
                    src={item.product.image}
                    alt={item.product.title}
                    fill
                    sizes="64px"
                    className="object-contain p-1"
                  />
                </div>

                <div className="flex-1 min-w-0 space-y-1 text-left">
                  <h4 className="line-clamp-2 text-xs font-semibold leading-snug text-[#F4F1EA]">
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

                <div className="col-start-2 row-start-2">
                  <QuantityControl value={item.quantity}
                    onChange={quantity => updateQuantity(item.product.id, quantity, item.variantId ?? item.selectedColor)}
                    label={item.product.title} />
                </div>

                {/* Nút xóa món */}
                <button
                  type="button"
                  onClick={() => removeFromCart(item.product.id, item.variantId ?? item.selectedColor)}
                  className="col-start-3 row-start-1 flex h-11 w-11 items-center justify-center rounded-lg text-[#A5ADB8] transition-colors hover:text-[#EB4037] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261]"
                  title="Xóa khỏi giỏ"
                  aria-label={`Xóa ${item.product.title} khỏi giỏ hàng`}
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
                <span className="text-[#6F9576] font-medium">{shippingFee === 0 ? 'Miễn phí' : formatVND(shippingFee)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-[#F4F1EA] pt-2 border-t border-[#27313C]">
                <span>Tổng cộng:</span>
                <span className="text-base font-mono text-[#EB4037]">{formatVND(totalPrice + shippingFee)}</span>
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
    </ModalDialog>
  );
};

export default CartDrawer;

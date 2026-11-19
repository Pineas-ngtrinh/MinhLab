'use client';

/**
 * =====================================================================
 * MINHLAB 3D - CART CONTEXT (QUẢN LÝ GIỎ HÀNG & ĐẶT MUA SẢN PHẨM)
 * =====================================================================
 * Tác dụng:
 *  - Quản lý trạng thái giỏ hàng (thêm, sửa số lượng, xóa sản phẩm).
 *  - Mở/đóng Drawer giỏ hàng và Modal thanh toán nhanh (Quick Checkout).
 *  - Tính toán tổng tiền, số lượng sản phẩm, lưu giỏ hàng vào localStorage.
 *
 * Cách sử dụng trong component:
 *  const { items, addToCart, openCart, openCheckout } = useCart();
 * =====================================================================
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { restoreCart, matchesCartItem, mergeCartItems, cartReferences } from '../lib/cart';
import { selectProductVariant } from '../lib/catalog';
import type { ProductItem, CatalogData } from '../contracts/catalog';
import type { ApiResponse } from '../contracts/api';

export interface CartItem {
  variantId?: string;
  product: ProductItem;
  quantity: number;
  selectedColor?: string;
}

interface CartContextType {
  cartLoading: boolean;
  cartError: string;
  items: CartItem[];
  totalCount: number;
  totalPrice: number;
  isCartOpen: boolean;
  isCheckoutOpen: boolean;
  directBuyProduct: CartItem | null;
  addToCart: (product: ProductItem, quantity?: number, selectedColor?: string) => boolean;
  removeFromCart: (productId: string, selectedColor?: string) => void;
  updateQuantity: (productId: string, quantity: number, selectedColor?: string) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  openCheckout: (directProduct?: { product: ProductItem; selectedColor?: string; quantity?: number }) => void;
  updateCheckoutQuantity: (productId: string, quantity: number, selectedColor?: string) => void;
  closeCheckout: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'minhlab_cart_items_v1';

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [cartError, setCartError] = useState('');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [directBuyProduct, setDirectBuyProduct] = useState<CartItem | null>(null);

  // Đọc dữ liệu giỏ hàng từ localStorage khi trang load (Client-side)
  useEffect(() => {
    const controller = new AbortController();
    let saved: unknown;
    try {
      saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || '[]');
    } catch { saved = []; }
    if (!Array.isArray(saved) || saved.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Rehydrate browser storage after mount; keep SSR deterministic.
      setCartLoaded(true);
      return;
    }
    async function load() {
      try {
        const response = await fetch('/api/catalog', {cache:'no-store',signal:controller.signal});
        const body: ApiResponse<CatalogData> = await response.json();
        if (!response.ok || !body.success) throw new Error('Catalogue unavailable');
        if (controller.signal.aborted) return;
        setItems(added => mergeCartItems(restoreCart(saved, body.data.products), added));
        setCartLoaded(true);
      } catch {
        if (!controller.signal.aborted) setCartError('Chưa thể tải giỏ hàng đã lưu. Vui lòng tải lại trang để thử lại.');
      }
    }
    void load();
    return () => controller.abort();
  }, []);

  // Tự động lưu giỏ hàng vào localStorage mỗi khi có thay đổi
  useEffect(() => {
    if (!cartLoaded) return;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartReferences(items)));
    } catch {
      // Bỏ qua lỗi lưu nếu bộ nhớ bị khóa
    }
  }, [items, cartLoaded]);

  // Thêm sản phẩm vào giỏ
  const addToCart = (product: ProductItem, quantity: number = 1, selectedColor?: string) => {
    if (!Number.isInteger(quantity) || quantity < 1) return false;
    if (!cartLoaded) { setIsCartOpen(true); return false; }
    const selected = selectProductVariant(product, selectedColor);
    if (!selected) return false;
    const variant = selected.variants.find(value=>value.available && (!selectedColor || value.name===selectedColor))!;
    setItems((prev) => {
      const color = selectedColor || product.colors?.[0]?.name;
      const existingIndex = prev.findIndex(
        (item) => item.product.id === product.id && (item.variantId ? item.variantId === variant.id : item.selectedColor === color)
      );

      if (existingIndex > -1) {
        return prev.map((item, index) => index === existingIndex
          ? { ...item, product: selected, variantId:variant.id, quantity: Math.min(100, item.quantity + quantity) } : item);
      }

      return [...prev, { product: selected, variantId:variant.id, quantity: Math.min(100, quantity), selectedColor: color }];
    });

    // Mở giỏ hàng để khách thấy sản phẩm vừa thêm
    setIsCartOpen(true);
    return true;
  };

  // Xóa sản phẩm khỏi giỏ
  const removeFromCart = (productId: string, selectedColor?: string) => {
    setItems((prev) => prev.filter((item) => !matchesCartItem(item, productId, selectedColor)));
  };

  // Cập nhật số lượng
  const updateQuantity = (productId: string, quantity: number, selectedColor?: string) => {
    if (quantity <= 0) {
      removeFromCart(productId, selectedColor);
      return;
    }

    if (!Number.isInteger(quantity)) return;
    setItems((prev) =>
      prev.map((item) => (matchesCartItem(item, productId, selectedColor) ? { ...item, quantity: Math.min(100, quantity) } : item))
    );
  };

  // Xóa sạch giỏ hàng (sau khi đặt hàng thành công)
  const clearCart = () => {
    setItems([]);
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
    } catch {}
  };

  // Mở giỏ hàng
  const openCart = () => setIsCartOpen(true);
  const closeCart = () => setIsCartOpen(false);

  // Mở modal thanh toán (Hỗ trợ Mua ngay 1 sản phẩm cụ thể hoặc toàn bộ giỏ)
  const openCheckout = (directProduct?: { product: ProductItem; selectedColor?: string; quantity?: number }) => {
    if (directProduct) {
      const quantity = directProduct.quantity ?? 1;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) return;
      const selected = selectProductVariant(directProduct.product, directProduct.selectedColor);
      if (!selected) return;
      setDirectBuyProduct({
        product: selected,
        variantId:selected.variants.find(value=>value.available && (!directProduct.selectedColor || value.name===directProduct.selectedColor))?.id,
        quantity,
        selectedColor: directProduct.selectedColor || directProduct.product.colors?.[0]?.name,
      });
    } else {
      if (!cartLoaded || items.length === 0) return;
      setDirectBuyProduct(null);
    }
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  const closeCheckout = () => {
    setIsCheckoutOpen(false);
    setDirectBuyProduct(null);
  };

  const updateCheckoutQuantity = (productId: string, quantity: number, selectedColor?: string) => {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) return;
    if (directBuyProduct) {
      setDirectBuyProduct(current => current && matchesCartItem(current, productId, selectedColor)
        ? { ...current, quantity } : current);
    } else {
      updateQuantity(productId, quantity, selectedColor);
    }
  };

  // Tính tổng số lượng sản phẩm trong giỏ
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Tính tổng tiền các sản phẩm trong giỏ
  const totalPrice = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cartLoading: !cartLoaded && !cartError,
        cartError,
        items,
        totalCount,
        totalPrice,
        isCartOpen,
        isCheckoutOpen,
        directBuyProduct,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        openCart,
        closeCart,
        openCheckout,
        updateCheckoutQuantity,
        closeCheckout,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

// Hook tiện lợi dùng trong các component
export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
};

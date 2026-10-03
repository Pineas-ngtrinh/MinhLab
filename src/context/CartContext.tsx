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
import { ProductItem } from '../config/site.config';

export interface CartItem {
  product: ProductItem;
  quantity: number;
  selectedColor?: string;
}

interface CartContextType {
  items: CartItem[];
  totalCount: number;
  totalPrice: number;
  isCartOpen: boolean;
  isCheckoutOpen: boolean;
  directBuyProduct: CartItem | null;
  addToCart: (product: ProductItem, quantity?: number, selectedColor?: string) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  openCheckout: (directProduct?: { product: ProductItem; selectedColor?: string }) => void;
  closeCheckout: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'minhlab_cart_items_v1';

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [directBuyProduct, setDirectBuyProduct] = useState<CartItem | null>(null);

  // Đọc dữ liệu giỏ hàng từ localStorage khi trang load (Client-side)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        setItems(JSON.parse(saved));
      }
    } catch {
      // Bỏ qua lỗi parse nếu chưa có dữ liệu
    }
  }, []);

  // Tự động lưu giỏ hàng vào localStorage mỗi khi có thay đổi
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // Bỏ qua lỗi lưu nếu bộ nhớ bị khóa
    }
  }, [items]);

  // Thêm sản phẩm vào giỏ
  const addToCart = (product: ProductItem, quantity: number = 1, selectedColor?: string) => {
    setItems((prev) => {
      const color = selectedColor || product.colors?.[0]?.name;
      const existingIndex = prev.findIndex(
        (item) => item.product.id === product.id && item.selectedColor === color
      );

      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].quantity += quantity;
        return updated;
      }

      return [...prev, { product, quantity, selectedColor: color }];
    });

    // Mở giỏ hàng để khách thấy sản phẩm vừa thêm
    setIsCartOpen(true);
  };

  // Xóa sản phẩm khỏi giỏ
  const removeFromCart = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Cập nhật số lượng
  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setItems((prev) =>
      prev.map((item) => (item.product.id === productId ? { ...item, quantity } : item))
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
  const openCheckout = (directProduct?: { product: ProductItem; selectedColor?: string }) => {
    if (directProduct) {
      setDirectBuyProduct({
        product: directProduct.product,
        quantity: 1,
        selectedColor: directProduct.selectedColor || directProduct.product.colors?.[0]?.name,
      });
    } else {
      setDirectBuyProduct(null);
    }
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  const closeCheckout = () => {
    setIsCheckoutOpen(false);
    setDirectBuyProduct(null);
  };

  // Tính tổng số lượng sản phẩm trong giỏ
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);

  // Tính tổng tiền các sản phẩm trong giỏ
  const totalPrice = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
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
        closeCheckout,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

// Giá trị fallback an toàn tránh lỗi crash nếu component được render độc lập
const defaultCartContext: CartContextType = {
  items: [],
  totalCount: 0,
  totalPrice: 0,
  isCartOpen: false,
  isCheckoutOpen: false,
  directBuyProduct: null,
  addToCart: () => {},
  removeFromCart: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  openCart: () => {},
  closeCart: () => {},
  openCheckout: () => {},
  closeCheckout: () => {},
};

// Hook tiện lợi dùng trong các component
export const useCart = () => {
  const context = useContext(CartContext);
  return context || defaultCartContext;
};

'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { SITE_CONFIG, type ProductItem } from '../../config/site.config';
import { useCart } from '../../context/CartContext';
import { ShoppingBag, Box, ArrowRight, Check } from 'lucide-react';
import { Product3DModal } from '../common/Product3DModal';

export const HomeFeaturedProducts: React.FC = () => {
  const { addToCart } = useCart();
  const [activeCategory, setActiveCategory] = useState('all');
  const [modalProduct, setModalProduct] = useState<ProductItem | null>(null);
  const [addedId, setAddedId] = useState<string | null>(null);

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const filteredProducts = activeCategory === 'all'
    ? SITE_CONFIG.products
    : SITE_CONFIG.products.filter(p => p.categorySlug === activeCategory);

  const handleQuickAdd = (product: ProductItem, e: React.MouseEvent) => {
    e.stopPropagation();
    addToCart(product, 1);
    setAddedId(product.id);
    setTimeout(() => setAddedId(null), 1800);
  };

  // Sản phẩm tiêu điểm đầu tiên
  const leadProduct = filteredProducts[0];
  const gridProducts = filteredProducts.slice(1);

  return (
    <section id="showroom-san-pham" className="py-20 sm:py-28 lg:py-32 px-4 sm:px-8 border-b border-white/[0.06] bg-[#08090C]">
      <div className="max-w-6xl mx-auto w-full">
        
        {/* ============================================================== */}
        {/* SECTION HEADER — EDITORIAL CATALOGUE TITLE                     */}
        {/* ============================================================== */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 sm:mb-16">
          <div className="space-y-4 text-left max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-[11px] font-mono tracking-widest text-[#A5ADB8] uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[#EB4037]" />
              <span>№ 01 / CATALOGUE · TỦ TRƯNG BÀY SẢN PHẨM 3D</span>
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#F4F1EA] leading-[1.08]">
              Những tạo tác bước ra từ xưởng.
            </h2>
            <p className="text-sm sm:text-base text-[#A5ADB8] leading-relaxed font-normal">
              Mỗi sản phẩm đều được in ở độ mịn layer 0.12mm, gọt bavia thủ công và kiểm định tỉ mỉ bằng thước kẹp điện tử trước khi đến tay bạn.
            </p>
          </div>

          <Link
            href="/bo-suu-tap"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-mono text-[#F4F1EA] hover:text-[#EB4037] transition-colors self-start md:self-end group py-2"
          >
            <span>XEM TOÀN BỘ BỘ SƯU TẬP</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* ============================================================== */}
        {/* CATEGORY FILTER — MINIMALIST PILLS                            */}
        {/* ============================================================== */}
        <div className="flex items-center gap-2 pb-2 overflow-x-auto no-scrollbar mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 p-1 rounded-full bg-white/[0.03] border border-white/[0.06]">
            {SITE_CONFIG.categories.map((cat) => {
              const isActive = activeCategory === cat.slug;
              return (
                <button
                  key={cat.slug}
                  type="button"
                  onClick={() => setActiveCategory(cat.slug)}
                  className={`min-h-[38px] px-4 rounded-full text-xs font-mono transition-all duration-150 whitespace-nowrap flex items-center justify-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#EB4037] ${
                    isActive
                      ? 'bg-white text-black font-semibold shadow-sm'
                      : 'text-[#A5ADB8] hover:text-white hover:bg-white/[0.04]'
                  }`}
                  aria-pressed={isActive}
                >
                  <span>{cat.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ============================================================== */}
        {/* 1. LEAD PRODUCT SPOTLIGHT (TIÊU ĐIỂM SẢN PHẨM SIGNATURE)        */}
        {/* ============================================================== */}
        {leadProduct && (
          <div className="mb-12 sm:mb-16 rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden grid grid-cols-1 lg:grid-cols-12 transition-all duration-300 hover:border-white/[0.12]">
            {/* Ảnh sản phẩm khổ lớn */}
            <div className="lg:col-span-7 relative aspect-[16/10] sm:aspect-[16/9] lg:aspect-auto w-full bg-[#090D12] overflow-hidden group">
              <Image
                src={leadProduct.image}
                alt={leadProduct.title}
                fill
                sizes="(max-width: 1024px) 100vw, 60vw"
                className="object-cover object-center group-hover:scale-103 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#08090C] via-transparent to-transparent opacity-60" />

              {/* Tag góc trên & Nút 3D */}
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
                <span className="px-3 py-1 rounded-full bg-[#08090C]/80 backdrop-blur-md border border-white/[0.08] text-[11px] font-mono text-white">
                  {leadProduct.code || 'SIGNATURE № 01'}
                </span>

                {(leadProduct.id === 'prod-mascot-monkey' || leadProduct.id === 'prod-lab-diorama') && (
                  <button
                    type="button"
                    onClick={() => setModalProduct(leadProduct)}
                    className="pointer-events-auto min-h-[34px] px-3.5 rounded-full bg-white/[0.1] hover:bg-white/[0.2] text-white text-xs font-mono flex items-center gap-1.5 backdrop-blur-md border border-white/[0.15] transition-all active:scale-95 shadow-md"
                    title="Mở trình xem 3D xoay 360 độ"
                    aria-label={`Xoay 3D sản phẩm ${leadProduct.title}`}
                  >
                    <Box className="w-3.5 h-3.5" />
                    <span>Xoay 3D 360°</span>
                  </button>
                )}
              </div>
            </div>

            {/* Bảng thông số kỹ thuật & Đặt hàng */}
            <div className="lg:col-span-5 p-6 sm:p-8 lg:p-10 flex flex-col justify-between text-left space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-mono text-[#C8A261]">
                  <span>{leadProduct.category}</span>
                  <span>•</span>
                  <span>{leadProduct.badge || 'ĐỘC BẢN'}</span>
                </div>

                <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight leading-snug">
                  {leadProduct.title}
                </h3>

                <p className="text-xs sm:text-sm text-[#A5ADB8] leading-relaxed">
                  {leadProduct.longDescription || leadProduct.description}
                </p>

                {/* Spec Sheet thu nhỏ phong cách Analogue */}
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/[0.06] text-xs font-mono">
                  <div>
                    <span className="text-[#737D89] block text-[11px]">ĐỘ PHÂN GIẢI</span>
                    <span className="text-[#F4F1EA] font-semibold">{leadProduct.layerHeight || '0.12 mm'}</span>
                  </div>
                  <div>
                    <span className="text-[#737D89] block text-[11px]">VẬT LIỆU</span>
                    <span className="text-[#F4F1EA] font-semibold">{leadProduct.material}</span>
                  </div>
                  <div>
                    <span className="text-[#737D89] block text-[11px]">KÍCH THƯỚC</span>
                    <span className="text-[#F4F1EA] font-semibold">{leadProduct.dimensions}</span>
                  </div>
                  <div>
                    <span className="text-[#737D89] block text-[11px]">THỜI GIAN IN</span>
                    <span className="text-[#F4F1EA] font-semibold">{leadProduct.printTime || '16 giờ'}</span>
                  </div>
                </div>
              </div>

              {/* Price & CTA */}
              <div className="pt-6 border-t border-white/[0.06] flex items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] font-mono text-[#737D89] block uppercase">Giá chế tác hoàn thiện</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xl sm:text-2xl font-mono font-bold text-white">
                      {formatVND(leadProduct.price)}
                    </span>
                    {leadProduct.originalPrice && (
                      <span className="text-xs font-mono text-[#737D89] line-through">
                        {formatVND(leadProduct.originalPrice)}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => handleQuickAdd(leadProduct, e)}
                  className={`min-h-[46px] px-6 rounded-full text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white ${
                    addedId === leadProduct.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#EB4037] hover:bg-[#FF5147] text-white shadow-md'
                  }`}
                  aria-label={`Thêm ${leadProduct.title} vào giỏ`}
                >
                  {addedId === leadProduct.id ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Đã vào giỏ</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4" />
                      <span>Thêm vào giỏ</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 2. COMPANION PIECES GRID (CÁC SẢN PHẨM ĐỒNG HÀNH)               */}
        {/* ============================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {gridProducts.map((product) => {
            const has3D = product.id === 'prod-mascot-monkey' || product.id === 'prod-lab-diorama';
            const isAdded = addedId === product.id;

            return (
              <div
                key={product.id}
                className="group rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.14] transition-all duration-300 overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Image Container with Badges */}
                  <div className="relative aspect-[4/3] w-full bg-[#090D12] overflow-hidden">
                    <Image
                      src={product.image}
                      alt={product.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover object-center group-hover:scale-103 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#08090C] via-transparent to-transparent opacity-50" />

                    {/* Top Badges */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-full bg-[#08090C]/80 backdrop-blur-md border border-white/[0.08] text-[10px] font-mono text-[#D1D5DB]">
                        {product.code || product.category}
                      </span>

                      {has3D && (
                        <button
                          type="button"
                          onClick={() => setModalProduct(product)}
                          className="min-h-[30px] px-2.5 rounded-full bg-white/[0.1] hover:bg-white/[0.2] text-white text-[11px] font-mono flex items-center gap-1.5 backdrop-blur-md border border-white/[0.15] transition-transform active:scale-95"
                          title="Mở trình xem 3D xoay 360 độ"
                          aria-label={`Xoay 3D sản phẩm ${product.title}`}
                        >
                          <Box className="w-3 h-3" />
                          <span>3D</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-5 space-y-3 text-left">
                    <h3 className="text-base font-bold text-[#F4F1EA] group-hover:text-white transition-colors line-clamp-1">
                      {product.title}
                    </h3>
                    <p className="text-xs text-[#A5ADB8] line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>

                    {/* Quick Specs */}
                    <div className="flex items-center gap-2.5 text-[11px] font-mono text-[#737D89] pt-2 border-t border-white/[0.06]">
                      <span>{product.layerHeight || '0.12mm'}</span>
                      <span>•</span>
                      <span>{product.material.split(' ')[0]}</span>
                      <span>•</span>
                      <span>{product.dimensions}</span>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Price & CTA */}
                <div className="p-5 pt-0 flex items-center justify-between gap-3">
                  <div className="text-left">
                    <span className="text-[10px] font-mono text-[#737D89] block">GIÁ HOÀN THIỆN</span>
                    <span className="text-base font-mono font-bold text-white">
                      {formatVND(product.price)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handleQuickAdd(product, e)}
                    className={`min-h-[38px] px-3.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#EB4037] ${
                      isAdded
                        ? 'bg-emerald-600 text-white'
                        : 'bg-white/[0.05] hover:bg-[#EB4037] text-white border border-white/[0.08] hover:border-[#EB4037]'
                    }`}
                    aria-label={`Thêm ${product.title} vào giỏ`}
                  >
                    {isAdded ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Đã thêm</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>Thêm</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* 3D Model Modal */}
      <Product3DModal product={modalProduct} onClose={() => setModalProduct(null)} />
    </section>
  );
};

export default HomeFeaturedProducts;

'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from '../common/ProductImage';
import Link from 'next/link';
import StudioIllustration from './StudioIllustration';
import { CatalogNotice } from '../products/CatalogNotice';
import { CompactProductCard } from '../products/CompactProductCard';
import type { CatalogData, ProductItem } from '../../contracts/catalog';
import { useCart } from '../../context/CartContext';
import { ShoppingBag, ArrowRight, Check } from 'lucide-react';
import { formatVND } from '../../lib/format';

export const HomeFeaturedProducts: React.FC<CatalogData> = ({ products, categories }) => {
  const { addToCart } = useCart();
  const [activeCategory, setActiveCategory] = useState('all');
  const [addedId, setAddedId] = useState<string | null>(null);

  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (addedTimer.current) clearTimeout(addedTimer.current);
  }, []);

  const filteredProducts = activeCategory === 'all'
    ? products
    : products.filter(p => p.categorySlug === activeCategory);

  const handleQuickAdd = (product: ProductItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!addToCart(product, 1)) return;
    setAddedId(product.id);
    if (addedTimer.current) clearTimeout(addedTimer.current);
    addedTimer.current = setTimeout(() => setAddedId(null), 1800);
  };

  // Sản phẩm tiêu điểm đầu tiên
  const leadProduct = filteredProducts[0];
  const gridProducts = filteredProducts.slice(1);
  const [leadImgIdx, setLeadImgIdx] = useState(0);
  const leadGallery = leadProduct?.gallery && leadProduct.gallery.length > 0 ? leadProduct.gallery : [leadProduct?.image];
  const currentLeadImg = leadGallery[leadImgIdx] || leadProduct?.image;

  return (
    <section id="showroom-san-pham" className="scroll-mt-24 py-12 sm:scroll-mt-28 sm:py-16 lg:py-20 px-4 sm:px-8 border-b border-white/[0.06] bg-transparent">
      <div className="max-w-6xl mx-auto w-full">
        
        {/* ============================================================== */}
        {/* SECTION HEADER — EDITORIAL CATALOGUE TITLE                     */}
        {/* ============================================================== */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 sm:mb-10">
          <div className="space-y-4 text-left max-w-2xl">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-[#F4F1EA] leading-[1.08]">
              Bộ sưu tập MinhLab.
            </h2>
          </div>

          <div className="flex w-full items-center justify-between gap-5 md:w-auto md:shrink-0 md:flex-col md:items-end">
            <StudioIllustration scene="collection" />
          <Link
            href="/bo-suu-tap"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-mono text-[#F4F1EA] hover:text-[#EB4037] transition-colors self-start md:self-end group py-2"
          >
            <span>XEM TOÀN BỘ BỘ SƯU TẬP</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          </div>
        </div>

        {/* ============================================================== */}
        {/* CATEGORY FILTER — MINIMALIST PILLS                            */}
        {/* ============================================================== */}
        <div className="flex items-center gap-2 pb-2 overflow-x-auto no-scrollbar mb-8 sm:mb-10">
          <div className="inline-flex items-center gap-1.5 p-1 rounded-full bg-white/[0.03] border border-white/[0.06]">
            {[{slug: 'all', name: 'Tất cả sản phẩm'}, ...categories].map((cat) => {
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
        {filteredProducts.length === 0 && <CatalogNotice state="empty" />}
        {leadProduct && (
          <div className="mb-8 hidden overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] transition-all duration-300 hover:border-white/[0.12] lg:mb-10 lg:grid lg:grid-cols-12">
            {/* Ảnh sản phẩm khổ lớn */}
            <div className="lg:col-span-7 relative aspect-[16/10] sm:aspect-[16/9] lg:aspect-auto w-full bg-[#090D12] overflow-hidden group min-h-[360px] sm:min-h-[460px] flex items-center justify-center">
              <Link
                href={`/bo-suu-tap?product=${encodeURIComponent(leadProduct.id)}`}
                className="absolute inset-0 z-[1] cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C8A261]"
                aria-label={`Xem chi tiết ${leadProduct.title}`}
              >
                <Image
                  src={currentLeadImg}
                  alt={leadProduct.title}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  className="object-contain p-4 sm:p-6 group-hover:scale-105 transition-all duration-500"
                />
              </Link>
              <div className="absolute inset-0 bg-gradient-to-t from-[#08090C] via-transparent to-transparent opacity-30 pointer-events-none" />

              {/* Tag góc trên & Nút 3D */}
              <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none">
                <span className="px-3 py-1 rounded-full bg-[#08090C]/80 backdrop-blur-md border border-white/[0.08] text-[11px] font-mono text-white">
                  {leadProduct.code || '—'}
                </span>

              </div>

              {/* Thanh chọn nhanh các góc chụp trong Gallery */}
              {leadGallery.length > 1 && (
                <div className="absolute bottom-4 left-4 right-4 flex items-center gap-2 overflow-x-auto no-scrollbar pointer-events-auto z-10 py-1">
                  {leadGallery.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setLeadImgIdx(idx)}
                      className={`relative w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 transition-all active:scale-95 ${
                        leadImgIdx === idx
                          ? 'border-[#EB4037] shadow-[0_0_12px_rgba(235,64,55,0.5)] scale-105'
                          : 'border-white/20 opacity-70 hover:opacity-100 hover:border-white/50'
                      }`}
                      title={`Xem góc chụp ${idx + 1}`}
                      aria-label={`Xem góc chụp ${idx + 1}`}
                    >
                      <Image
                        src={img}
                        alt={`${leadProduct.title} - Góc ${idx + 1}`}
                        fill
                        sizes="48px"
                        className="object-contain p-0.5"
                      />
                    </button>
                  ))}
                  <span className="text-[10px] font-mono text-white/70 bg-[#08090C]/80 px-2 py-1 rounded-md backdrop-blur-sm border border-white/10 shrink-0 ml-auto">
                    {leadImgIdx + 1} / {leadGallery.length} GÓC
                  </span>
                </div>
              )}
            </div>

            {/* Bảng thông số kỹ thuật & Đặt hàng */}
            <div className="lg:col-span-5 p-6 sm:p-8 lg:p-10 flex flex-col justify-between text-left space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-mono text-[#C8A261]">
                  <span>{leadProduct.category}</span>
                  {leadProduct.badge && leadProduct.badge !== leadProduct.category && <><span>•</span><span>{leadProduct.badge}</span></>}
                </div>

                    <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight leading-snug">
                      <Link
                        href={`/bo-suu-tap?product=${encodeURIComponent(leadProduct.id)}`}
                        className="rounded-sm transition-colors hover:text-[#EB4037] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C8A261]"
                      >
                        {leadProduct.title}
                      </Link>
                </h3>

                <p className="text-xs sm:text-sm text-[#A5ADB8] leading-relaxed">
                  {leadProduct.description}
                </p>

                {/* Spec Sheet thu nhỏ phong cách Analogue */}
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-white/[0.06] text-xs font-mono">
                  <div>
                    <span className="text-[#737D89] block text-[11px]">ĐỘ PHÂN GIẢI</span>
                    <span className="text-[#F4F1EA] font-semibold">{leadProduct.layerHeight || '—'}</span>
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
                    <span className="text-[#F4F1EA] font-semibold">{leadProduct.printTime || '—'}</span>
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
                  disabled={!leadProduct.inStock}
                  onClick={(e) => handleQuickAdd(leadProduct, e)}
                  className={`disabled:opacity-40 disabled:cursor-not-allowed min-h-[46px] px-6 rounded-full text-xs font-semibold flex items-center gap-2 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white ${
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
        <div data-testid="home-products-grid" className="grid grid-cols-2 gap-3 sm:gap-4 lg:hidden">
          {filteredProducts.map((product, index) => (
            <CompactProductCard key={product.id} product={product} priority={index < 2} />
          ))}
        </div>

        <div className="hidden gap-8 lg:grid lg:grid-cols-3">
          {gridProducts.map((product) => {
            const isAdded = addedId === product.id;

            return (
              <div
                key={product.id}
                className="group rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.14] transition-all duration-300 overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Image Container with Badges */}
                  <div className="relative aspect-square w-full bg-[#07090D] overflow-hidden flex items-center justify-center">
                    {/* Phông nền hòa sắc Ambient Blur mờ nhẹ */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                      <Image
                        src={product.image}
                        alt=""
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        className="object-cover blur-2xl opacity-20 scale-125"
                        aria-hidden="true"
                      />
                      <div className="absolute inset-0 bg-[#07090D]/75" />
                    </div>

                    <Image
                      src={product.image}
                      alt={product.title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-contain p-2 group-hover:scale-105 transition-transform duration-500 relative z-10 drop-shadow-[0_8px_16px_rgba(0,0,0,0.35)]"
                    />
                    <Link
                      href={`/bo-suu-tap?product=${encodeURIComponent(product.id)}`}
                      className="absolute inset-0 z-20 rounded-t-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C8A261]"
                      aria-label={`Xem chi tiết ${product.title}`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#08090C] via-transparent to-transparent opacity-30 pointer-events-none z-10" />

                    {/* Top Badges */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-full bg-[#08090C]/80 backdrop-blur-md border border-white/[0.08] text-[10px] font-mono text-[#D1D5DB]">
                        {product.code || product.category}
                      </span>

                    </div>
                  </div>

                  {/* Card Content */}
                  <div className="p-5 space-y-3 text-left">
                    <h3 className="text-base font-bold text-[#F4F1EA] group-hover:text-white transition-colors line-clamp-1">
                      <Link
                        href={`/bo-suu-tap?product=${encodeURIComponent(product.id)}`}
                        className="rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C8A261]"
                      >
                        {product.title}
                      </Link>
                    </h3>
                    <p className="text-xs text-[#A5ADB8] line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>

                    {/* Quick Specs */}
                    <div className="flex items-center gap-2.5 text-[11px] font-mono text-[#737D89] pt-2 border-t border-white/[0.06]">
                      <span>{product.layerHeight || '—'}</span>
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
                    disabled={!product.inStock}
                  onClick={(e) => handleQuickAdd(product, e)}
                    className={`disabled:opacity-40 disabled:cursor-not-allowed min-h-[38px] px-3.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#EB4037] ${
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
    </section>
  );
};

export default HomeFeaturedProducts;

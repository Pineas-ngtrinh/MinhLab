'use client';

import React, { useCallback, useState } from 'react';
import Image from '../common/ProductImage';
import { ProductDetailModal } from './ProductDetailModal';
import { CatalogNotice } from './CatalogNotice';
import { CompactProductCard } from './CompactProductCard';
import { formatVND } from '../../lib/format';
import type { CatalogData, ProductItem } from '../../contracts/catalog';
import { productAvailability, productBadge } from '../../lib/catalog';
import { useCart } from '../../context/CartContext';
import { ShoppingBag, CheckCircle2, ArrowRight, Layers } from 'lucide-react';

export const ProductGallery: React.FC<CatalogData> = ({ products, categories }) => {
  const { addToCart } = useCart();

  // Trạng thái danh mục đang chọn
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // Sản phẩm đang mở trong Modal chi tiết (Quick View / Spec Sheet)
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);


  React.useEffect(() => {
    const productId = new URLSearchParams(window.location.search).get('product');
    if (!productId) return;

    const product = products.find((item) => item.id === productId);
    if (product) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronizes browser, WebGL or remote API state after mount; keep SSR hydration deterministic.
      setSelectedProduct(product);

    }
  }, [products]);

  // Lọc sản phẩm theo tab đang chọn
  const filteredProducts = activeCategory === 'all'
    ? products
    : products.filter((p) => p.categorySlug === activeCategory);

  // Sản phẩm nổi bật đầu tiên & danh sách còn lại
  const featuredProduct = filteredProducts[0];
  const secondaryProducts = filteredProducts.slice(1);

  // Mở modal xem chi tiết sản phẩm
  const handleOpenDetail = (product: ProductItem) => {
    setSelectedProduct(product);

  };

  const handleCloseDetail = useCallback(() => {
    setSelectedProduct(null);


    const currentUrl = new URL(window.location.href);
    if (currentUrl.searchParams.has('product')) {
      currentUrl.searchParams.delete('product');
      window.history.replaceState(
        window.history.state,
        '',
        `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`,
      );
    }
  }, []);

  const getProductBadge = productBadge;
  const getProductAvailability = productAvailability;


  return (
    <section
      id="bo-suu-tap"
      className="pt-4 sm:pt-6 pb-16 sm:pb-20 px-4 sm:px-8 bg-transparent relative w-full max-w-full overflow-hidden"
      aria-label="Bộ sưu tập sản phẩm in 3D MinhLab"
    >
      <div className="max-w-7xl mx-auto w-full">

        {/* ============================================================== */}
        {/* DÒNG CHUYỂN TIẾP TỪ XƯỞNG (PRODUCT REVEAL CONNECTION)           */}
        {/* ============================================================== */}
        <div className="flex items-center gap-2.5 mb-4 text-xs font-mono text-[#A5ADB8]">
          <span className="w-2 h-2 rounded-full bg-[#C8A261]" />
          <span>Xem tình trạng đặt hàng và thời gian hoàn thiện trong thông tin từng mẫu</span>
        </div>

        {/* Tiêu đề & Giới thiệu Bộ Sưu Tập */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6 sm:mb-8">
          <div className="max-w-2xl space-y-2 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-[#141A21] border border-[#27313C] text-[11px] font-mono tracking-wider text-[#A5ADB8] uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-[#EB4037]" />
              <span>BỘ SƯU TẬP TẠI XƯỞNG · MINHLAB 3D</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-bold text-[#F4F1EA] tracking-tight leading-tight">
              Những sản phẩm bước ra từ xưởng MinhLab.
            </h1>

            <p className="text-sm sm:text-base text-[#A5ADB8] leading-relaxed">
              Mô hình và phụ kiện được MinhLab chế tác, kiểm tra từng chi tiết và hoàn thiện thủ công.
            </p>
          </div>

          {/* Quy chuẩn hoàn thiện xưởng */}
          <div className="hidden lg:flex items-center gap-4 text-xs font-mono text-[#737D89] pb-2">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#6F9576]" />
              Resin 0.05mm · PETG 0.16mm
            </span>
            <span>·</span>
            <span>Khử bavia thủ công</span>
            <span>·</span>
            <span>Đối chiếu tỷ lệ gốc</span>
          </div>
        </div>

        {/* Thanh Tabs Lọc Danh Mục (Pill tags phong cách Dark Studio) */}
        <div className="flex items-center gap-2 pb-3 overflow-x-auto no-scrollbar mb-6 sm:mb-8">
          {[{slug: 'all', name: 'Tất cả sản phẩm'}, ...categories].map((cat) => {
            const isActive = activeCategory === cat.slug;
            return (
              <button
                key={cat.slug}
                onClick={() => setActiveCategory(cat.slug)}
                className={`px-4 py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap shrink-0 flex items-center justify-center gap-1.5 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EB4037] ${
                  isActive
                    ? 'bg-[#EB4037]/15 text-[#EB4037] border border-[#EB4037]/40 shadow-subtle font-semibold'
                    : 'bg-[#141A21] hover:bg-[#1A222C] text-[#A5ADB8] hover:text-[#F4F1EA] border border-[#27313C]'
                }`}
                aria-pressed={isActive}
              >
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>

        {/* ============================================================== */}
        {/* SẢN PHẨM NỔI BẬT ĐẦU TIÊN: BỐ CỤC LỆCH TẦNG ASYMMETRIC         */}
        {/* ============================================================== */}
        {filteredProducts.length === 0 && <CatalogNotice state="empty" />}
        {featuredProduct && (
          <div className="mb-8 hidden rounded-2xl overflow-hidden bg-[#141A21] border border-[#27313C] hover:border-[#8492BD]/40 transition-all duration-300 sm:mb-10 sm:block">
            <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">

              {/* Ảnh Sản Phẩm Lớn (Chiếm ~60-65% desktop) */}
              <div
                className="lg:col-span-7 relative aspect-[4/3] lg:aspect-auto min-h-[320px] lg:min-h-[460px] bg-[#090D12] cursor-pointer group overflow-hidden flex items-center justify-center"
                onClick={() => handleOpenDetail(featuredProduct)}
              >
                <Image
                  src={featuredProduct.image}
                  alt={featuredProduct.title}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  className="object-contain p-4 sm:p-6 group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#141A21]/80 via-transparent to-transparent lg:hidden" />

                {/* Badges trên ảnh */}
                <div className="absolute top-4 left-4 flex items-center gap-2">
                  <span className="px-3 py-1 rounded-md bg-[#0B0F14]/85 backdrop-blur-md border border-[#27313C] text-xs font-mono text-[#F4F1EA] shadow-subtle flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#EB4037]" />
                    {getProductBadge(featuredProduct)}
                  </span>
                  {featuredProduct.code && (
                    <span className="hidden sm:inline-block px-2.5 py-1 rounded-md bg-[#0B0F14]/70 backdrop-blur-sm border border-[#27313C] text-[11px] font-mono text-[#A5ADB8]">
                      {featuredProduct.code}
                    </span>
                  )}
                </div>

                <div className="absolute bottom-4 left-4 hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#0B0F14]/85 backdrop-blur-md border border-white/10 text-xs font-mono text-[#A5ADB8]">
                  <Layers className="w-3.5 h-3.5 text-[#D48955]" />
                  <span>{featuredProduct.layerHeight || 'Thông số theo mẫu'} · Hoàn thiện thủ công</span>
                </div>
              </div>

              {/* Thông tin Chi Tiết Bên Cạnh (35-40% desktop) */}
              <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between space-y-6 text-left">
                <div className="space-y-4">

                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-[#8492BD] uppercase tracking-wider">
                      {featuredProduct.category}
                    </span>
                    <span className="text-xs font-mono text-[#6F9576] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {getProductAvailability(featuredProduct)}
                    </span>
                  </div>

                  <h3
                    onClick={() => handleOpenDetail(featuredProduct)}
                    className="text-2xl sm:text-3xl font-bold text-[#F4F1EA] hover:text-[#EB4037] transition-colors cursor-pointer leading-tight"
                  >
                    {featuredProduct.title}
                  </h3>

                  <p className="text-sm text-[#A5ADB8] leading-relaxed line-clamp-3">
                    {featuredProduct.description}
                  </p>

                  {/* Thông số kỹ thuật dạng pills */}
                  <div className="grid grid-cols-2 gap-2.5 pt-2">
                    <div className="p-3 rounded-lg bg-[#0F141A] border border-[#27313C] text-xs">
                      <span className="text-[10px] font-mono text-[#737D89] uppercase block mb-0.5">Vật liệu</span>
                      <span className="font-medium text-[#F4F1EA]">{featuredProduct.material || '—'}</span>
                    </div>
                    <div className="p-3 rounded-lg bg-[#0F141A] border border-[#27313C] text-xs">
                      <span className="text-[10px] font-mono text-[#737D89] uppercase block mb-0.5">Độ mịn layer</span>
                      <span className="font-mono text-[#F4F1EA]">{featuredProduct.layerHeight || '—'}</span>
                    </div>
                    <div className="p-3 rounded-lg bg-[#0F141A] border border-[#27313C] text-xs">
                      <span className="text-[10px] font-mono text-[#737D89] uppercase block mb-0.5">Thời gian in</span>
                      <span className="font-mono text-[#F4F1EA]">{featuredProduct.printTime || '—'}</span>
                    </div>
                    <div className="p-3 rounded-lg bg-[#0F141A] border border-[#27313C] text-xs">
                      <span className="text-[10px] font-mono text-[#737D89] uppercase block mb-0.5">Kích thước</span>
                      <span className="font-mono text-[#F4F1EA]">{featuredProduct.dimensions || '—'}</span>
                    </div>
                  </div>

                </div>

                {/* Giá & Nút Thao Tác */}
                <div className="pt-5 border-t border-[#27313C] space-y-4">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-[11px] font-mono text-[#737D89] block">Giá hoàn thiện</span>
                      <span className="text-2xl sm:text-3xl font-mono font-bold text-[#F4F1EA]">
                        {formatVND(featuredProduct.price)}
                      </span>
                    </div>
                    {featuredProduct.originalPrice && (
                      <span className="text-xs text-[#737D89] line-through font-mono">
                        {formatVND(featuredProduct.originalPrice)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleOpenDetail(featuredProduct)}
                      className="flex-1 py-3 px-4 rounded-lg bg-[#EB4037] hover:bg-[#FF5147] text-white font-medium text-sm transition-all flex items-center justify-center gap-2 shadow-subtle group min-h-[44px]"
                    >
                      <span>Xem chi tiết</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </button>

                    <button
                      type="button"
                      disabled={!featuredProduct.inStock}
                  onClick={() => addToCart(featuredProduct, 1)}
                      className="disabled:opacity-40 disabled:cursor-not-allowed p-3 rounded-lg bg-[#0F141A] hover:bg-[#1A222C] text-[#F4F1EA] border border-[#27313C] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="Thêm vào giỏ"
                      aria-label="Thêm vào giỏ"
                    >
                      <ShoppingBag className="w-4 h-4 text-[#A5ADB8]" />
                    </button>
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* CÁC SẢN PHẨM TIẾP THEO: GRID 2-3 CỘT SẮC CẠNH                   */}
        {/* ============================================================== */}
        <div className="grid grid-cols-2 gap-3 sm:hidden">
          {filteredProducts.map((product, index) => (
            <CompactProductCard key={product.id} product={product} priority={index < 2} onView={() => handleOpenDetail(product)} />
          ))}
        </div>

        <div className="hidden grid-cols-2 gap-3 sm:grid sm:gap-6 lg:grid-cols-3">
          {secondaryProducts.map((product) => {
            const badgeText = getProductBadge(product);

            return (
              <article
                key={product.id}
                className="group relative rounded-xl overflow-hidden bg-[#141A21] border border-[#27313C] hover:border-[#8492BD]/40 transition-all duration-300 flex flex-col justify-between"
              >
                {/* Khung Ảnh Sản Phẩm */}
                <button
                  type="button"
                  onClick={() => handleOpenDetail(product)}
                  className="relative aspect-square w-full overflow-hidden bg-[#07090D] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C8A261]"
                  aria-label={`Xem chi tiết ${product.title}`}
                >
                  {/* Phông nền hòa sắc Ambient Blur mờ nhẹ */}
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <Image
                      src={product.image}
                      alt=""
                      fill
                      sizes="(max-width: 1024px) 50vw, 33vw"
                      className="object-cover blur-2xl opacity-20 scale-125"
                      aria-hidden="true"
                    />
                    <div className="absolute inset-0 bg-[#07090D]/75" />
                  </div>

                  <Image
                    src={product.image}
                    alt={product.title}
                    fill
                    sizes="(max-width: 1024px) 50vw, 33vw"
                    className="object-contain p-2 group-hover:scale-105 transition-transform duration-500 relative z-10 drop-shadow-[0_8px_16px_rgba(0,0,0,0.35)]"
                  />

                  {/* Nhãn trạng thái */}
                  <div className="absolute top-3 left-3 flex items-center gap-1.5">
                    <span className="px-2.5 py-1 rounded-md bg-[#0B0F14]/85 backdrop-blur-sm border border-[#27313C] text-[11px] font-mono text-[#F4F1EA] shadow-subtle">
                      {badgeText}
                    </span>
                  </div>

                  {product.layerHeight && (
                    <div className="absolute top-3 right-3 px-2 py-1 rounded-md bg-[#0B0F14]/85 backdrop-blur-sm border border-[#27313C] text-[10px] font-mono text-[#A5ADB8]">
                      {product.layerHeight}
                    </div>
                  )}

                  {/* Dải thông số kỹ thuật xuất hiện khi hover */}
                  <div className="absolute bottom-0 inset-x-0 p-2.5 bg-[#0B0F14]/90 backdrop-blur-md border-t border-[#27313C] text-[11px] font-mono text-[#A5ADB8] flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <span>{product.material || '—'}</span>
                    <span>{product.printTime || '—'}</span>
                  </div>
                </button>

                {/* Thông tin Sản Phẩm */}
                <div className="p-3 sm:p-5 flex-1 flex flex-col justify-between space-y-4 text-left">
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-mono text-[#8492BD] uppercase tracking-wider block">
                      {product.category}
                    </span>

                    <h3 className="text-sm sm:text-base font-semibold text-[#F4F1EA] group-hover:text-[#EB4037] transition-colors line-clamp-2 leading-snug">
                      <button
                        type="button"
                        onClick={() => handleOpenDetail(product)}
                        className="text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C8A261]"
                      >
                        {product.title}
                      </button>
                    </h3>
                  </div>

                  <div className="pt-3 border-t border-[#27313C] flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                    <div>
                      <span className="text-sm sm:text-base font-mono font-bold text-[#F4F1EA]">
                        {formatVND(product.price)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenDetail(product)}
                      className="inline-flex min-h-11 items-center gap-1 text-xs font-mono text-[#A5ADB8] transition-colors hover:text-[#EB4037] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C8A261]"
                      aria-label={`Xem chi tiết ${product.title}`}
                    >
                      <span>Chi tiết</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>

                </div>
              </article>
            );
          })}
        </div>

      </div>

      {/* ============================================================== */}
      {/* QUICK VIEW / MODAL SPEC SHEET CHI TIẾT SẢN PHẨM               */}
      {/* ============================================================== */}
      {selectedProduct && <ProductDetailModal key={selectedProduct.id} product={selectedProduct} onClose={handleCloseDetail} />}

    </section>
  );
};

export default ProductGallery;

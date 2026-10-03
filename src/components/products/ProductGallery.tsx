'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { SITE_CONFIG, ProductItem } from '../../config/site.config';
import { useCart } from '../../context/CartContext';
import { X, ShoppingBag, CheckCircle2, ArrowRight, Layers, Sparkles } from 'lucide-react';

export const ProductGallery: React.FC = () => {
  const { addToCart, openCheckout } = useCart();
  
  // Trạng thái danh mục đang chọn
  const [activeCategory, setActiveCategory] = useState<string>('all');
  
  // Sản phẩm đang mở trong Modal chi tiết (Quick View / Spec Sheet)
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  
  // Màu sắc khách chọn trong Modal chi tiết
  const [selectedColor, setSelectedColor] = useState<string>('');

  // Định dạng tiền tệ VNĐ chuẩn
  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  // Lọc sản phẩm theo tab đang chọn
  const filteredProducts = activeCategory === 'all'
    ? SITE_CONFIG.products
    : SITE_CONFIG.products.filter((p) => p.categorySlug === activeCategory);

  // Sản phẩm nổi bật đầu tiên & danh sách còn lại
  const featuredProduct = filteredProducts[0];
  const secondaryProducts = filteredProducts.slice(1);

  // Mở modal xem chi tiết sản phẩm
  const handleOpenDetail = (product: ProductItem) => {
    setSelectedProduct(product);
    setSelectedColor(product.colors?.[0]?.name || '');
  };

  // Khóa cuộn trang nền và bắt phím Escape khi mở modal chi tiết sản phẩm
  React.useEffect(() => {
    if (!selectedProduct) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedProduct(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedProduct]);

  // Gán nhãn phù hợp cho sản phẩm
  const getProductBadge = (product: ProductItem) => {
    if (product.id === 'prod-mascot-monkey') return 'Phục dựng';
    if (product.id === 'prod-lab-diorama') return 'Độc bản';
    if (!product.inStock) return 'Nhận đặt trước';
    return 'Có sẵn';
  };

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
        <div className="flex items-center gap-2.5 mb-4 text-xs font-mono text-[#6F9576]">
          <span className="w-2 h-2 rounded-full bg-[#6F9576] animate-pulse" />
          <span>Sản phẩm vừa hoàn tất kiểm định tại xưởng · Sẵn sàng bàn giao</span>
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
              Những mẫu đồ chơi và phụ kiện khó tìm được MinhLab phục dựng bằng công nghệ in 3D và hoàn thiện thủ công.
            </p>
          </div>

          {/* Quy chuẩn hoàn thiện xưởng */}
          <div className="hidden lg:flex items-center gap-4 text-xs font-mono text-[#737D89] pb-2">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#6F9576]" />
              Độ mịn 0.12mm FDM
            </span>
            <span>·</span>
            <span>Khử bavia thủ công</span>
            <span>·</span>
            <span>Đối chiếu tỷ lệ gốc</span>
          </div>
        </div>

        {/* Thanh Tabs Lọc Danh Mục (Pill tags phong cách Dark Studio) */}
        <div className="flex items-center gap-2 pb-3 overflow-x-auto no-scrollbar mb-6 sm:mb-8">
          {SITE_CONFIG.categories.map((cat) => {
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
        {featuredProduct && (
          <div className="mb-8 sm:mb-10 rounded-2xl overflow-hidden bg-[#141A21] border border-[#27313C] hover:border-[#8492BD]/40 transition-all duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
              
              {/* Ảnh Sản Phẩm Lớn (Chiếm ~60-65% desktop) */}
              <div 
                className="lg:col-span-7 relative aspect-[4/3] lg:aspect-auto min-h-[320px] lg:min-h-[460px] bg-[#0F141A] cursor-pointer group overflow-hidden"
                onClick={() => handleOpenDetail(featuredProduct)}
              >
                <Image
                  src={featuredProduct.image}
                  alt={featuredProduct.title}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 60vw"
                  className="object-cover object-center group-hover:scale-[1.02] transition-transform duration-500"
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
                  <span>Vân in 0.12mm · Khử bavia thủ công</span>
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
                      {featuredProduct.inStock ? 'Có sẵn tại xưởng' : 'Nhận in theo yêu cầu'}
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
                      <span className="font-medium text-[#F4F1EA]">{featuredProduct.material || 'PLA Tough / PETG'}</span>
                    </div>
                    <div className="p-3 rounded-lg bg-[#0F141A] border border-[#27313C] text-xs">
                      <span className="text-[10px] font-mono text-[#737D89] uppercase block mb-0.5">Độ mịn layer</span>
                      <span className="font-mono text-[#F4F1EA]">{featuredProduct.layerHeight || '0.12 mm'}</span>
                    </div>
                    <div className="p-3 rounded-lg bg-[#0F141A] border border-[#27313C] text-xs">
                      <span className="text-[10px] font-mono text-[#737D89] uppercase block mb-0.5">Thời gian in</span>
                      <span className="font-mono text-[#F4F1EA]">{featuredProduct.printTime || '18h in + 4h xử lý'}</span>
                    </div>
                    <div className="p-3 rounded-lg bg-[#0F141A] border border-[#27313C] text-xs">
                      <span className="text-[10px] font-mono text-[#737D89] uppercase block mb-0.5">Kích thước</span>
                      <span className="font-mono text-[#F4F1EA]">{featuredProduct.dimensions || '14 × 12 × 18 cm'}</span>
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
                      onClick={() => addToCart(featuredProduct, 1)}
                      className="p-3 rounded-lg bg-[#0F141A] hover:bg-[#1A222C] text-[#F4F1EA] border border-[#27313C] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {secondaryProducts.map((product) => {
            const badgeText = getProductBadge(product);

            return (
              <div
                key={product.id}
                onClick={() => handleOpenDetail(product)}
                className="group relative rounded-xl overflow-hidden bg-[#141A21] border border-[#27313C] hover:border-[#8492BD]/40 transition-all duration-300 cursor-pointer flex flex-col justify-between"
              >
                {/* Khung Ảnh Sản Phẩm */}
                <div className="relative aspect-[4/3] overflow-hidden bg-[#0F141A]">
                  <Image
                    src={product.image}
                    alt={product.title}
                    fill
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    className="object-cover object-center group-hover:scale-[1.02] transition-transform duration-500"
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
                    <span>{product.material || 'PLA+'}</span>
                    <span>{product.printTime || '14h in'}</span>
                  </div>
                </div>

                {/* Thông tin Sản Phẩm */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4 text-left">
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-mono text-[#8492BD] uppercase tracking-wider block">
                      {product.category}
                    </span>

                    <h3 className="text-base font-semibold text-[#F4F1EA] group-hover:text-[#EB4037] transition-colors line-clamp-2 leading-snug">
                      {product.title}
                    </h3>
                  </div>

                  <div className="pt-3 border-t border-[#27313C] flex items-center justify-between">
                    <div>
                      <span className="text-base font-mono font-bold text-[#F4F1EA]">
                        {formatVND(product.price)}
                      </span>
                    </div>

                    <span className="text-xs text-[#A5ADB8] group-hover:text-[#EB4037] font-mono flex items-center gap-1 transition-colors">
                      <span>Chi tiết</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>

                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* ============================================================== */}
      {/* QUICK VIEW / MODAL SPEC SHEET CHI TIẾT SẢN PHẨM               */}
      {/* ============================================================== */}
      {selectedProduct && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-label={selectedProduct.title}
          onWheel={(e) => e.stopPropagation()}
        >
          {/* Backdrop mờ chuyên dụng: Click ra ngoài lập tức đóng modal */}
          <div
            className="fixed inset-0 bg-black/85 backdrop-blur-md transition-opacity cursor-pointer"
            aria-hidden="true"
            onClick={() => setSelectedProduct(null)}
            onTouchMove={(e) => e.preventDefault()}
            onWheel={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          />

          {/* Hộp nội dung Modal Spec Sheet */}
          <div 
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
            className="relative z-10 bg-[#141A21] border border-[#27313C] rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-7 shadow-2xl space-y-5 text-[#F4F1EA] cursor-default"
          >
            
            {/* Nút Đóng Modal */}
            <button
              onClick={() => setSelectedProduct(null)}
              className="absolute top-4 right-4 p-2 rounded-lg bg-[#0F141A] hover:bg-[#1A222C] text-[#A5ADB8] hover:text-[#F4F1EA] border border-[#27313C] transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center"
              aria-label="Đóng modal chi tiết"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Ảnh Sản Phẩm */}
            <div className="relative aspect-video rounded-xl overflow-hidden bg-[#0F141A] border border-[#27313C]">
              <Image
                src={selectedProduct.image}
                alt={selectedProduct.title}
                fill
                className="object-cover"
              />
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <span className="px-2.5 py-1 rounded bg-[#0B0F14]/90 backdrop-blur-sm border border-[#27313C] text-xs font-mono text-[#F4F1EA]">
                  {getProductBadge(selectedProduct)}
                </span>
                {selectedProduct.code && (
                  <span className="px-2 py-0.5 rounded bg-[#0B0F14]/90 backdrop-blur-sm border border-[#27313C] text-[10px] font-mono text-[#A5ADB8]">
                    {selectedProduct.code}
                  </span>
                )}
              </div>
            </div>

            {/* Tiêu Đề & Giá */}
            <div className="space-y-1.5 text-left">
              <span className="text-xs font-mono text-[#8492BD] uppercase tracking-wider">
                {selectedProduct.category}
              </span>
              <h3 className="text-xl sm:text-2xl font-bold text-[#F4F1EA]">
                {selectedProduct.title}
              </h3>
              
              <div className="flex items-baseline gap-3 pt-1">
                <span className="text-2xl font-mono font-bold text-[#F4F1EA]">
                  {formatVND(selectedProduct.price)}
                </span>
                {selectedProduct.originalPrice && (
                  <span className="text-sm text-[#737D89] line-through font-mono">
                    {formatVND(selectedProduct.originalPrice)}
                  </span>
                )}
              </div>
            </div>

            {/* Tùy Chọn Phối Màu */}
            {selectedProduct.colors && selectedProduct.colors.length > 0 && (
              <div className="space-y-2 text-left">
                <label className="block text-xs font-mono text-[#737D89] uppercase tracking-wider">
                  Tùy chọn phối màu ({selectedColor || 'Mặc định'})
                </label>
                <div className="flex flex-wrap gap-2">
                  {selectedProduct.colors.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setSelectedColor(c.name)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all min-h-[38px] ${
                        selectedColor === c.name
                          ? 'border-[#EB4037] bg-[#EB4037]/15 text-[#F4F1EA]'
                          : 'border-[#27313C] bg-[#0F141A] text-[#A5ADB8] hover:text-[#F4F1EA]'
                      }`}
                    >
                      <span
                        className="w-3 h-3 rounded-full border border-white/20 shrink-0"
                        style={{ backgroundColor: c.hex }}
                      />
                      <span>{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Mô tả chi tiết */}
            <p className="text-sm text-[#A5ADB8] leading-relaxed text-left">
              {selectedProduct.longDescription || selectedProduct.description}
            </p>

            {/* Bảng Thông Số Kỹ Thuật (Spec Sheet) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-[#0F141A] border border-[#27313C] text-xs text-left">
              <div>
                <span className="text-[#737D89] block text-[10px] font-mono uppercase">Vật liệu đùn:</span>
                <span className="font-medium text-[#F4F1EA]">{selectedProduct.material}</span>
              </div>
              <div>
                <span className="text-[#737D89] block text-[10px] font-mono uppercase">Độ phân giải:</span>
                <span className="font-mono text-[#F4F1EA]">{selectedProduct.layerHeight || '0.12 mm'}</span>
              </div>
              <div>
                <span className="text-[#737D89] block text-[10px] font-mono uppercase">Kích thước:</span>
                <span className="font-mono text-[#F4F1EA]">{selectedProduct.dimensions || 'Tiêu chuẩn'}</span>
              </div>
              <div>
                <span className="text-[#737D89] block text-[10px] font-mono uppercase">Trọng lượng:</span>
                <span className="font-mono text-[#F4F1EA]">{selectedProduct.weight || '200g'}</span>
              </div>
              <div>
                <span className="text-[#737D89] block text-[10px] font-mono uppercase">Thời gian in:</span>
                <span className="font-mono text-[#F4F1EA]">{selectedProduct.printTime || '14 giờ'}</span>
              </div>
              <div>
                <span className="text-[#737D89] block text-[10px] font-mono uppercase">Tình trạng:</span>
                <span className="font-medium text-[#6F9576] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {selectedProduct.inStock ? 'Sẵn hàng tại xưởng' : 'Nhận in theo yêu cầu'}
                </span>
              </div>
            </div>

            {/* Cụm Nút Thao Tác Mua Hàng */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  addToCart(selectedProduct, 1, selectedColor);
                  setSelectedProduct(null);
                }}
                className="flex-1 py-3 px-5 rounded-lg bg-[#0F141A] hover:bg-[#1A222C] text-[#F4F1EA] font-medium text-sm border border-[#27313C] transition-colors flex items-center justify-center gap-2 min-h-[44px]"
              >
                <ShoppingBag className="w-4 h-4 text-[#A5ADB8]" />
                <span>Thêm vào giỏ hàng</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const prod = selectedProduct;
                  const col = selectedColor;
                  setSelectedProduct(null);
                  openCheckout({ product: prod, selectedColor: col });
                }}
                className="flex-1 py-3 px-6 rounded-lg bg-[#EB4037] hover:bg-[#FF5147] text-white font-medium text-sm shadow-subtle transition-colors flex items-center justify-center gap-2 min-h-[44px]"
              >
                <span>Đặt mua giao ngay</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </section>
  );
};

export default ProductGallery;

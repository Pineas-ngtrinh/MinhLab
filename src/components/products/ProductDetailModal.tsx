'use client';

import React, { useState } from 'react';
import { ModalDialog } from '../common/ModalDialog';
import { QuantityControl } from '../common/QuantityControl';
import Image from '../common/ProductImage';
import type { ProductItem } from '../../contracts/catalog';
import { productAvailability, productBadge, selectProductVariant } from '../../lib/catalog';
import { useCart } from '../../context/CartContext';
import { formatVND } from '../../lib/format';
import { X, ShoppingBag, CheckCircle2, ArrowRight, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';

interface ProductDetailModalProps {
  product: ProductItem;
  onClose: () => void;
}

export function ProductDetailModal({ product, onClose: handleCloseDetail }: ProductDetailModalProps) {
  const { addToCart, openCheckout } = useCart();
  const [modalImgIdx, setModalImgIdx] = useState(0);
  const [selectedColor, setSelectedColor] = useState(product.colors[0]?.name || '');
  const [quantity, setQuantity] = useState(1);
  const selectedProduct = selectProductVariant(product, selectedColor) ?? product;
  const currentGallery = selectedProduct.gallery?.length ? selectedProduct.gallery : [selectedProduct.image];
  const galleryCount = currentGallery.length;

  // Escape và khóa cuộn do ModalDialog quản lý; tại đây chỉ xử lý đổi ảnh.
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setModalImgIdx((prev) => (prev > 0 ? prev - 1 : galleryCount - 1));
      } else if (e.key === 'ArrowRight') {
        setModalImgIdx((prev) => (prev < galleryCount - 1 ? prev + 1 : 0));
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [galleryCount]);

  return (
    <ModalDialog title={`Chi tiết sản phẩm ${selectedProduct.title}`} onDismiss={handleCloseDetail}
      testId="product-spec-modal" className="items-end p-0 sm:items-center sm:p-6">
          {/* Hộp nội dung Modal Spec Sheet */}
          <div
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
            className="relative z-10 flex h-[calc(100dvh-0.5rem)] max-h-[calc(100dvh-0.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl rounded-b-none border border-[#27313C] bg-[#141A21] text-[#F4F1EA] shadow-2xl cursor-default sm:h-auto sm:max-h-[calc(100dvh-3rem)] sm:rounded-2xl"
          >

            {/* Thanh đóng ghim trên mobile để luôn thoát được khi cuộn nội dung */}
            <div className="relative z-30 flex h-14 shrink-0 items-center justify-between border-b border-[#27313C]/60 bg-[#141A21] px-4 lg:absolute lg:right-4 lg:top-4 lg:h-auto lg:border-0 lg:bg-transparent lg:p-0">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#8492BD] lg:sr-only">
                Chi tiết sản phẩm
              </span>
              <button
                type="button"
                onClick={handleCloseDetail}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#27313C] bg-[#0F141A] text-[#A5ADB8] transition-colors hover:bg-[#1A222C] hover:text-[#F4F1EA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261]"
                aria-label="Đóng chi tiết sản phẩm"
                title="Đóng chi tiết sản phẩm"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto overscroll-contain lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] lg:overflow-hidden">
            <div className="min-w-0 space-y-4 bg-[#141A21] p-3 sm:p-5 lg:min-h-0 lg:overflow-y-auto">
            <div className="space-y-1.5 px-1 pt-1 text-left lg:hidden">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#8492BD]">
                {selectedProduct.category}
              </span>
              <div className="flex items-start justify-between gap-3">
                <h3 className="min-w-0 text-base font-semibold leading-snug text-[#F4F1EA] line-clamp-2">
                  {selectedProduct.title}
                </h3>
                <div className="shrink-0 text-right">
                  <span className="block whitespace-nowrap text-sm font-mono font-bold text-[#F4F1EA]">
                    {formatVND(selectedProduct.price)}
                  </span>
                  {selectedProduct.originalPrice && (
                    <span className="block whitespace-nowrap text-[10px] font-mono text-[#737D89] line-through">
                      {formatVND(selectedProduct.originalPrice)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/* Ảnh Sản Phẩm & Gallery */}
            {(() => {
              const activeImg = currentGallery[modalImgIdx] || selectedProduct.image;

              return (
                <div className="space-y-3.5">
                  {/* Ô Trưng Bày Ảnh Độc Bản (Studio Display Stage) */}
                  <div className="relative mx-auto aspect-[4/3] w-full max-h-[55vh] lg:max-h-[min(62vh,560px)] rounded-xl overflow-hidden bg-[#07090D] border border-white/[0.08] flex items-center justify-center group/img">
                    <div className="relative z-10 w-full h-full flex items-center justify-center">
                      <Image
                        src={activeImg}
                        alt={selectedProduct.title}
                        fill
                        priority
                        sizes="(max-width: 1023px) 100vw, 55vw"
                        className="object-contain p-1 sm:p-2"
                      />
                    </div>
                    {galleryCount > 1 && (
                      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-0">
                        <Image
                          src={currentGallery[(modalImgIdx + 1) % galleryCount]}
                          alt=""
                          fill
                          loading="eager"
                          fetchPriority="low"
                          sizes="(max-width: 1023px) 100vw, 55vw"
                          className="object-contain"
                        />
                      </div>
                    )}

                    {/* Badges định danh góc trên trái */}
                    <div className="absolute top-3.5 left-3.5 z-20 flex items-center gap-2 pointer-events-none">
                      <span className="px-2.5 py-1 rounded-md bg-[#08090C]/85 backdrop-blur-md border border-white/[0.1] text-xs font-mono text-[#F4F1EA] shadow-lg flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#EB4037] animate-pulse" />
                        {productBadge(selectedProduct)}
                      </span>
                      {selectedProduct.code && (
                        <span className="px-2 py-0.5 rounded-md bg-[#08090C]/80 backdrop-blur-md border border-white/[0.08] text-[10px] font-mono text-[#A5ADB8]">
                          {selectedProduct.code}
                        </span>
                      )}
                    </div>

                    {/* Nút Xem Phóng To Full Resolution góc trên phải */}
                    <a
                      href={activeImg}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute top-3.5 right-3.5 z-20 p-2 rounded-lg bg-[#08090C]/80 hover:bg-[#EB4037] text-white/80 hover:text-white border border-white/[0.1] hover:border-[#EB4037] backdrop-blur-md transition-all duration-200 shadow-lg min-h-11 min-w-11 flex items-center justify-center"
                      title="Mở ảnh gốc độ phân giải cao"
                      aria-label="Mở ảnh gốc độ phân giải cao"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </a>

                    {/* Nút Điều hướng ảnh Trước / Sau (Next / Prev) */}
                    {currentGallery.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setModalImgIdx((prev) => (prev > 0 ? prev - 1 : currentGallery.length - 1));
                          }}
                          className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-[#08090C]/85 hover:bg-[#EB4037] text-white border border-white/[0.12] hover:border-[#EB4037] flex items-center justify-center backdrop-blur-md opacity-85 hover:opacity-100 sm:opacity-75 sm:hover:opacity-100 hover:scale-105 transition-all duration-200 active:scale-90 shadow-xl"
                          aria-label="Xem ảnh trước"
                          title="Ảnh trước"
                        >
                          <ChevronLeft className="w-5 h-5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setModalImgIdx((prev) => (prev < currentGallery.length - 1 ? prev + 1 : 0));
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-[#08090C]/85 hover:bg-[#EB4037] text-white border border-white/[0.12] hover:border-[#EB4037] flex items-center justify-center backdrop-blur-md opacity-85 hover:opacity-100 sm:opacity-75 sm:hover:opacity-100 hover:scale-105 transition-all duration-200 active:scale-90 shadow-xl"
                          aria-label="Xem ảnh kế tiếp"
                          title="Ảnh kế tiếp"
                        >
                          <ChevronRight className="w-5 h-5" />
                        </button>

                        {/* Chỉ số ảnh (Badge đếm số góc) góc dưới phải */}
                        <div className="absolute bottom-3 right-3 z-20 px-2.5 py-1 rounded-full bg-[#08090C]/85 backdrop-blur-md border border-white/[0.1] text-[11px] font-mono text-white/90 shadow-lg pointer-events-none">
                          {modalImgIdx + 1} / {currentGallery.length}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Thanh chọn nhanh góc chụp (Gallery Strip) */}
                  {currentGallery.length > 1 && (
                    <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1">
                      {currentGallery.map((img, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setModalImgIdx(idx)}
                          className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all duration-200 active:scale-95 bg-[#090D12] ${
                            modalImgIdx === idx
                              ? 'border-[#EB4037] ring-1 ring-[#EB4037]'
                              : 'border-white/10 opacity-70 hover:opacity-100 hover:border-white/30'
                          }`}
                          title={`Xem góc ảnh ${idx + 1}`}
                          aria-label={`Xem góc ảnh ${idx + 1}`}
                        >
                          <Image
                            src={img}
                            alt={`${selectedProduct.title} - Góc ${idx + 1}`}
                            fill
                            loading="eager"
                            fetchPriority="low"
                            sizes="64px"
                            className="object-contain p-1"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            <section aria-label="Thông số chế tác" className="rounded-xl border border-[#27313C] bg-[#0F141A] p-4 text-left">
              <h4 className="mb-3 text-xs font-mono uppercase tracking-wider text-[#8492BD]">Thông số chế tác</h4>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm leading-snug sm:grid-cols-3">
                <div className="min-w-0">
                  <dt className="text-[11px] font-mono uppercase text-[#8B95A1]">Vật liệu đùn</dt>
                  <dd className="mt-1 font-medium text-[#F4F1EA]">{selectedProduct.material}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[11px] font-mono uppercase text-[#8B95A1]">Độ phân giải</dt>
                  <dd className="mt-1 font-mono text-[#F4F1EA]">{selectedProduct.layerHeight || '—'}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[11px] font-mono uppercase text-[#8B95A1]">Kích thước</dt>
                  <dd className="mt-1 font-mono text-[#F4F1EA]">{selectedProduct.dimensions || '—'}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[11px] font-mono uppercase text-[#8B95A1]">Trọng lượng</dt>
                  <dd className="mt-1 font-mono text-[#F4F1EA]">{selectedProduct.weight || '—'}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[11px] font-mono uppercase text-[#8B95A1]">Thời gian in</dt>
                  <dd className="mt-1 font-mono text-[#F4F1EA]">{selectedProduct.printTime || '—'}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[11px] font-mono uppercase text-[#8B95A1]">Tình trạng</dt>
                  <dd className="mt-1 flex items-center gap-1 font-medium text-[#6F9576]">
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    {productAvailability(selectedProduct)}
                  </dd>
                </div>
              </dl>
            </section>
            </div>

            <div className="min-w-0 p-4 sm:p-7 lg:flex lg:min-h-0 lg:flex-col lg:justify-start lg:overflow-y-auto">
            <div className="space-y-5">
            {/* Tiêu Đề & Giá */}
            <div className="hidden space-y-1.5 text-left lg:block">
              <span className="text-sm font-mono text-[#8492BD] uppercase tracking-wider">
                {selectedProduct.category}
              </span>
              <h3 id="product-detail-title" className="text-2xl sm:text-3xl font-bold leading-tight text-[#F4F1EA]">
                {selectedProduct.title}
              </h3>

              <div className="flex items-baseline gap-3 pt-1">
                <span className="text-3xl font-mono font-bold text-[#F4F1EA]">
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
                <label className="block text-sm font-mono text-[#8B95A1] uppercase tracking-wider">
                  Tùy chọn phối màu ({selectedColor || 'Mặc định'})
                </label>
                <div className="flex flex-wrap gap-2">
                  {selectedProduct.colors.map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      onClick={() => setSelectedColor(c.name)}
                      aria-pressed={selectedColor === c.name}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-mono transition-all min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261] ${
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
            <p className="text-base text-[#B4BBC4] leading-7 text-left">
              {selectedProduct.longDescription || selectedProduct.description}
            </p>

            </div>

            <div className="hidden items-center justify-between gap-3 border-t border-[#27313C] px-5 pt-4 lg:flex">
              <span className="text-sm text-[#A5ADB8]">Số lượng</span>
              <QuantityControl value={quantity} onChange={setQuantity} label={selectedProduct.title} disabled={!selectedProduct.inStock} />
            </div>

            {/* Cụm Nút Thao Tác Mua Hàng */}
            <div className="mt-5 hidden flex-col gap-3 border-t border-white/[0.08] bg-[#141A21] px-5 pb-5 pt-4 lg:sticky lg:bottom-0 lg:mt-5 lg:flex lg:flex-row">
              <button
                type="button"
                disabled={!selectedProduct.inStock}
                onClick={() => {
                  if (addToCart(selectedProduct, quantity, selectedColor)) handleCloseDetail();
                }}
                className="disabled:opacity-40 disabled:cursor-not-allowed flex-1 py-3 px-3 rounded-lg bg-[#0F141A] hover:bg-[#1A222C] text-[#F4F1EA] font-medium text-base border border-[#27313C] transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap min-h-[48px]"
              >
                <ShoppingBag className="w-4 h-4 text-[#A5ADB8]" />
                <span>Thêm vào giỏ hàng</span>
              </button>

              <button
                type="button"
                disabled={!selectedProduct.inStock}
                onClick={() => {
                  const prod = selectedProduct;
                  const col = selectedColor;
                  handleCloseDetail();
                  openCheckout({ product: prod, selectedColor: col, quantity });
                }}
                className="disabled:opacity-40 disabled:cursor-not-allowed flex-1 py-3 px-4 rounded-lg bg-[#EB4037] hover:bg-[#FF5147] text-white font-medium text-base shadow-subtle transition-colors flex items-center justify-center gap-2 whitespace-nowrap min-h-[48px]"
              >
                <span>{!selectedProduct.inStock ? 'Tạm hết hàng' : selectedProduct.madeToOrder ? 'Đặt trước' : 'Mua ngay'}</span>
              </button>
            </div>

            </div>
            </div>

            {/* Thanh thao tác luôn nằm trong tầm ngón cái trên mobile */}
            <div className="z-30 shrink-0 space-y-3 border-t border-[#27313C] bg-[#141A21] px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] lg:hidden">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[#A5ADB8]">Số lượng</span>
                <QuantityControl value={quantity} onChange={setQuantity} label={selectedProduct.title} disabled={!selectedProduct.inStock} />
              </div>
              <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!selectedProduct.inStock}
                onClick={() => {
                  if (addToCart(selectedProduct, quantity, selectedColor)) handleCloseDetail();
                }}
                className="disabled:opacity-40 disabled:cursor-not-allowed inline-flex min-h-14 flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#27313C] bg-[#141A21] px-2 text-xs font-medium text-[#F4F1EA] transition-colors hover:border-[#8492BD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261]"
                aria-label={`Thêm ${selectedProduct.title} vào giỏ hàng`}
              >
                <ShoppingBag className="h-4 w-4 shrink-0 text-[#A5ADB8]" />
                <span>Thêm giỏ</span>
              </button>
              <button
                type="button"
                disabled={!selectedProduct.inStock}
                onClick={() => {
                  const prod = selectedProduct;
                  const col = selectedColor;
                  handleCloseDetail();
                  openCheckout({ product: prod, selectedColor: col, quantity });
                }}
                className="disabled:opacity-40 disabled:cursor-not-allowed inline-flex min-h-14 flex-[1.2] items-center justify-center gap-1.5 rounded-lg bg-[#EB4037] px-2 text-xs font-semibold text-white transition-colors hover:bg-[#FF5147] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261]"
              >
                <span className="flex min-w-0 flex-col items-start leading-tight">
                  <span>{!selectedProduct.inStock ? 'Tạm hết hàng' : selectedProduct.madeToOrder ? 'Đặt trước' : 'Mua ngay'}</span>
                  <span className="whitespace-nowrap text-[10px] font-medium opacity-90">{formatVND(selectedProduct.price * quantity)}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </button>
              </div>
            </div>
          </div>
    </ModalDialog>
  );
}

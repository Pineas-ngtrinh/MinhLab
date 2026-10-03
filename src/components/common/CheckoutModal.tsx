'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useCart, CartItem } from '../../context/CartContext';
import { SITE_CONFIG } from '../../config/site.config';
import {
  X,
  CheckCircle2,
  ShieldCheck,
  Truck,
  ArrowRight,
  MessageSquare,
  Clock,
  Copy,
  Check,
  QrCode,
  FileCheck,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

type CheckoutStep =
  | 'FORM'
  | 'VIETQR_PAYMENT'
  | 'VIETQR_DECLARE'
  | 'AWAITING_VERIFICATION'
  | 'PAYMENT_VERIFIED'
  | 'COD_CONFIRMED';

export const CheckoutModal: React.FC = () => {
  const {
    isCheckoutOpen,
    closeCheckout,
    items,
    directBuyProduct,
    clearCart,
  } = useCart();

  // Xác định danh sách sản phẩm cần thanh toán (Mua ngay hoặc từ giỏ)
  const checkoutItems: CartItem[] = directBuyProduct ? [directBuyProduct] : items;

  // Kiểm tra đơn có sản phẩm CUSTOM_PRINT không
  const isCustomPrintItem = (item: CartItem) => {
    const raw = item.product as { itemType?: string; categorySlug?: string };
    return raw.itemType === 'CUSTOM_PRINT' || raw.categorySlug === 'custom-print' || item.product.id.startsWith('custom-');
  };
  const hasCustomPrint = checkoutItems.some(isCustomPrintItem);

  // Tổng tiền hàng
  const subtotal = checkoutItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const shippingFee = subtotal >= 500000 ? 0 : 30000;
  const totalAmount = subtotal + shippingFee;

  // Bước hiện tại trong luồng
  const [currentStep, setCurrentStep] = useState<CheckoutStep>('FORM');

  // Thông tin khách hàng
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'VIETQR'>(
    hasCustomPrint ? 'VIETQR' : 'COD'
  );

  // Thông tin đơn hàng sau khi tạo từ Server
  const [orderId, setOrderId] = useState('');
  const [finalTotal, setFinalTotal] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Thông tin khai báo chuyển khoản
  const [transactionRef, setTransactionRef] = useState('');
  const [bankName, setBankName] = useState('Vietcombank');
  const [senderAccountName, setSenderAccountName] = useState('');
  const [paymentProofUrl, setPaymentProofUrl] = useState('');

  // Trạng thái copy text
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Khóa cuộn trang nền khi mở modal thanh toán
  React.useEffect(() => {
    if (!isCheckoutOpen) return;

    const originalBodyOverflow = document.body.style.overflow;
    const originalHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCheckout();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      document.documentElement.style.overflow = originalHtmlOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isCheckoutOpen, closeCheckout]);

  if (!isCheckoutOpen) return null;

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // 1. Gửi form đặt hàng ban đầu tới Server API
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!fullName.trim() || !email.trim() || !phone.trim() || !address.trim()) {
      setErrorMessage('Vui lòng điền đầy đủ Họ tên, Email, Số điện thoại và Địa chỉ nhận hàng.');
      return;
    }

    // Kiểm tra định dạng email cơ bản
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMessage('Email không hợp lệ. Vui lòng nhập đúng định dạng email để nhận biên nhận.');
      return;
    }

    if (hasCustomPrint && paymentMethod === 'COD') {
      setErrorMessage('Đơn hàng có sản phẩm in theo yêu cầu (CUSTOM_PRINT) bắt buộc thanh toán trước (VietQR).');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: fullName.trim(),
          customerEmail: email.trim(),
          customerPhone: phone.trim(),
          shippingAddress: address.trim(),
          customerNote: note.trim(),
          paymentMethod: paymentMethod,
          items: checkoutItems.map((item) => ({
            productId: item.product.id,
            itemType: isCustomPrintItem(item) ? 'CUSTOM_PRINT' : 'READY_PRODUCT',
            itemName: item.product.title,
            quantity: item.quantity,
            unitPrice: item.product.price,
            color: item.selectedColor,
            material: item.product.material,
          })),
        }),
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || 'Tạo đơn hàng thất bại.');
      }

      const createdOrderNumber = resData.data.orderNumber;
      const orderGrandTotal = resData.data.grandTotal;

      setOrderId(createdOrderNumber);
      setFinalTotal(orderGrandTotal);

      if (paymentMethod === 'COD') {
        // Nhánh B: COD -> Xong luôn, server tự gửi email xác nhận COD
        clearCart();
        setCurrentStep('COD_CONFIRMED');
      } else {
        // Nhánh A: VIETQR -> Chuyển sang màn hình quét mã QR & thông tin chuyển khoản
        setCurrentStep('VIETQR_PAYMENT');
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Lỗi hệ thống khi tạo đơn hàng.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Khai báo chuyển khoản tới Server API
  const handleDeclarePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!transactionRef.trim() || !bankName.trim() || !senderAccountName.trim()) {
      setErrorMessage('Vui lòng điền đầy đủ Mã giao dịch, Tên ngân hàng và Tên chủ tài khoản.');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/payments/declare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber: orderId,
          transactionReference: transactionRef.trim(),
          bankName: bankName.trim(),
          senderAccountName: senderAccountName.trim(),
          paymentProofUrl: paymentProofUrl.trim() || undefined,
        }),
      });

      const resData = await response.json();
      if (!response.ok || !resData.success) {
        throw new Error(resData.error || 'Khai báo chuyển khoản thất bại.');
      }

      // Khai báo thành công -> Xóa giỏ hàng và chuyển sang trạng thái ĐANG CHỜ XÁC NHẬN
      clearCart();
      setCurrentStep('AWAITING_VERIFICATION');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Lỗi khi gửi thông tin chuyển khoản.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Kiểm tra trạng thái đơn hàng (polling/recheck)
  const handleCheckStatus = async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/orders/${orderId}`);
      const data = await res.json();
      if (data.success && data.data.payment?.verificationStatus === 'VERIFIED') {
        setCurrentStep('PAYMENT_VERIFIED');
      }
    } catch {
      // ignore
    }
  };

  const handleClose = () => {
    closeCheckout();
    // Đặt lại state nếu đã xong
    if (['COD_CONFIRMED', 'PAYMENT_VERIFIED'].includes(currentStep)) {
      setCurrentStep('FORM');
    }
  };

  const zaloMessage = encodeURIComponent(
    `Xin chào MinhLab! Tôi vừa tạo đơn hàng [${orderId}]:\n` +
      checkoutItems.map((i) => `- ${i.product.title} x${i.quantity}`).join('\n') +
      `\nTổng tiền: ${formatVND(finalTotal)}\nKhách hàng: ${fullName} - SĐT: ${phone}`
  );

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
      onWheel={(e) => e.stopPropagation()}
    >
      {/* Backdrop mờ */}
      <div
        onClick={handleClose}
        onTouchMove={(e) => e.preventDefault()}
        onWheel={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        className="fixed inset-0 bg-black/80 backdrop-blur-xs transition-opacity cursor-pointer"
      />

      {/* Hộp thoại Modal (Dark Workshop Theme - Industrial Luxury) */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Xác Nhận Đặt Hàng"
        data-testid="checkout-modal"
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-2xl bg-[#141A21] border border-[#27313C] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-[#F4F1EA]"
      >
        {/* Header Modal */}
        <div className="flex items-center justify-between p-5 border-b border-[#27313C] bg-[#0F141A]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#EB4037] text-white flex items-center justify-center font-mono font-bold text-xs">
              ML
            </div>
            <div className="text-left">
              <h3 className="text-base sm:text-lg font-bold text-[#F4F1EA]">
                {currentStep === 'FORM' && 'Xác Nhận Đặt Hàng'}
                {currentStep === 'VIETQR_PAYMENT' && `Thanh Toán VietQR — Đơn ${orderId}`}
                {currentStep === 'VIETQR_DECLARE' && `Khai Báo Chuyển Khoản — Đơn ${orderId}`}
                {currentStep === 'AWAITING_VERIFICATION' && 'Đang Chờ Cửa Hàng Xác Nhận'}
                {currentStep === 'PAYMENT_VERIFIED' && 'Đã Xác Nhận Thanh Toán'}
                {currentStep === 'COD_CONFIRMED' && 'Đơn Hàng Đã Được Ghi Nhận'}
              </h3>
              <p className="text-xs text-[#A5ADB8]">
                {orderId ? `Mã tham chiếu: ${orderId}` : 'MinhLab FDM Workshop — Quy trình kiểm tra minh bạch'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-lg bg-[#141A21] hover:bg-[#1A222C] text-[#A5ADB8] hover:text-[#F4F1EA] border border-[#27313C] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nội dung bên trong Modal */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 text-left space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-lg bg-[#EB4037]/15 border border-[#EB4037]/40 flex items-start gap-2.5 text-xs text-[#EB4037]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ============================================================== */}
          {/* BƯỚC 1: FORM ĐẶT HÀNG BAN ĐẦU                                 */}
          {/* ============================================================== */}
          {currentStep === 'FORM' && (
            <form onSubmit={handleCreateOrder} className="space-y-6">
              {/* Tóm tắt sản phẩm đặt mua */}
              <div className="space-y-3">
                <h4 className="text-xs font-mono font-semibold text-[#8492BD] uppercase tracking-wider">
                  Sản phẩm đặt mua ({checkoutItems.length})
                </h4>
                <div className="divide-y divide-[#27313C] max-h-36 overflow-y-auto pr-1">
                  {checkoutItems.map((item) => (
                    <div key={`${item.product.id}-${item.selectedColor || ''}`} className="py-2.5 first:pt-0 flex items-center gap-3">
                      <div className="relative w-11 h-11 rounded-lg bg-[#0F141A] border border-[#27313C] overflow-hidden shrink-0">
                        <Image
                          src={item.product.image}
                          alt={item.product.title}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#F4F1EA] truncate">
                          {item.product.title}
                        </p>
                        <p className="text-[11px] text-[#737D89] font-mono">
                          {item.selectedColor ? `Màu: ${item.selectedColor}` : 'Mặc định'} · SL: {item.quantity}
                          {isCustomPrintItem(item) && (
                            <span className="ml-2 text-[#D48955] font-semibold">[In theo file]</span>
                          )}
                        </p>
                      </div>
                      <div className="text-xs font-mono font-bold text-[#F4F1EA] shrink-0">
                        {formatVND(item.product.price * item.quantity)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Thông tin nhận hàng */}
              <div className="space-y-3 pt-4 border-t border-[#27313C]">
                <h4 className="text-xs font-mono font-semibold text-[#8492BD] uppercase tracking-wider">
                  Thông tin giao hàng & Liên hệ
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="text-xs text-[#A5ADB8] block">Họ và tên người nhận *</label>
                    <input
                      type="text"
                      required
                      placeholder="Nguyễn Văn A"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#27313C] bg-[#0F141A] text-[#F4F1EA] placeholder-[#737D89] focus:outline-none focus:border-[#EB4037]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-[#A5ADB8] block">Địa chỉ Email (Nhận biên lai) *</label>
                    <input
                      type="email"
                      required
                      placeholder="email@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#27313C] bg-[#0F141A] text-[#F4F1EA] placeholder-[#737D89] focus:outline-none focus:border-[#EB4037]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="text-xs text-[#A5ADB8] block">Số điện thoại *</label>
                    <input
                      type="tel"
                      required
                      placeholder="09xx xxx xxx"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#27313C] bg-[#0F141A] text-[#F4F1EA] font-mono placeholder-[#737D89] focus:outline-none focus:border-[#EB4037]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs text-[#A5ADB8] block">Ghi chú giao hàng (Tùy chọn)</label>
                    <input
                      type="text"
                      placeholder="Giao giờ hành chính, gọi trước khi đến..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#27313C] bg-[#0F141A] text-[#F4F1EA] placeholder-[#737D89] focus:outline-none focus:border-[#EB4037]"
                    />
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <label className="text-xs text-[#A5ADB8] block">Địa chỉ chi tiết nhận hàng *</label>
                  <input
                    type="text"
                    required
                    placeholder="Số nhà, ngõ/đường, phường/xã, quận/huyện, tỉnh/thành phố..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#27313C] bg-[#0F141A] text-[#F4F1EA] placeholder-[#737D89] focus:outline-none focus:border-[#EB4037]"
                  />
                </div>
              </div>

              {/* Phương thức thanh toán */}
              <div className="space-y-2 pt-4 border-t border-[#27313C]">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono font-semibold text-[#8492BD] uppercase tracking-wider">
                    Phương thức thanh toán
                  </h4>
                  {hasCustomPrint && (
                    <span className="text-[11px] font-mono text-[#D48955] bg-[#D48955]/10 px-2 py-0.5 rounded border border-[#D48955]/30">
                      Có sản phẩm in theo file: Yêu cầu trả trước
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* Tùy chọn COD */}
                  <button
                    type="button"
                    disabled={hasCustomPrint}
                    onClick={() => setPaymentMethod('COD')}
                    className={`p-3 rounded-lg border text-left flex items-start gap-2.5 transition-all ${
                      hasCustomPrint
                        ? 'opacity-40 cursor-not-allowed border-[#27313C] bg-[#0F141A]'
                        : paymentMethod === 'COD'
                        ? 'border-[#EB4037] bg-[#EB4037]/10 font-semibold text-[#F4F1EA]'
                        : 'border-[#27313C] bg-[#0F141A] text-[#A5ADB8] hover:border-[#737D89]'
                    }`}
                  >
                    <Truck className="w-4 h-4 text-[#EB4037] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-[#F4F1EA]">Thanh toán khi nhận hàng (COD)</p>
                      <p className="text-[11px] text-[#737D89] mt-0.5">
                        {hasCustomPrint
                          ? 'Chỉ áp dụng cho sản phẩm có sẵn'
                          : 'Kiểm tra sản phẩm trước khi trả tiền'}
                      </p>
                    </div>
                  </button>

                  {/* Tùy chọn VietQR */}
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('VIETQR')}
                    className={`p-3 rounded-lg border text-left flex items-start gap-2.5 transition-all ${
                      paymentMethod === 'VIETQR'
                        ? 'border-[#EB4037] bg-[#EB4037]/10 font-semibold text-[#F4F1EA]'
                        : 'border-[#27313C] bg-[#0F141A] text-[#A5ADB8] hover:border-[#737D89]'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 text-[#6F9576] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-[#F4F1EA]">Chuyển khoản VietQR</p>
                      <p className="text-[11px] text-[#737D89] mt-0.5">Quét mã QR từ mọi ứng dụng ngân hàng</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Tổng tiền & Nút xác nhận */}
              <div className="pt-4 border-t border-[#27313C] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-left w-full sm:w-auto">
                  <div className="flex items-center gap-2 text-xs text-[#737D89]">
                    <span>Tổng thanh toán:</span>
                    {shippingFee === 0 && (
                      <span className="text-[10px] font-mono text-[#6F9576] bg-[#6F9576]/10 px-1.5 py-0.5 rounded border border-[#6F9576]/30">
                        FREESHIP
                      </span>
                    )}
                  </div>
                  <span className="text-xl font-mono font-bold text-[#EB4037]">
                    {formatVND(totalAmount)}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto py-3 px-7 rounded-lg bg-[#EB4037] hover:bg-[#FF5147] text-white font-medium text-sm shadow-subtle transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span>{isSubmitting ? 'Đang tạo đơn...' : 'Tiến hành đặt đơn'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* ============================================================== */}
          {/* BƯỚC 2: QUÉT MÃ VIETQR (NHÁNH A)                              */}
          {/* ============================================================== */}
          {currentStep === 'VIETQR_PAYMENT' && (
            <div className="space-y-5">
              <div className="p-3 rounded-lg bg-[#0F141A] border border-[#27313C] flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#6F9576]/15 text-[#6F9576] flex items-center justify-center shrink-0">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#F4F1EA]">Quét mã VietQR chuyển khoản</p>
                  <p className="text-[11px] text-[#A5ADB8]">
                    Vui lòng quét mã bên dưới hoặc chuyển khoản theo đúng nội dung để hệ thống đối soát.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-center">
                {/* Ảnh mã QR */}
                <div className="flex flex-col items-center justify-center p-4 rounded-xl bg-white text-black text-center shadow-lg border border-[#27313C]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://img.vietqr.io/image/970422-0908888999-compact2.png?amount=${finalTotal}&addInfo=${orderId}&accountName=MINHLAB%203D`}
                    alt="VietQR MinhLab 3D"
                    className="w-48 h-48 object-contain"
                  />
                  <span className="text-[11px] font-mono font-bold text-[#141A21] mt-2">
                    MINHLAB 3D · MB BANK
                  </span>
                </div>

                {/* Thông tin số tài khoản & nội dung */}
                <div className="space-y-3 text-xs font-mono">
                  <div className="p-3 rounded-lg bg-[#0F141A] border border-[#27313C] space-y-1">
                    <span className="text-[10px] text-[#737D89] block">NGÂN HÀNG:</span>
                    <span className="font-bold text-[#F4F1EA] text-sm">MB Bank (Quân Đội)</span>
                  </div>

                  <div className="p-3 rounded-lg bg-[#0F141A] border border-[#27313C] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-[#737D89] block">SỐ TÀI KHOẢN:</span>
                      <span className="font-bold text-[#F4F1EA] text-sm">0908 888 999</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('0908888999', 'stk')}
                      className="p-1.5 rounded bg-[#141A21] hover:bg-[#27313C] text-[#A5ADB8] border border-[#27313C]"
                      title="Sao chép số tài khoản"
                    >
                      {copiedField === 'stk' ? <Check className="w-4 h-4 text-[#6F9576]" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="p-3 rounded-lg bg-[#0F141A] border border-[#27313C] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-[#737D89] block">SỐ TIỀN CẦN CHUYỂN:</span>
                      <span className="font-bold text-[#EB4037] text-sm">{formatVND(finalTotal)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(finalTotal.toString(), 'amount')}
                      className="p-1.5 rounded bg-[#141A21] hover:bg-[#27313C] text-[#A5ADB8] border border-[#27313C]"
                      title="Sao chép số tiền"
                    >
                      {copiedField === 'amount' ? <Check className="w-4 h-4 text-[#6F9576]" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="p-3 rounded-lg bg-[#0F141A] border border-[#EB4037]/40 flex items-center justify-between bg-[#EB4037]/5">
                    <div>
                      <span className="text-[10px] text-[#EB4037] block font-bold">NỘI DUNG CHUYỂN KHOẢN (BẮT BUỘC):</span>
                      <span className="font-bold text-[#F4F1EA] text-base">{orderId}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(orderId, 'code')}
                      className="p-1.5 rounded bg-[#141A21] hover:bg-[#27313C] text-[#EB4037] border border-[#EB4037]/40"
                      title="Sao chép mã đơn"
                    >
                      {copiedField === 'code' ? <Check className="w-4 h-4 text-[#6F9576]" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Nút hành động */}
              <div className="pt-3 border-t border-[#27313C] flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep('VIETQR_DECLARE')}
                  className="flex-1 py-3 px-5 rounded-lg bg-[#EB4037] hover:bg-[#FF5147] text-white font-medium text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 shadow-subtle"
                >
                  <FileCheck className="w-4 h-4" />
                  <span>Tôi đã chuyển khoản → Khai báo mã giao dịch</span>
                </button>

                <button
                  type="button"
                  onClick={handleClose}
                  className="py-3 px-4 rounded-lg bg-[#0F141A] hover:bg-[#1A222C] text-[#A5ADB8] text-xs border border-[#27313C]"
                >
                  Đóng & Chuyển khoản sau
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* BƯỚC 3: FORM KHAI BÁO MÃ GIAO DỊCH                           */}
          {/* ============================================================== */}
          {currentStep === 'VIETQR_DECLARE' && (
            <form onSubmit={handleDeclarePayment} className="space-y-4 text-xs">
              <div className="p-3.5 rounded-lg bg-[#0F141A] border border-[#27313C] space-y-1">
                <p className="font-semibold text-[#F4F1EA]">Khai báo thông tin đối soát chuyển khoản</p>
                <p className="text-[11px] text-[#A5ADB8]">
                  Cung cấp mã tham chiếu ngân hàng để kế toán viên MinhLab xác minh tiền vào tài khoản nhanh nhất.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-[#A5ADB8] block">Mã giao dịch ngân hàng (Mã GD / FT / Mã tham chiếu) *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: FT240915998234, MB123456..."
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#27313C] bg-[#0F141A] text-[#F4F1EA] font-mono placeholder-[#737D89] focus:outline-none focus:border-[#EB4037]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[#A5ADB8] block">Ngân hàng của bạn *</label>
                  <input
                    type="text"
                    required
                    placeholder="Vietcombank, Techcombank, MB, VPBank..."
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#27313C] bg-[#0F141A] text-[#F4F1EA] placeholder-[#737D89] focus:outline-none focus:border-[#EB4037]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[#A5ADB8] block">Tên chủ tài khoản chuyển tiền *</label>
                  <input
                    type="text"
                    required
                    placeholder="NGUYEN VAN A"
                    value={senderAccountName}
                    onChange={(e) => setSenderAccountName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#27313C] bg-[#0F141A] text-[#F4F1EA] placeholder-[#737D89] focus:outline-none focus:border-[#EB4037]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[#A5ADB8] block">Liên kết ảnh chụp biên lai (Tùy chọn)</label>
                <input
                  type="url"
                  placeholder="https://imgur.com/... hoặc link ảnh biên lai"
                  value={paymentProofUrl}
                  onChange={(e) => setPaymentProofUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#27313C] bg-[#0F141A] text-[#F4F1EA] font-mono placeholder-[#737D89] focus:outline-none focus:border-[#EB4037]"
                />
              </div>

              <div className="pt-3 border-t border-[#27313C] flex gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentStep('VIETQR_PAYMENT')}
                  className="py-2.5 px-4 rounded-lg bg-[#0F141A] hover:bg-[#1A222C] text-[#A5ADB8] border border-[#27313C]"
                >
                  Quay lại xem mã QR
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 px-5 rounded-lg bg-[#EB4037] hover:bg-[#FF5147] text-white font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span>{isSubmitting ? 'Đang gửi thông tin...' : 'Xác nhận đã chuyển khoản'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}

          {/* ============================================================== */}
          {/* BƯỚC 4: ĐANG CHỜ CỬA HÀNG XÁC NHẬN (AWAITING VERIFICATION)     */}
          {/* ============================================================== */}
          {currentStep === 'AWAITING_VERIFICATION' && (
            <div className="py-4 flex flex-col items-center text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-[#D97706]/15 border border-[#D97706]/30 flex items-center justify-center text-[#D97706]">
                <Clock className="w-8 h-8 animate-pulse" />
              </div>

              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#D97706]/15 border border-[#D97706]/30 text-[#D97706] text-xs font-mono font-bold uppercase">
                  <span>Trạng thái: Đang chờ xác nhận thanh toán</span>
                </div>
                <h4 className="text-lg sm:text-xl font-bold text-[#F4F1EA]">
                  Đã ghi nhận thông tin chuyển khoản!
                </h4>
                <p className="text-xs sm:text-sm text-[#A5ADB8] max-w-md">
                  Thông tin đối soát của bạn đã được chuyển tới bộ phận kế toán. Hệ thống sẽ tự động gửi email xác nhận đặt hàng tới{' '}
                  <strong className="text-[#F4F1EA]">{email}</strong> ngay khi nhân viên kiểm tra tài khoản thực tế.
                </p>
              </div>

              {/* Tóm tắt đơn hàng */}
              <div className="w-full p-4 rounded-xl bg-[#0F141A] border border-[#27313C] text-xs font-mono space-y-2 text-left">
                <div className="flex justify-between text-[#F4F1EA]">
                  <span className="text-[#737D89]">Mã đơn hàng:</span>
                  <span className="font-bold text-[#EB4037]">{orderId}</span>
                </div>
                <div className="flex justify-between text-[#F4F1EA]">
                  <span className="text-[#737D89]">Mã tham chiếu:</span>
                  <span className="font-medium text-[#A5ADB8]">{transactionRef}</span>
                </div>
                <div className="flex justify-between text-[#F4F1EA]">
                  <span className="text-[#737D89]">Người nhận:</span>
                  <span className="font-medium">{fullName} ({phone})</span>
                </div>
                <div className="flex justify-between text-[#F4F1EA] pt-2 border-t border-[#27313C]">
                  <span className="font-bold">Tổng thanh toán:</span>
                  <span className="font-bold text-sm text-[#EB4037]">{formatVND(finalTotal)}</span>
                </div>
              </div>

              {/* Nút hành động */}
              <div className="flex flex-col sm:flex-row gap-2.5 w-full pt-2">
                <button
                  type="button"
                  onClick={handleCheckStatus}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-[#141A21] hover:bg-[#1A222C] text-[#F4F1EA] text-xs font-medium border border-[#27313C] transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Kiểm tra trạng thái duyệt</span>
                </button>

                <a
                  href={`https://zalo.me/${SITE_CONFIG.contact.zaloPhone.replace(/\s+/g, '')}?text=${zaloMessage}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-2.5 px-4 rounded-lg bg-[#EB4037] hover:bg-[#FF5147] text-white text-xs font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Nhắn Zalo hỗ trợ nhanh</span>
                </a>

                <button
                  type="button"
                  onClick={handleClose}
                  className="py-2.5 px-4 rounded-lg bg-[#0F141A] text-[#A5ADB8] hover:text-[#F4F1EA] text-xs border border-[#27313C]"
                >
                  Đóng
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* BƯỚC 5: ĐÃ XÁC NHẬN THANH TOÁN THÀNH CÔNG (VERIFIED)           */}
          {/* ============================================================== */}
          {currentStep === 'PAYMENT_VERIFIED' && (
            <div className="py-5 flex flex-col items-center text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-[#6F9576]/15 border border-[#6F9576]/30 flex items-center justify-center text-[#6F9576]">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#6F9576]/15 border border-[#6F9576]/30 text-[#6F9576] text-xs font-mono font-bold uppercase">
                  <span>Trạng thái: Đã xác nhận thanh toán (VERIFIED)</span>
                </div>
                <h4 className="text-xl font-bold text-[#F4F1EA]">
                  Thanh toán hoàn tất!
                </h4>
                <p className="text-xs sm:text-sm text-[#A5ADB8] max-w-md">
                  MinhLab 3D đã xác nhận nhận đủ số tiền {formatVND(finalTotal)}. Đơn hàng [{orderId}] đang được kỹ sư xưởng đưa vào hàng đợi đùn in FDM.
                </p>
              </div>

              <button
                type="button"
                onClick={handleClose}
                className="py-2.5 px-6 rounded-lg bg-[#EB4037] hover:bg-[#FF5147] text-white text-xs font-medium transition-colors"
              >
                Hoàn tất & Đóng
              </button>
            </div>
          )}

          {/* ============================================================== */}
          {/* BƯỚC 6: ĐƠN HÀNG COD ĐÃ ĐƯỢC XÁC NHẬN (NHÁNH B)                */}
          {/* ============================================================== */}
          {currentStep === 'COD_CONFIRMED' && (
            <div className="py-5 flex flex-col items-center text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-[#6F9576]/15 border border-[#6F9576]/30 flex items-center justify-center text-[#6F9576]">
                <Truck className="w-8 h-8" />
              </div>

              <div className="space-y-1.5">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#6F9576]/15 border border-[#6F9576]/30 text-[#6F9576] text-xs font-mono font-bold uppercase">
                  <span>Trạng thái: Đã xác nhận — Thanh toán khi nhận hàng (COD)</span>
                </div>
                <h4 className="text-lg sm:text-xl font-bold text-[#F4F1EA]">
                  Đơn hàng đã được xác nhận thành công!
                </h4>
                <p className="text-xs sm:text-sm text-[#A5ADB8] max-w-md">
                  MinhLab đang tiến hành đóng gói sản phẩm. Bạn sẽ thanh toán số tiền{' '}
                  <strong className="text-[#EB4037]">{formatVND(finalTotal)}</strong> trực tiếp cho nhân viên giao vận sau khi kiểm tra hàng.
                </p>
              </div>

              <div className="w-full p-4 rounded-xl bg-[#0F141A] border border-[#27313C] text-xs font-mono space-y-2 text-left">
                <div className="flex justify-between text-[#F4F1EA]">
                  <span className="text-[#737D89]">Mã đơn hàng:</span>
                  <span className="font-bold text-[#EB4037]">{orderId}</span>
                </div>
                <div className="flex justify-between text-[#F4F1EA]">
                  <span className="text-[#737D89]">Người nhận:</span>
                  <span className="font-medium">{fullName} ({phone})</span>
                </div>
                <div className="flex justify-between text-[#F4F1EA]">
                  <span className="text-[#737D89]">Địa chỉ:</span>
                  <span className="font-medium text-right truncate ml-4">{address}</span>
                </div>
                <div className="flex justify-between text-[#F4F1EA] pt-2 border-t border-[#27313C]">
                  <span className="font-bold">Tổng thanh toán COD:</span>
                  <span className="font-bold text-sm text-[#EB4037]">{formatVND(finalTotal)}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full pt-2">
                <a
                  href={`https://zalo.me/${SITE_CONFIG.contact.zaloPhone.replace(/\s+/g, '')}?text=${zaloMessage}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 px-4 rounded-lg bg-[#EB4037] hover:bg-[#FF5147] text-white text-xs sm:text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-subtle"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Nhắn Zalo xác nhận thêm</span>
                </a>

                <button
                  type="button"
                  onClick={handleClose}
                  className="py-3 px-5 rounded-lg bg-[#0F141A] hover:bg-[#1A222C] text-[#F4F1EA] text-xs sm:text-sm font-medium border border-[#27313C] transition-colors"
                >
                  Hoàn tất & Đóng
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckoutModal;

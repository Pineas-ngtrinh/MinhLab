'use client';

import Image from '../common/ProductImage';
import { QuantityControl } from '../common/QuantityControl';
import { formatVND } from '../../lib/format';
import { SITE_CONFIG } from '../../config/site.config';
import { CHECKOUT_CONTACT_FIELDS, type CheckoutContactField } from '../../lib/checkout-validation';

import { ShieldCheck, ArrowRight } from 'lucide-react';
import type { useCheckout } from './useCheckout';

interface CheckoutOrderFormProps {
  checkout: ReturnType<typeof useCheckout>;
}

export function CheckoutOrderForm({ checkout }: CheckoutOrderFormProps) {
  const {
    currentStep,
    handleCreateOrder,
    fieldErrors,
    showContactSummary,
    handleFieldBlur,
    checkoutItems,
    handleQuantityChange,
    isCustomPrintItem,
    fullName,
    setFullName,
    email,
    setEmail,
    phone,
    setPhone,
    note,
    setNote,
    address,
    setAddress,
    hasCustomPrint,
    shippingFee,
    totalAmount,
    isSubmitting,
  } = checkout;
  const inputClass = (field: CheckoutContactField) => `w-full rounded-lg border bg-[#0F141A] px-3.5 py-2.5 text-base text-[#F4F1EA] placeholder-[#8F99A6] focus:outline-none focus:ring-1 sm:text-sm ${fieldErrors[field]
    ? 'border-[#EB4037] focus:border-[#EB4037] focus:ring-[#EB4037]'
    : 'border-[#27313C] focus:border-[#C8A261] focus:ring-[#C8A261]'}`;
  const errorClass = 'text-xs leading-relaxed text-[#FFAAA3]';
  return (<>
{currentStep === 'FORM' && (
            <form noValidate onSubmit={handleCreateOrder} className="space-y-6">
              {/* Tóm tắt sản phẩm đặt mua */}
              <div className="space-y-3">
                <h4 className="text-xs font-mono font-semibold text-[#8492BD] uppercase tracking-wider">
                  Sản phẩm đặt mua ({checkoutItems.length})
                </h4>
                <div className="max-h-64 divide-y divide-[#27313C] overflow-y-auto pr-1">
                  {checkoutItems.map((item) => (
                    <div key={`${item.product.id}-${item.variantId ?? item.selectedColor ?? ''}`} className="grid grid-cols-[44px_minmax(0,1fr)] gap-x-3 gap-y-2 py-3 first:pt-0">
                      <div className="relative w-11 h-11 rounded-lg bg-[#090D12] border border-[#27313C] overflow-hidden shrink-0 flex items-center justify-center">
                        <Image
                          src={item.product.image}
                          alt={item.product.title}
                          fill
                          sizes="44px"
                          className="object-contain p-0.5"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[#F4F1EA] truncate">
                          {item.product.title}
                        </p>
                        <p className="text-[11px] text-[#737D89] font-mono">
                          {item.selectedColor ? `Màu: ${item.selectedColor}` : 'Mặc định'}
                          {isCustomPrintItem(item) && (
                            <span className="ml-2 text-[#D48955] font-semibold">[In theo file]</span>
                          )}
                        </p>
                      </div>
                      <div className="col-span-2 flex flex-wrap items-center justify-between gap-3">
                        <QuantityControl value={item.quantity} onChange={quantity => handleQuantityChange(item, quantity)}
                          label={item.product.title} disabled={isSubmitting} />
                        <span className="font-mono text-sm font-semibold tabular-nums text-[#F4F1EA]">{formatVND(item.product.price * item.quantity)}</span>
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

                {showContactSummary && (
                  <div data-checkout-validation tabIndex={-1} role="alert" aria-labelledby="checkout-validation-title"
                    className="rounded-lg border border-[#EB4037]/40 bg-[#EB4037]/[0.06] p-3.5 text-xs leading-relaxed text-[#FFC6C2] focus:outline-none focus:ring-2 focus:ring-[#C8A261]">
                    <p id="checkout-validation-title" className="font-semibold">{SITE_CONFIG.checkout.validation.summaryTitle}</p>
                    <ul className="mt-2 space-y-1.5">
                      {CHECKOUT_CONTACT_FIELDS.map(field => fieldErrors[field] && (
                        <li key={field}>
                          <a href={`#checkout-${field}`} onClick={event => {
                            event.preventDefault();
                            document.getElementById(`checkout-${field}`)?.focus();
                          }} className="rounded-sm underline underline-offset-4 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261]">
                            {fieldErrors[field]}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <label htmlFor="checkout-fullName" className="text-xs text-[#A5ADB8] block">Họ và tên người nhận *</label>
                    <input id="checkout-fullName" name="fullName" autoComplete="name" maxLength={120}
                      type="text"
                      required
                      placeholder="Nguyễn Văn A"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      onBlur={() => handleFieldBlur('fullName')}
                      aria-invalid={Boolean(fieldErrors.fullName)}
                      aria-describedby={fieldErrors.fullName ? 'checkout-fullName-error' : undefined}
                      className={inputClass('fullName')}
                    />
                    {fieldErrors.fullName && <p id="checkout-fullName-error" role={showContactSummary ? undefined : 'status'} className={errorClass}>{fieldErrors.fullName}</p>}
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="checkout-email" className="text-xs text-[#A5ADB8] block">Địa chỉ Email (Nhận biên lai) *</label>
                    <input id="checkout-email" name="email" autoComplete="email" maxLength={255}
                      type="email"
                      required
                      placeholder="email@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onBlur={() => handleFieldBlur('email')}
                      aria-invalid={Boolean(fieldErrors.email)}
                      aria-describedby={fieldErrors.email ? 'checkout-email-error' : undefined}
                      className={inputClass('email')}
                    />
                    {fieldErrors.email && <p id="checkout-email-error" role={showContactSummary ? undefined : 'status'} className={errorClass}>{fieldErrors.email}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <label htmlFor="checkout-phone" className="text-xs text-[#A5ADB8] block">Số điện thoại *</label>
                    <input id="checkout-phone" name="phone" autoComplete="tel" maxLength={20}
                      type="tel"
                      required
                      placeholder="09xx xxx xxx"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      onBlur={() => handleFieldBlur('phone')}
                      aria-invalid={Boolean(fieldErrors.phone)}
                      aria-describedby={fieldErrors.phone ? 'checkout-phone-error' : undefined}
                      className={`${inputClass('phone')} font-mono`}
                    />
                    {fieldErrors.phone && <p id="checkout-phone-error" role={showContactSummary ? undefined : 'status'} className={errorClass}>{fieldErrors.phone}</p>}
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="checkout-note" className="text-xs text-[#A5ADB8] block">Ghi chú giao hàng (Tùy chọn)</label>
                    <input id="checkout-note" name="note" autoComplete="off" maxLength={2000}
                      type="text"
                      placeholder="Giao giờ hành chính, gọi trước khi đến..."
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#27313C] bg-[#0F141A] text-[#F4F1EA] placeholder-[#737D89] focus:outline-none focus:border-[#EB4037] text-base sm:text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <label htmlFor="checkout-address" className="text-xs text-[#A5ADB8] block">Địa chỉ chi tiết nhận hàng *</label>
                  <input id="checkout-address" name="address" autoComplete="street-address" maxLength={255}
                    type="text"
                    required
                    placeholder="Số nhà, ngõ/đường, phường/xã, quận/huyện, tỉnh/thành phố..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    onBlur={() => handleFieldBlur('address')}
                    aria-invalid={Boolean(fieldErrors.address)}
                    aria-describedby={fieldErrors.address ? 'checkout-address-error' : undefined}
                    className={inputClass('address')}
                  />
                  {fieldErrors.address && <p id="checkout-address-error" role={showContactSummary ? undefined : 'status'} className={errorClass}>{fieldErrors.address}</p>}
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

                {!checkout.vietQrAvailable && <p role="status" className="text-xs leading-6 text-[#FFAAA3]">{checkout.loadingPaymentOptions ? 'Đang kiểm tra cấu hình QR…' : 'Thanh toán QR chưa sẵn sàng. Vui lòng liên hệ MinhLab trước khi đặt hàng.'}</p>}
                <div className="rounded-lg border border-[#EB4037]/50 bg-[#EB4037]/[0.07] p-3 text-xs flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-[#6F9576] shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-[#F4F1EA]">Chuyển khoản QR cá nhân</p>
                      <p className="mt-0.5 text-[11px] leading-5 text-[#A5ADB8]">Quét mã VietQR bằng ứng dụng ngân hàng. Đơn được xác nhận sau khi nhân viên đối soát giao dịch.</p>
                    </div>
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
                  disabled={isSubmitting || checkout.loadingPaymentOptions || !checkout.vietQrAvailable}
                  className="w-full sm:w-auto py-3 px-7 rounded-lg bg-[#EB4037] hover:bg-[#FF5147] text-white font-medium text-sm shadow-subtle transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span>{isSubmitting ? 'Đang tạo đơn...' : 'Tạo đơn và lấy mã QR'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          )}
  </>);
}

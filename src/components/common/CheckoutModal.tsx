'use client';

import React from 'react';

import { ModalDialog } from './ModalDialog';

import { X, AlertCircle } from 'lucide-react';
import { useCheckout } from '../checkout/useCheckout';
import { CheckoutOrderForm } from '../checkout/CheckoutOrderForm';
import { CheckoutPayment } from '../checkout/CheckoutPayment';
import { CheckoutConfirmation } from '../checkout/CheckoutConfirmation';
import { SITE_CONFIG } from '../../config/site.config';

export const CheckoutModal: React.FC = () => {
  const checkout = useCheckout();
  const {
    handleClose,
    currentStep,
    errorMessage,
  } = checkout;
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  React.useEffect(() => {
    if (checkout.isCheckoutOpen && currentStep !== 'FORM') titleRef.current?.focus();
  }, [currentStep, checkout.isCheckoutOpen]);
  if (!checkout.isCheckoutOpen) return null;
  const isPayment = currentStep === 'VIETQR_PAYMENT';
  const title = isPayment ? SITE_CONFIG.checkout.payment.title
    : currentStep === 'PAYMENT_VERIFIED' ? 'Đã xác nhận thanh toán'
    : 'Xác nhận đặt hàng';
  return ((
    <ModalDialog title={title} onDismiss={handleClose} className="items-center p-3 sm:p-6">
      {/* Hộp thoại Modal (Dark Workshop Theme - Industrial Luxury) */}
      <div
        data-testid="checkout-modal"
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        className="relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#27313C] bg-[#141A21] text-[#F4F1EA] sm:max-h-[calc(100dvh-3rem)]"
      >
        {/* Header Modal */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#27313C] bg-[#0F141A] p-4 sm:p-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#EB4037] text-xs font-bold text-white">
              ML
            </div>
            <div className="min-w-0 text-left">
              <h3 ref={titleRef} tabIndex={-1} className="text-base font-semibold text-[#F4F1EA] focus:outline-none sm:text-xl">{title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-[#A5ADB8]">
                {isPayment ? SITE_CONFIG.checkout.payment.description : 'MinhLab 3D · Thông tin đơn hàng'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Đóng thanh toán"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#A5ADB8] transition-colors hover:bg-[#1A222C] hover:text-[#F4F1EA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nội dung bên trong Modal */}
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 text-left sm:p-6">
          {errorMessage && (
            <div id="checkout-error" role="alert" className="p-3.5 rounded-lg bg-[#EB4037]/15 border border-[#EB4037]/40 flex items-start gap-2.5 text-xs text-[#EB4037]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <CheckoutOrderForm checkout={checkout} />
          <CheckoutPayment checkout={checkout} />
          <CheckoutConfirmation checkout={checkout} />
        </div>
      </div>
    </ModalDialog>
  ));
};

export default CheckoutModal;

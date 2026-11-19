'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Check, Clock3, Copy, RefreshCw, TriangleAlert } from 'lucide-react';
import { SITE_CONFIG } from '../../config/site.config';
import { formatVND } from '../../lib/format';
import type { useCheckout } from './useCheckout';

interface CheckoutPaymentProps {
  checkout: ReturnType<typeof useCheckout>;
}

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261] focus-visible:ring-offset-2 focus-visible:ring-offset-[#141A21]';

export function CheckoutPayment({ checkout }: CheckoutPaymentProps) {
  const [failedQr, setFailedQr] = useState<string | null>(null);
  const [qrAttempt, setQrAttempt] = useState(0);
  const {
    handleClose, currentStep, orderId, finalTotal, copyToClipboard, copiedField,
    receivingBank, trackingHref, handleCheckStatus, handleDeclarePayment, isCheckingPayment,
    isDeclaringPayment, hasDeclaredPayment, paymentNotice, isPaymentUnavailable,
  } = checkout;

  if (currentStep !== 'VIETQR_PAYMENT') return null;

  const copy = SITE_CONFIG.checkout.payment;
  const bank = receivingBank;
  if(!bank) return <div role="alert" className="space-y-4 text-sm text-[#A5ADB8]">
    <p>Đơn hàng chưa có thông tin tài khoản nhận được xác nhận. Vui lòng liên hệ xưởng trước khi chuyển tiền.</p>
    <button type="button" onClick={handleClose} className="min-h-11 px-4 text-[#C8A261] underline">Đóng thanh toán</button>
  </div>;
  const qrParams = new URLSearchParams({
    amount: String(finalTotal), addInfo: orderId, accountName: bank.accountName,
  });
  const qrUrl = `https://img.vietqr.io/image/${bank.bin}-${bank.accountNumber}-compact2.png?${qrParams}`;
  const qrKey = `${qrUrl}:${qrAttempt}`;
  const details = [
    { label: copy.bankLabel, value: bank.name },
    { label: copy.recipientLabel, value: bank.accountName },
    { label: copy.accountLabel, value: bank.accountNumber, field: 'account', text: bank.accountNumber },
    { label: copy.transferLabel, value: orderId, field: 'code', text: orderId },
  ];

  return (
    <section aria-label={copy.title} className="space-y-6 sm:space-y-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-[#A5ADB8]">{copy.amountLabel}</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-[#F4F1EA] sm:text-4xl">
            {formatVND(finalTotal)}
          </p>
        </div>
        <button type="button" onClick={() => void copyToClipboard(String(finalTotal), 'amount')}
          aria-label={copiedField === 'amount' ? copy.copiedLabel : `Sao chép ${copy.amountLabel.toLowerCase()}`}
          title={copiedField === 'amount' ? copy.copiedLabel : 'Sao chép số tiền'}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#35414E] text-[#A5ADB8] transition-colors hover:bg-[#1A222C] hover:text-[#F4F1EA] ${focusRing}`}>
          {copiedField === 'amount' ? <Check className="h-4 w-4 text-[#C8A261]" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>

      {!isPaymentUnavailable && (
        <div className="grid items-start gap-6 sm:grid-cols-[224px_minmax(0,1fr)] sm:gap-7">
          <div className="mx-auto w-full max-w-[256px] sm:max-w-none">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-white p-3">
              {failedQr === qrKey ? (
                <div className="space-y-3 p-2 text-center text-sm leading-relaxed text-[#27313C]" role="status">
                  <p>{copy.qrError}</p>
                  <button type="button" onClick={() => setQrAttempt(attempt => attempt + 1)}
                    className="min-h-11 rounded-lg border border-[#A5ADB8] px-3 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#27313C]">
                    {copy.retryQr}
                  </button>
                </div>
              ) : (
                <Image key={qrKey} src={qrUrl} alt={`Mã VietQR thanh toán đơn ${orderId}`}
                  width={256} height={256} unoptimized
                  onError={() => setFailedQr(qrKey)}
                  className="h-full w-full object-contain" />
              )}
            </div>
            <p className="mt-3 text-center text-xs leading-relaxed text-[#A5ADB8]">{copy.qrHint}</p>
          </div>

          <div className="min-w-0">
            <dl className="divide-y divide-[#27313C]">
              {details.map(detail => (
                <div key={detail.label} className="flex min-w-0 items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <dt className="text-xs text-[#A5ADB8]">{detail.label}</dt>
                    <dd className={`mt-1 break-words text-sm font-medium leading-relaxed text-[#F4F1EA] ${detail.field ? 'font-mono' : ''}`}>
                      {detail.value}
                    </dd>
                  </div>
                  {detail.field && detail.text && (
                    <button type="button" onClick={() => void copyToClipboard(detail.text, detail.field)}
                      aria-label={copiedField === detail.field ? copy.copiedLabel : `Sao chép ${detail.label.toLowerCase()}`}
                      title={copiedField === detail.field ? copy.copiedLabel : `Sao chép ${detail.label.toLowerCase()}`}
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[#A5ADB8] transition-colors hover:bg-[#1A222C] hover:text-[#F4F1EA] ${focusRing}`}>
                      {copiedField === detail.field ? <Check className="h-4 w-4 text-[#C8A261]" /> : <Copy className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-[#A5ADB8]">{copy.transferHint}</p>
          </div>
        </div>
      )}

      <div className="flex items-start gap-3 border-t border-[#27313C] pt-5" role="status" aria-live="polite" aria-atomic="true">
        {isPaymentUnavailable
          ? <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#C8A261]" />
          : <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[#C8A261]" />}
        <div className="space-y-1">
          <p className="text-sm font-medium text-[#F4F1EA]">{isPaymentUnavailable ? copy.unavailableTitle : copy.waitingTitle}</p>
          <p className="text-xs leading-relaxed text-[#A5ADB8]">{paymentNotice || copy.waitingDescription}</p>
        </div>
      </div>

      <div className="space-y-3">
        {!isPaymentUnavailable && (hasDeclaredPayment ? (
          <div role="status" aria-live="polite" className="rounded-lg border border-[#6F9576]/35 bg-[#6F9576]/10 px-4 py-3 text-sm text-[#C9D8C8]">
            Đã gửi khai báo cho MinhLab. Đơn vẫn chờ nhân viên đối soát; thao tác này chưa xác nhận tiền đã vào.
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs leading-relaxed text-[#A5ADB8]">Sau khi chuyển khoản, bấm nút này để báo MinhLab kiểm tra. Khai báo không đồng nghĩa thanh toán đã được xác nhận.</p>
            <button type="button" onClick={() => void handleDeclarePayment()} disabled={isDeclaringPayment}
              aria-busy={isDeclaringPayment}
              className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#EB4037] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#FF5147] disabled:cursor-wait disabled:opacity-60 ${focusRing}`}>
              {isDeclaringPayment ? <RefreshCw className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" /> : null}
              {isDeclaringPayment ? 'Đang gửi khai báo…' : 'Tôi đã chuyển khoản'}
            </button>
          </div>
        ))}
        <div className="grid gap-2.5 sm:grid-cols-2">
          <button type="button" onClick={() => void handleCheckStatus()} disabled={isCheckingPayment}
            aria-busy={isCheckingPayment}
            className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#35414E] px-4 py-3 text-sm font-medium text-[#F4F1EA] transition-colors hover:bg-[#1A222C] disabled:cursor-wait disabled:opacity-60 ${focusRing}`}>
            <RefreshCw className={`h-4 w-4 ${isCheckingPayment ? 'motion-safe:animate-spin' : ''}`} aria-hidden="true" />
            {isCheckingPayment ? copy.checkingAction : copy.checkAction}
          </button>
          {trackingHref && (
            <a href={trackingHref} className={`inline-flex min-h-12 items-center justify-center rounded-lg border border-[#35414E] px-4 py-3 text-sm font-medium text-[#F4F1EA] transition-colors hover:bg-[#1A222C] ${focusRing}`}>
              {copy.trackingAction}
            </a>
          )}
        </div>
        <div className="flex min-h-11 items-center justify-center">
          <button type="button" onClick={handleClose}
            className={`min-h-11 rounded-md px-3 text-xs text-[#A5ADB8] underline-offset-4 hover:text-[#F4F1EA] hover:underline ${focusRing}`}>
            {copy.closeAction}
          </button>
          <span className="sr-only" role="status">{copiedField ? copy.copiedLabel : ''}</span>
        </div>
      </div>
    </section>
  );
}

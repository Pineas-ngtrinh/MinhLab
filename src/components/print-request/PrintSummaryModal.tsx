'use client';

import type { ReactNode } from 'react';
import { Check, Copy, Mail, MessageCircle, Paperclip, X } from 'lucide-react';

import { ModalDialog } from '../common/ModalDialog';
import { formatVND } from '../../lib/format';
import type { usePrintRequest } from './usePrintRequest';
import { formatPrintDuration } from './print-request-settings';

interface PrintSummaryModalProps {
  model: ReturnType<typeof usePrintRequest>;
}

function SummaryField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 border-b border-[#27313C] py-3 last:border-b-0">
      <dt className="text-xs text-[#A5ADB8]">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-[#F4F1EA]">{value}</dd>
    </div>
  );
}

export function PrintSummaryModal({ model }: PrintSummaryModalProps) {
  const {
    showSummary,
    setShowSummary,
    selectedFile,
    fullName,
    phone,
    detectedDims,
    formatDimension,
    scaleValue,
    scaledDimensionsCm,
    material,
    color,
    layerHeight,
    infillPercent,
    quantity,
    purpose,
    notes,
    referenceQuote,
    quantityEstimate,
    handleCopy,
    copied,
    copyError,
    handleSendZalo,
    handleSendEmail,
  } = model;

  if (!showSummary) return null;

  const originalDimensions = detectedDims
    ? `${formatDimension(detectedDims.x)} × ${formatDimension(detectedDims.y)} × ${formatDimension(detectedDims.z)} mm`
    : 'Chưa xác định';
  const scaledDimensions = scaledDimensionsCm
    ? `${formatDimension(scaledDimensionsCm.x)} × ${formatDimension(scaledDimensionsCm.y)} × ${formatDimension(scaledDimensionsCm.z)} cm`
    : 'Chưa xác định';

  return (
    <ModalDialog
      title="Gửi yêu cầu cho xưởng"
      onDismiss={() => setShowSummary(false)}
      className="items-center p-4 sm:p-6"
    >
      <div className="relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#27313C] bg-[#141A21] text-left text-[#F4F1EA] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#27313C] px-5 py-5 sm:px-7">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Kiểm tra yêu cầu trước khi gửi</h2>
            <p className="mt-1 text-sm leading-relaxed text-[#A5ADB8]">
              Thợ cần file STL để mở và kiểm tra trực tiếp.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowSummary(false)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-[#27313C] bg-[#0F141A] text-[#A5ADB8] hover:text-[#F4F1EA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261]"
            aria-label="Đóng tóm tắt"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 space-y-5 overflow-y-auto px-5 py-5 sm:px-7">
          <div className="flex gap-3 rounded-xl border border-[#27313C] bg-[#0B0F14] p-4">
            <Paperclip className="mt-0.5 h-4 w-4 shrink-0 text-[#C8A261]" aria-hidden="true" />
            <div className="min-w-0 text-sm leading-relaxed">
              <p className="font-medium text-[#F4F1EA]">File vẫn ở trên thiết bị của bạn</p>
              <p className="mt-1 text-[#A5ADB8]">
                Bấm “Sao chép và mở Zalo” để chép tóm tắt và mở chat. Trong cuộc trò chuyện, hãy dán nội dung rồi đính kèm tệp STL{' '}
                <span className="break-all font-medium text-[#F4F1EA]">{selectedFile?.name ?? 'đã chọn'}</span> trước khi gửi. Tệp vẫn ở trên thiết bị nên không tự đính kèm.
              </p>
            </div>
          </div>

          <section aria-labelledby="summary-contact-heading">
            <h3 id="summary-contact-heading" className="text-sm font-semibold">Thông tin liên hệ và file</h3>
            <dl className="mt-1 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
              <SummaryField label="Người gửi" value={fullName || 'Chưa cung cấp'} />
              <SummaryField label="Điện thoại / Zalo" value={phone} />
              <SummaryField label="Tệp STL cần đính kèm" value={selectedFile ? `${selectedFile.name} · ${selectedFile.size}` : 'Chưa chọn tệp'} />
              <SummaryField label="Kích thước trong file (X × Y × Z)" value={originalDimensions} />
            </dl>
          </section>

          <section aria-labelledby="summary-print-heading" className="border-t border-[#27313C] pt-4">
            <h3 id="summary-print-heading" className="text-sm font-semibold">Thông số muốn in</h3>
            <dl className="mt-1 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
              <SummaryField label="Kích thước sau chỉnh tỷ lệ" value={scaledDimensions} />
              <SummaryField label="Tỷ lệ" value={`${scaleValue}%`} />
              <SummaryField label="Vật liệu" value={material} />
              <SummaryField label="Màu" value={color} />
              <SummaryField label="Chiều cao lớp" value={layerHeight} />
              <SummaryField label="Mật độ ruột" value={`${infillPercent}%`} />
              <SummaryField label="Số lượng" value={quantity} />
              <SummaryField label="Mục đích sử dụng" value={purpose} />
            </dl>
          </section>

          {referenceQuote?.status === 'ready' && (
            <section aria-labelledby="summary-price-heading" className="border-t border-[#27313C] pt-4">
              <h3 id="summary-price-heading" className="text-sm font-semibold">Ước tính trên trang</h3>
              <dl className="mt-1 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
                <SummaryField label="Một sản phẩm" value={formatVND(referenceQuote.referencePriceVnd)} />
                <SummaryField label="Nhựa ước tính / sản phẩm" value={`${referenceQuote.massG.toFixed(2)} g (gồm support/brim)`} />
                <SummaryField label="Thời gian in / sản phẩm" value={formatPrintDuration(referenceQuote.modelTimeHours)} />
                <SummaryField
                  label="Khoảng dự kiến"
                  value={`${formatVND(referenceQuote.lowPriceVnd)}–${formatVND(referenceQuote.highPriceVnd)}`}
                />
                {quantityEstimate && (
                  <SummaryField
                    label={`Tạm tính ${quantityEstimate.quantity} sản phẩm`}
                    value={`${formatVND(quantityEstimate.lowPriceVnd)}–${formatVND(quantityEstimate.highPriceVnd)}`}
                  />
                )}
              </dl>
              <p className="mt-2 text-xs leading-relaxed text-[#A5ADB8]">
                Đây là giá tham khảo. Xưởng sẽ xác nhận lại sau khi kiểm tra file.
              </p>
            </section>
          )}

          {notes.trim() && (
            <section aria-labelledby="summary-notes-heading" className="border-t border-[#27313C] pt-4">
              <h3 id="summary-notes-heading" className="text-sm font-semibold">Ghi chú cho xưởng</h3>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#A5ADB8]">{notes}</p>
            </section>
          )}
        </div>

        <div className="space-y-3 border-t border-[#27313C] px-5 py-5 sm:px-7">
          <p className="text-xs leading-relaxed text-[#A5ADB8]">
            Mình xác nhận có quyền sử dụng tệp này. Việc gửi yêu cầu chưa phải là xác nhận đặt in.
          </p>
          {copyError && <p role="alert" className="text-sm text-[#FF8179]">{copyError}</p>}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[auto_1fr_1fr]">
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#27313C] bg-[#0F141A] px-4 text-sm font-medium text-[#F4F1EA] transition-colors hover:bg-[#1A222C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261]"
            >
              {copied ? <Check className="h-4 w-4 text-[#6F9576]" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? 'Đã sao chép' : 'Sao chép nội dung'}</span>
            </button>
            <button
              type="button"
              onClick={handleSendZalo}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#EB4037] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#FF5147] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261]"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Sao chép và mở Zalo</span>
            </button>
            <button
              type="button"
              onClick={handleSendEmail}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#27313C] bg-[#0F141A] px-4 text-sm font-medium text-[#F4F1EA] transition-colors hover:bg-[#1A222C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261]"
            >
              <Mail className="h-4 w-4 text-[#A5ADB8]" />
              <span>Soạn email</span>
            </button>
          </div>
        </div>
      </div>
    </ModalDialog>
  );
}

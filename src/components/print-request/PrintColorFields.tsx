'use client';

import { PRINT_COLOR_OPTIONS } from '../../config/printing.config';

interface PrintColorFieldsProps {
  value: string;
  onChange: (color: string) => void;
}

export function PrintColorFields({ value, onChange }: PrintColorFieldsProps) {
  return (
    <fieldset className="space-y-3 text-left" aria-describedby="print-color-guidance">
      <legend className="text-sm font-medium text-[#F4F1EA]">Màu mô hình xem trước</legend>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3">
        {PRINT_COLOR_OPTIONS.map(option => (
          <button key={option.id} type="button" aria-pressed={value === option.label}
            onClick={() => onChange(option.label)}
            className={`flex min-h-11 items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261] ${value === option.label ? 'border-[#EB4037] bg-[#EB4037]/10 text-[#F4F1EA]' : 'border-[#27313C] bg-[#0F141A] text-[#A5ADB8] hover:border-[#A5ADB8]'}`}>
            <span aria-hidden="true" className="h-5 w-5 shrink-0 rounded-full border border-white/30" style={{ backgroundColor: option.previewHex }} />
            <span>{option.label}</span>
          </button>
        ))}
      </div>
      <p id="print-color-guidance" className="text-xs leading-relaxed text-[#A5ADB8]">Chọn màu để cập nhật mô hình và bản tóm tắt yêu cầu. Màu trên màn hình chỉ minh họa; xưởng xác nhận màu thực tế theo vật liệu. Hiệu ứng ánh lụa hoặc trong suốt chưa được mô phỏng.</p>
    </fieldset>
  );
}

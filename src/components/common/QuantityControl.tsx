'use client';

import { Minus, Plus } from 'lucide-react';

interface QuantityControlProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  disabled?: boolean;
}

export function QuantityControl({ value, onChange, label, disabled = false }: QuantityControlProps) {
  const buttonClass = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[#F4F1EA] transition-colors hover:bg-[#1A222C] disabled:cursor-not-allowed disabled:text-[#697583] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#C8A261]';

  return (
    <div role="group" aria-label={`Số lượng ${label}`}
      className="inline-flex shrink-0 items-center rounded-lg border border-[#35414E] bg-[#0F141A]">
      <button type="button" onClick={() => onChange(value - 1)} disabled={disabled || value <= 1}
        aria-label={`Giảm số lượng ${label}`} className={buttonClass}>
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <output aria-live="polite" aria-atomic="true" aria-label="Số lượng đã chọn"
        className="min-w-8 px-1 text-center font-mono text-sm font-medium tabular-nums text-[#F4F1EA]">
        {value}
      </output>
      <button type="button" onClick={() => onChange(value + 1)} disabled={disabled || value >= 100}
        aria-label={`Tăng số lượng ${label}`} className={buttonClass}>
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

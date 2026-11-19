'use client';

import type { ProductVariantInput } from '../../../contracts/catalog-admin';
import { INPUT, BUTTON, newVariant } from './product-form';

interface VariantEditorProps {
  variants: ProductVariantInput[];
  disabled: boolean;
  onChange: (variants: ProductVariantInput[]) => void;
}
export function VariantEditor({ variants, disabled, onChange }: VariantEditorProps) {
  const update = (index: number, patch: Partial<ProductVariantInput>) =>
    onChange(variants.map((value, i) => (i === index ? { ...value, ...patch } : value)));
  return (
    <fieldset disabled={disabled} className="space-y-4 border-t border-[#27313C] pt-6">
      <legend className="text-base font-semibold text-[#F4F1EA]">Biến thể và giá bán</legend>
      <p className="text-sm leading-6 text-[#A5ADB8]">
        Mỗi biến thể được cấp một mã riêng. Biến thể bỏ khỏi danh sách được ngừng bán; thông tin trong
        đơn cũ vẫn được giữ.
      </p>
      {variants.map((variant, index) => (
        <section
          key={variant.id ?? `new-${index}`}
          aria-label={`Biến thể ${index + 1}`}
          className="space-y-4 rounded-xl border border-[#27313C] p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Biến thể {index + 1}</h3>
            <button
              type="button"
              className={BUTTON}
              disabled={variants.length === 1}
              onClick={() => onChange(variants.filter((_, i) => i !== index))}
            >
              Bỏ biến thể {index + 1}
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="space-y-1 text-sm">
              Tên lựa chọn *
              <input
                className={INPUT}
                value={variant.name}
                required
                maxLength={160}
                onChange={(event) => update(index, { name: event.target.value })}
              />
            </label>
            <label className="space-y-1 text-sm">
              Tên màu
              <input
                className={INPUT}
                value={variant.color}
                maxLength={60}
                onChange={(event) => update(index, { color: event.target.value })}
              />
            </label>
            <label className="space-y-1 text-sm">
              Mã màu *
              <input
                className={INPUT}
                value={variant.hex}
                required
                pattern="#[0-9a-fA-F]{6}"
                onChange={(event) => update(index, { hex: event.target.value })}
              />
            </label>
            <label className="space-y-1 text-sm">
              Giá bán (đ) *
              <input
                type="number"
                className={INPUT}
                value={variant.price}
                required
                min={0}
                max={9999999999}
                step={1}
                onChange={(event) => update(index, { price: Number(event.target.value) })}
              />
            </label>
            <label className="space-y-1 text-sm">
              Giá niêm yết (đ)
              <input
                type="number"
                className={INPUT}
                value={variant.originalPrice ?? ''}
                min={variant.price}
                max={9999999999}
                step={1}
                onChange={(event) =>
                  update(index, {
                    originalPrice: event.target.value === '' ? null : Number(event.target.value),
                  })
                }
              />
            </label>
            <label className="space-y-1 text-sm">
              Tình trạng
              <select
                className={INPUT}
                value={variant.status}
                onChange={(event) =>
                  update(index, { status: event.target.value as ProductVariantInput['status'] })
                }
              >
                <option value="ACTIVE">Đang bán</option>
                <option value="OUT_OF_STOCK">Tạm hết hàng</option>
                <option value="INACTIVE">Ngừng bán</option>
              </select>
            </label>
            {(
              [
                { key: 'lengthMm', label: 'Chiều dài (mm)' },
                { key: 'widthMm', label: 'Chiều rộng (mm)' },
                { key: 'heightMm', label: 'Chiều cao (mm)' },
                { key: 'weightGrams', label: 'Trọng lượng (g)' },
              ] as const
            ).map((field) => (
              <label key={field.key} className="space-y-1 text-sm">
                {field.label}
                <input
                  type="number"
                  className={INPUT}
                  min={0}
                  max={99999999.99}
                  step="0.01"
                  value={variant[field.key] ?? ''}
                  onChange={(event) =>
                    update(index, {
                      [field.key]: event.target.value === '' ? null : Number(event.target.value),
                    })
                  }
                />
              </label>
            ))}
          </div>
        </section>
      ))}
      <button
        type="button"
        className={BUTTON}
        disabled={variants.length >= 30}
        onClick={() =>
          onChange([...variants, { ...newVariant(), name: `Lựa chọn ${variants.length + 1}` }])
        }
      >
        Thêm biến thể
      </button>
    </fieldset>
  );
}

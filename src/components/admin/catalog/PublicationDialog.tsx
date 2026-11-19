'use client';

import { useState } from 'react';
import type { AdminProduct, PublicationInput } from '../../../contracts/catalog-admin';
import { ModalDialog } from '../../common/ModalDialog';
import { INPUT, BUTTON } from './product-form';

interface PublicationDialogProps {
  product: AdminProduct;
  action: PublicationInput['action'];
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (input: PublicationInput) => void;
}
export function PublicationDialog({
  product,
  action,
  busy,
  error,
  onClose,
  onSubmit,
}: PublicationDialogProps) {
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const label = {
    PUBLISH: 'Duyệt và xuất bản',
    HIDE: 'Ẩn khỏi cửa hàng',
    ARCHIVE: 'Ngừng kinh doanh',
  }[action];
  return (
    <ModalDialog
      title={label}
      onDismiss={() => {
        if (!busy) onClose();
      }}
      className="items-center p-4"
    >
      <form
        className="w-full max-w-lg space-y-5 rounded-xl border border-[#27313C] bg-[#141A21] p-5 sm:p-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (!busy)
            onSubmit({ action, revision: product.revision, note, rightsConfirmed: confirmed });
        }}
      >
        <h2 className="text-xl font-semibold">{label}</h2>
        <p className="text-sm leading-6 text-[#A5ADB8]">
          {product.code} · {product.name}
        </p>
        {error && (
          <p role="alert" className="text-sm text-[#FF8179]">
            {error}
          </p>
        )}
        <fieldset disabled={busy} className="space-y-4">
          {action === 'PUBLISH' && (
            <label className="flex items-start gap-3 text-sm leading-6">
              <input
                type="checkbox"
                required
                className="mt-1 h-4 w-4 shrink-0 accent-[#EB4037]"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              Tôi đã kiểm tra nguồn gốc, quyền sử dụng mẫu, nội dung và giá bán.
            </label>
          )}
          <label className="block space-y-2 text-sm">
            Ghi chú / lý do *
            <textarea
              required
              maxLength={2000}
              className={INPUT}
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
        </fieldset>
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className={`${BUTTON} bg-[#EB4037]`}
            disabled={busy || (action === 'PUBLISH' && !confirmed)}
          >
            {busy ? 'Đang xử lý…' : label}
          </button>
          <button type="button" className={BUTTON} disabled={busy} onClick={onClose}>
            Quay lại
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}

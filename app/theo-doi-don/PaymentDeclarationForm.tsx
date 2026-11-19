'use client';

import { useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, UploadCloud, X } from 'lucide-react';
import { isRecord } from '../../src/lib/request-validation';

interface PaymentDeclarationFormProps {
  orderNumber: string;
  trackingToken: string;
  onSuccess: () => void;
}

async function responseError(response: Response) {
  const body: unknown = await response.json().catch(() => null);
  if (isRecord(body) && typeof body.error === 'string') return body.error;
  return 'Không gửi được khai báo. Vui lòng thử lại.';
}

export function PaymentDeclarationForm({ orderNumber, trackingToken, onSuccess }: PaymentDeclarationFormProps) {
  const [transactionReference, setTransactionReference] = useState('');
  const [bankName, setBankName] = useState('');
  const [senderAccountName, setSenderAccountName] = useState('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofAttached, setProofAttached] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');
    try {
      if (proofFile && !proofAttached) {
        const upload = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/payment-proof`, {
          method: 'POST',
          headers: {
            'Content-Type': proofFile.type,
            'X-Order-Tracking-Token': trackingToken,
          },
          body: proofFile,
        });
        if (!upload.ok) throw new Error(await responseError(upload));
        setProofAttached(true);
        setProofFile(null);
      }

      const declaration = await fetch('/api/payments/declare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber,
          transactionReference: transactionReference.trim() || orderNumber,
          bankName: bankName.trim() || undefined,
          senderAccountName: senderAccountName.trim() || undefined,
          trackingToken,
        }),
      });
      if (!declaration.ok) throw new Error(await responseError(declaration));
      setMessage(proofAttached || proofFile
        ? 'Đã khai báo chuyển khoản và gửi biên lai riêng tư. Nhân viên sẽ xem ảnh sau khi quét an toàn hoàn tất.'
        : 'Đã khai báo chuyển khoản. Đơn đang chờ nhân viên đối soát.');
      setTransactionReference('');
      setBankName('');
      setSenderAccountName('');
      setProofFile(null);
      setProofAttached(false);
      onSuccess();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không gửi được khai báo. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 border-t border-white/[0.08] pt-5" aria-label="Khai báo chuyển khoản">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold text-[#F4F1EA]">Khai báo chuyển khoản</h2>
        <p className="text-xs leading-5 text-[#A5ADB8]">MinhLab đối soát trên tài khoản ngân hàng trước khi xác nhận đơn. Ảnh biên lai là tùy chọn và được giữ trong kho riêng tư.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5 text-xs text-[#A5ADB8]">
          <span>Mã giao dịch ngân hàng (không bắt buộc)</span>
          <input maxLength={120} value={transactionReference} onChange={(event) => setTransactionReference(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-[#27313C] bg-[#0B0F14] px-3 text-base sm:text-sm text-[#F4F1EA] outline-none focus:border-[#C8A261]" />
        </label>
        <label className="space-y-1.5 text-xs text-[#A5ADB8]">
          <span>Ngân hàng chuyển (không bắt buộc)</span>
          <input maxLength={120} value={bankName} onChange={(event) => setBankName(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-[#27313C] bg-[#0B0F14] px-3 text-base sm:text-sm text-[#F4F1EA] outline-none focus:border-[#C8A261]" />
        </label>
        <label className="space-y-1.5 text-xs text-[#A5ADB8] sm:col-span-2">
          <span>Tên người chuyển (không bắt buộc)</span>
          <input maxLength={160} value={senderAccountName} onChange={(event) => setSenderAccountName(event.target.value)}
            className="min-h-11 w-full rounded-lg border border-[#27313C] bg-[#0B0F14] px-3 text-base sm:text-sm text-[#F4F1EA] outline-none focus:border-[#C8A261]" />
        </label>
      </div>

      <div className="space-y-2 rounded-xl border border-white/[0.08] bg-[#0B0F14] p-3 focus-within:ring-2 focus-within:ring-[#C8A261]">
        <label htmlFor="payment-proof-file" className="flex min-h-11 cursor-pointer items-center gap-2 text-xs font-medium text-[#C8A261]">
          <UploadCloud aria-hidden="true" className="h-4 w-4" />
          <span>{proofFile ? 'Đổi ảnh biên lai' : 'Chọn ảnh biên lai (không bắt buộc)'}</span>
        </label>
        <input id="payment-proof-file" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0] ?? null;
            setError('');
            if (file && file.size > 5 * 1024 * 1024) {
              setProofFile(null);
              setError('Ảnh biên lai không được lớn hơn 5 MB.');
            } else setProofFile(file);
            event.currentTarget.value = '';
          }} />
        {proofFile && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-[#27313C] px-3 py-2 text-xs text-[#A5ADB8]">
            <span className="truncate">{proofFile.name}</span>
            <button type="button" aria-label="Bỏ ảnh biên lai" onClick={() => setProofFile(null)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded text-[#A5ADB8] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261]">
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        )}
        <p className="text-[11px] leading-5 text-[#737D89]">JPEG, PNG hoặc WebP · tối đa 5 MB. Hệ thống chỉ gửi ảnh cho nhân viên sau khi quét file hoàn tất.</p>
      </div>

      {error && <p role="alert" className="flex gap-2 text-xs leading-5 text-[#FF8179]"><AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
      {message && <p role="status" aria-live="polite" className="flex gap-2 text-xs leading-5 text-[#8DBB91]"><CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />{message}</p>}
      <button type="submit" disabled={submitting} className="min-h-11 rounded-lg bg-[#EB4037] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#FF5147] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261] disabled:cursor-wait disabled:opacity-50">
        {submitting ? 'Đang gửi…' : 'Tôi đã chuyển khoản'}
      </button>
    </form>
  );
}

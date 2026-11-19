'use client';

import { useState, type FormEvent } from 'react';
import type { ApiResponse } from '../../src/contracts/api';
import type { OrderReturnData } from '../../src/contracts/orders';
import { formatVND } from '../../src/lib/format';

interface OrderReturnRequestFormProps {
  orderNumber: string;
  token: string;
  request?: OrderReturnData;
  onSuccess: () => void;
}

const STATUS_COPY: Record<OrderReturnData['status'], string> = {
  REQUESTED: 'MinhLab đã nhận yêu cầu. Admin sẽ liên hệ để nhận lại và kiểm tra sản phẩm.',
  RETURN_RECEIVED: 'MinhLab đã nhận và kiểm tra sản phẩm. Khoản hoàn sẽ được chuyển thủ công sau bước này.',
  REFUNDED: 'MinhLab đã ghi nhận chuyển khoản hoàn tiền.',
};

export function OrderReturnRequestForm({ orderNumber, token, request, onSuccess }: OrderReturnRequestFormProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['X-Order-Tracking-Token'] = token;
      const response = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/return-request`, {
        method: 'POST', headers, body: JSON.stringify({ reason }),
      });
      const body: ApiResponse<OrderReturnData> = await response.json();
      if (!response.ok || !body.success) throw new Error(body.success ? 'Không thể gửi yêu cầu.' : body.error);
      setReason('');
      onSuccess();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'Không thể gửi yêu cầu hoàn hàng.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="space-y-3 border-t border-white/[0.08] pt-5" aria-labelledby="return-request-title">
      <div>
        <h2 id="return-request-title" className="text-sm font-semibold text-[#F4F1EA]">Hoàn hàng sau khi nhận</h2>
        <p className="mt-1 text-sm leading-6 text-[#A5ADB8]">Nếu sản phẩm không như mong muốn, gửi yêu cầu tại đây. Admin sẽ nhận lại và kiểm tra hàng; khoản hoàn được chuyển thủ công, không tự động qua ngân hàng.</p>
      </div>
      {request ? (
        <div className="space-y-2 rounded-xl border border-[#C8A261]/30 bg-[#C8A261]/[0.06] p-4">
          <p role="status" className="text-sm font-medium text-[#C8A261]">{STATUS_COPY[request.status]}</p>
          <p className="whitespace-pre-wrap text-sm leading-6 text-[#A5ADB8]">Lý do: {request.reason}</p>
          {request.status === 'REFUNDED' && <dl className="grid gap-1 text-sm sm:grid-cols-[150px_1fr]">
            <dt className="text-[#737D89]">Số tiền đã chuyển</dt><dd className="font-mono text-[#F4F1EA]">{request.refundedAmount ? formatVND(request.refundedAmount) : 'Chưa ghi nhận'}</dd>
            <dt className="text-[#737D89]">Mã giao dịch</dt><dd className="break-all font-mono text-[#F4F1EA]">{request.transactionReference || 'Chưa ghi nhận'}</dd>
          </dl>}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3 rounded-xl border border-white/[0.08] bg-[#0B0B0E] p-4">
          <label htmlFor="return-request-reason" className="block text-sm font-medium text-[#F4F1EA]">Lý do không hài lòng</label>
          <textarea id="return-request-reason" name="reason" required minLength={1} maxLength={2000} rows={4} value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-24 w-full rounded-lg border border-white/[0.12] bg-[#111216] px-3 py-2 text-sm text-[#F4F1EA] placeholder:text-[#737D89] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261]" placeholder="Mô tả sản phẩm hoặc vấn đề bạn gặp phải" />
          <p className="text-xs leading-5 text-[#737D89]">Yêu cầu chỉ mở sau khi trạng thái đơn là “Đã giao”. Đơn đang trên đường giao chưa thể hủy.</p>
          {error && <p role="alert" className="text-sm text-[#FF8179]">{error}</p>}
          <button type="submit" disabled={isSubmitting || !reason.trim()} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-[#EB4037] px-4 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261] disabled:cursor-not-allowed disabled:opacity-50">
            {isSubmitting ? 'Đang gửi…' : 'Gửi yêu cầu hoàn hàng'}
          </button>
        </form>
      )}
    </section>
  );
}

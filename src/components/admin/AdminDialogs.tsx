'use client';

import { AlertCircle, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { formatVND } from '../../lib/format';
import { ORDER_STATUS_BADGES, PAYMENT_STATUS_BADGES } from '../../lib/order-presentation';
import type { PaymentItem, OrderItemAdmin } from './admin.types';
import { Button, Dialog, StatusBadge } from './ui';

interface AdminDialogsProps {
  selectedReceiptPayment: PaymentItem | null;
  setSelectedReceiptPayment: (payment: PaymentItem | null) => void;
  rejectingPayment: PaymentItem | null;
  setRejectingPayment: (payment: PaymentItem | null) => void;
  rejectionReasonInput: string;
  setRejectionReasonInput: (reason: string) => void;
  selectedOrderDetails: OrderItemAdmin | null;
  verifyingOrderNum: string | null;
  setSelectedOrderDetails: (order: OrderItemAdmin | null) => void;
  handleVerifyPayment: (number: string) => Promise<void>;
  handleRejectPayment: () => Promise<void>;
  canProcessReturns: boolean;
  updatingReturnOrderNumber: string | null;
  handleOrderReturnAction: (number: string, action: 'RECEIVE' | 'REFUND', details?: { amount: number; transactionReference: string }) => Promise<boolean>;
}

const close = <T,>(setter: (value: T | null) => void) => () => setter(null);
const declarationDate = new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Asia/Ho_Chi_Minh',
});

function formatDeclarationTime(value?: string) {
  if (!value) return 'Chưa khai báo';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Chưa rõ thời gian' : declarationDate.format(date);
}

export function AdminDialogs({
  selectedReceiptPayment,
  setSelectedReceiptPayment,
  rejectingPayment,
  setRejectingPayment,
  rejectionReasonInput,
  setRejectionReasonInput,
  selectedOrderDetails,
  verifyingOrderNum,
  setSelectedOrderDetails,
  handleVerifyPayment,
  handleRejectPayment,
  canProcessReturns,
  updatingReturnOrderNumber,
  handleOrderReturnAction,
}: AdminDialogsProps) {
  const [refundForm, setRefundForm] = useState<{ key: string; amount: string; transactionReference: string } | null>(null);
  const refundFormKey = `${selectedOrderDetails?.orderNumber ?? ''}:${selectedOrderDetails?.returnRequest?.status ?? ''}`;
  const activeRefundForm = refundForm?.key === refundFormKey ? refundForm : {
    key: refundFormKey,
    amount: selectedOrderDetails?.grandTotal ? String(selectedOrderDetails.grandTotal) : '',
    transactionReference: '',
  };

  return (
    <>
      {selectedReceiptPayment && (
        <Dialog open title="Đối chiếu thanh toán" onClose={close(setSelectedReceiptPayment)}>
          <div className="space-y-4">
            <header className="border-b border-admin-border pb-3">
              <p className="text-xs text-admin-secondary">Mã đơn hàng cần đối chiếu</p>
              <p className="mt-1 break-all font-mono text-sm font-medium tabular-nums text-admin-text">{selectedReceiptPayment.orderNumber}</p>
            </header>

            <dl className="grid gap-y-2 text-sm sm:grid-cols-[150px_1fr]">
              <dt className="text-admin-muted">Số tiền cần kiểm tra</dt><dd className="text-xl font-semibold tabular-nums text-admin-text">{formatVND(selectedReceiptPayment.amount)}</dd>
              <dt className="text-admin-muted">Mã giao dịch</dt><dd className="break-all font-mono text-admin-text">{selectedReceiptPayment.transactionReference || 'Chưa cung cấp'}</dd>
              <dt className="text-admin-muted">Người chuyển</dt><dd className="text-admin-text">{selectedReceiptPayment.senderAccountName && selectedReceiptPayment.senderAccountName !== 'N/A' ? selectedReceiptPayment.senderAccountName : 'Chưa cung cấp'}</dd>
              <dt className="text-admin-muted">Ngân hàng</dt><dd className="text-admin-text">{selectedReceiptPayment.bankName && selectedReceiptPayment.bankName !== 'N/A' ? selectedReceiptPayment.bankName : 'Chưa cung cấp'}</dd>
              <dt className="text-admin-muted">Khai báo lúc</dt><dd className="text-admin-text">{formatDeclarationTime(selectedReceiptPayment.transferredAt)}</dd>
            </dl>

            {selectedReceiptPayment.attachments.some((url) => /^(https?:)?\/\//i.test(url)) && <div role="note" className="flex gap-2 rounded-md border border-admin-warning-border bg-admin-warning-soft p-3 text-xs leading-5 text-admin-warning">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Ảnh chứng từ cũ dùng liên kết Cloudinary công khai nên người có liên kết đều xem được. Tránh chia sẻ ảnh có thông tin ngân hàng cá nhân.</span>
            </div>}

            <div className="space-y-2 rounded-md border border-admin-border p-3 text-sm">
              {selectedReceiptPayment.attachments.length ? selectedReceiptPayment.attachments.map((url, index) => (
                <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center gap-2 text-admin-accent underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent">
                  Xem ảnh chứng từ {index + 1}<ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                </a>
              )) : <p className="text-xs leading-5 text-admin-secondary">Chưa có ảnh chứng từ. Ảnh riêng tư sẽ hiển thị sau khi hệ thống quét tệp xác nhận an toàn. Hãy tải lại danh sách nếu khách vừa gửi chứng từ.</p>}
              <p className="text-xs leading-5 text-admin-muted">Kiểm tra giao dịch trong tài khoản ngân hàng của xưởng trước khi xác nhận thanh toán.</p>
            </div>

            <footer className="flex flex-wrap justify-end gap-2 border-t border-admin-border pt-3">
              <Button onClick={close(setSelectedReceiptPayment)}>Đóng</Button>
              {selectedReceiptPayment.verificationStatus === 'PENDING' && <>
                <Button variant="danger" disabled={verifyingOrderNum === selectedReceiptPayment.orderNumber} onClick={() => { setRejectingPayment(selectedReceiptPayment); setRejectionReasonInput('Xưởng chưa nhận được khoản chuyển vào tài khoản ngân hàng.'); setSelectedReceiptPayment(null); }}>Chưa nhận được tiền</Button>
                <Button variant="primary" disabled={verifyingOrderNum === selectedReceiptPayment.orderNumber} onClick={() => { void handleVerifyPayment(selectedReceiptPayment.orderNumber); setSelectedReceiptPayment(null); }}>{verifyingOrderNum === selectedReceiptPayment.orderNumber ? 'Đang lưu…' : 'Đã đối chiếu, xác nhận tiền về'}</Button>
              </>}
            </footer>
          </div>
        </Dialog>
      )}

      {rejectingPayment && (
        <Dialog open title="Từ chối thanh toán" onClose={close(setRejectingPayment)}>
          <div className="space-y-4">
            <p className="text-sm text-admin-secondary">Đơn hàng <span className="font-mono font-medium text-admin-text">{rejectingPayment.orderNumber}</span></p>
            <div className="space-y-1.5">
              <label htmlFor="payment-rejection-reason" className="block text-xs font-medium text-admin-secondary">Lý do từ chối</label>
              <textarea id="payment-rejection-reason" maxLength={2000} rows={4} value={rejectionReasonInput} onChange={(event) => setRejectionReasonInput(event.target.value)} className="min-h-24 w-full rounded-md border border-admin-border bg-admin-surface px-3 py-2 text-sm text-admin-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent" />
              <p className="text-xs text-admin-muted">Khách hàng sẽ thấy lý do này. Hãy ghi rõ thông tin cần bổ sung hoặc điều cần thực hiện.</p>
            </div>
            <footer className="flex justify-end gap-2 border-t border-admin-border pt-3">
              <Button onClick={close(setRejectingPayment)}>Hủy</Button>
              <Button variant="danger" onClick={() => { void handleRejectPayment(); }}>Từ chối thanh toán</Button>
            </footer>
          </div>
        </Dialog>
      )}

      {selectedOrderDetails && (
        <Dialog open title={`Đơn hàng ${selectedOrderDetails.orderNumber}`} onClose={close(setSelectedOrderDetails)}>
          <div className="space-y-4">
            <section className="grid gap-2 border-b border-admin-border pb-4 text-sm sm:grid-cols-2">
              <div><p className="text-xs text-admin-muted">Khách hàng</p><p className="mt-1 font-medium text-admin-text">{selectedOrderDetails.customerName || 'Chưa cung cấp'}</p></div>
              <div><p className="text-xs text-admin-muted">Điện thoại</p><p className="mt-1 text-admin-text">{selectedOrderDetails.customerPhone === 'N/A' ? 'Chưa cung cấp' : selectedOrderDetails.customerPhone || 'Chưa cung cấp'}</p></div>
              <div className="sm:col-span-2"><p className="text-xs text-admin-muted">Thư điện tử</p><p className="mt-1 break-all text-admin-text">{selectedOrderDetails.customerEmail === 'N/A' ? 'Chưa cung cấp' : selectedOrderDetails.customerEmail || 'Chưa cung cấp'}</p></div>
              <div className="sm:col-span-2"><p className="text-xs text-admin-muted">Địa chỉ giao hàng</p><p className="mt-1 text-admin-text">{selectedOrderDetails.shippingAddress || 'Chưa cung cấp'}</p></div>
            </section>
            {!!selectedOrderDetails.items?.length && <section aria-label="Mặt hàng trong đơn" className="overflow-x-auto rounded-md border border-admin-border">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="border-b border-admin-border bg-admin-subtle text-xs text-admin-secondary"><tr><th scope="col" className="px-3 py-3">Sản phẩm</th><th scope="col" className="px-3 py-3 text-right">SL</th><th scope="col" className="px-3 py-3 text-right">Đơn giá</th></tr></thead>
                <tbody className="divide-y divide-admin-border">{selectedOrderDetails.items.map((item, index) => <tr key={index}><td className="px-3 py-3"><p className="font-medium">{item.itemName}</p>{item.material && <p className="mt-1 text-xs text-admin-muted">{item.material}</p>}</td><td className="px-3 py-3 text-right tabular-nums">{item.quantity}</td><td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{formatVND(item.unitPrice)}</td></tr>)}</tbody>
              </table>
            </section>}
            {selectedOrderDetails.customerNote && <div className="rounded-md border border-admin-border bg-admin-subtle p-3"><p className="text-xs font-medium text-admin-secondary">Ghi chú của khách</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-admin-text">{selectedOrderDetails.customerNote}</p></div>}
            <dl className="grid gap-y-3 text-sm sm:grid-cols-[170px_1fr]">
              <dt className="text-admin-muted">Phương thức thanh toán</dt><dd className="text-admin-text">{selectedOrderDetails.paymentTiming === 'COD' ? 'Thu tiền khi giao (đơn cũ)' : 'Chuyển khoản VietQR'}</dd>
              <dt className="text-admin-muted">Trạng thái đơn</dt><dd><StatusBadge>{ORDER_STATUS_BADGES[selectedOrderDetails.orderStatus as keyof typeof ORDER_STATUS_BADGES]?.label ?? 'Chưa xác định'}</StatusBadge></dd>
              <dt className="text-admin-muted">Trạng thái thanh toán</dt><dd><StatusBadge tone={selectedOrderDetails.paymentStatus === 'PAID' ? 'success' : 'warning'}>{PAYMENT_STATUS_BADGES[selectedOrderDetails.paymentStatus as keyof typeof PAYMENT_STATUS_BADGES]?.label ?? 'Chưa xác định'}</StatusBadge></dd>
              <dt className="font-medium text-admin-text">Tổng tiền đơn hàng</dt><dd className="font-semibold tabular-nums text-admin-text">{formatVND(selectedOrderDetails.grandTotal)}</dd>
            </dl>
            {selectedOrderDetails.returnRequest && <section aria-labelledby="admin-return-request-title" className="space-y-3 rounded-md border border-admin-warning-border bg-admin-warning-soft p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="admin-return-request-title" className="text-sm font-semibold text-admin-text">Yêu cầu hoàn hàng</h3>
                <StatusBadge tone={selectedOrderDetails.returnRequest.status === 'REFUNDED' ? 'success' : 'warning'}>{selectedOrderDetails.returnRequest.status === 'REQUESTED' ? 'Chờ nhận hàng' : selectedOrderDetails.returnRequest.status === 'RETURN_RECEIVED' ? 'Đã nhận, chờ ghi hoàn' : 'Đã ghi nhận hoàn'}</StatusBadge>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6 text-admin-secondary">{selectedOrderDetails.returnRequest.reason}</p>
              <dl className="grid gap-y-2 text-xs sm:grid-cols-[150px_1fr]">
                <dt className="text-admin-muted">Khách gửi lúc</dt><dd className="text-admin-text">{formatDeclarationTime(selectedOrderDetails.returnRequest.requestedAt)}</dd>
                {selectedOrderDetails.returnRequest.receivedAt && <><dt className="text-admin-muted">Admin nhận hàng</dt><dd className="text-admin-text">{formatDeclarationTime(selectedOrderDetails.returnRequest.receivedAt)}</dd></>}
                {selectedOrderDetails.returnRequest.refundedAt && <><dt className="text-admin-muted">Ghi nhận chuyển khoản</dt><dd className="text-admin-text">{formatDeclarationTime(selectedOrderDetails.returnRequest.refundedAt)}</dd><dt className="text-admin-muted">Số tiền đã chuyển</dt><dd className="font-medium tabular-nums text-admin-text">{formatVND(selectedOrderDetails.returnRequest.refundedAmount ?? 0)}</dd><dt className="text-admin-muted">Mã giao dịch</dt><dd className="break-all font-mono text-admin-text">{selectedOrderDetails.returnRequest.transactionReference || 'Chưa ghi nhận'}</dd></>}
              </dl>
              {canProcessReturns && selectedOrderDetails.returnRequest.status === 'REQUESTED' && <div className="space-y-2 border-t border-admin-warning-border pt-3">
                <p className="text-xs leading-5 text-admin-secondary">Chỉ bấm sau khi xưởng đã nhận lại và kiểm tra sản phẩm.</p>
                <Button variant="primary" disabled={updatingReturnOrderNumber === selectedOrderDetails.orderNumber} onClick={() => { void handleOrderReturnAction(selectedOrderDetails.orderNumber, 'RECEIVE'); }}>{updatingReturnOrderNumber === selectedOrderDetails.orderNumber ? 'Đang lưu…' : 'Đã nhận lại và kiểm hàng'}</Button>
              </div>}
              {canProcessReturns && selectedOrderDetails.returnRequest.status === 'RETURN_RECEIVED' && <form className="space-y-3 border-t border-admin-warning-border pt-3" onSubmit={(event) => {
                event.preventDefault();
                void handleOrderReturnAction(selectedOrderDetails.orderNumber, 'REFUND', { amount: Number(activeRefundForm.amount), transactionReference: activeRefundForm.transactionReference.trim() });
              }}>
                <p className="text-xs leading-5 text-admin-secondary">Chuyển khoản ngoài hệ thống trước, rồi nhập đúng số tiền và mã giao dịch để lưu lịch sử.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5"><label htmlFor="return-refund-amount" className="block text-xs font-medium text-admin-secondary">Số tiền đã chuyển (VND)</label><input id="return-refund-amount" type="number" min="1" step="1" required value={activeRefundForm.amount} onChange={(event) => setRefundForm({ ...activeRefundForm, amount: event.target.value })} className="min-h-10 w-full rounded-md border border-admin-border bg-admin-surface px-3 text-sm tabular-nums text-admin-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent" /></div>
                  <div className="space-y-1.5"><label htmlFor="return-refund-reference" className="block text-xs font-medium text-admin-secondary">Mã giao dịch chuyển khoản</label><input id="return-refund-reference" type="text" maxLength={120} required value={activeRefundForm.transactionReference} onChange={(event) => setRefundForm({ ...activeRefundForm, transactionReference: event.target.value })} className="min-h-10 w-full rounded-md border border-admin-border bg-admin-surface px-3 text-sm text-admin-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent" /></div>
                </div>
                <Button type="submit" variant="primary" disabled={updatingReturnOrderNumber === selectedOrderDetails.orderNumber || !Number.isSafeInteger(Number(activeRefundForm.amount)) || Number(activeRefundForm.amount) <= 0 || !activeRefundForm.transactionReference.trim()}>{updatingReturnOrderNumber === selectedOrderDetails.orderNumber ? 'Đang lưu…' : 'Đã chuyển, ghi nhận hoàn tiền'}</Button>
              </form>}
            </section>}
            <footer className="flex justify-end border-t border-admin-border pt-3"><Button onClick={close(setSelectedOrderDetails)}>Đóng</Button></footer>
          </div>
        </Dialog>
      )}
    </>
  );
}

'use client';
import { useState, type FormEvent } from 'react';
import type { PrintRequestView } from '../../contracts/print-requests';
import { BUTTON, INPUT, Field } from '../admin/production/ProductionForms';

const date = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
export function RequestRetention({ request, role, busy, send }: {
  request: PrintRequestView;
  role: string;
  busy: boolean;
  send(value: unknown): Promise<void>;
}) {
  const [note, setNote] = useState('');
  const [reviewAt, setReviewAt] = useState('');
  const [action, setAction] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const staff = role === 'ADMIN';
  const converted = request.closedReason === 'CONVERTED' || request.quotes.some(q => q.orderNumber);
  const closed = ['CLOSED', 'REJECTED'].includes(request.status);
  const purged = request.retainedFiles?.some(file => file.availability === 'PURGED');
  const holds = request.fileHolds ?? [];
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!action || !confirmed) return;
    await send({ action, id: request.id, revision: request.revision, note,
      ...(action === 'HOLD' ? { reviewAt: new Date(reviewAt).toISOString() } : {}) });
  }
  return <section className="space-y-3 border-t border-[#27313C] pt-4 text-sm leading-6" aria-label="Thời hạn lưu file">
    <h3 className="font-semibold">Lưu trữ file</h3>
    {!request.retainedFiles?.length ? <p className="text-[#A5ADB8]">Chưa có file được lưu cho yêu cầu này.</p> : request.retainedFiles.map((file, index) =>
      <p key={file.id} className="text-[#A5ADB8]">File {index + 1}: {file.availability === 'PURGED'
        ? 'Đã hết thời hạn lưu. Vui lòng gửi lại file nếu muốn đặt in tiếp.'
        : file.scheduledDeletionAt ? `Dự kiến xóa sau ${date(file.scheduledDeletionAt)}.`
        : file.retentionReason === 'OUT_OF_SCOPE' || file.retentionReason === 'UNKNOWN_REFERENCE' ? 'Đang giữ để xác minh chính sách lưu trữ.'
        : 'Được giữ trong thời gian xử lý yêu cầu, đơn hàng hoặc sự việc liên quan.'}</p>)}
    {converted && <p className="text-[#A5ADB8]">File được giữ trong suốt quá trình làm đơn và 7 ngày sau khi hoàn tất. Khi có hoàn hàng hoặc xử lý sự cố, thời hạn lưu có thể được kéo dài.</p>}
    {staff && holds.map(hold => <div key={hold.id} className="space-y-2">
      <p className={hold.overdue ? 'text-[#FFB0A7]' : 'text-[#A5ADB8]'}>Đang giữ: {hold.reason} · Rà soát: {date(hold.reviewAt)}{hold.overdue ? ' · Đã đến hạn rà soát' : ''}</p>
      <Field label="Kết quả xử lý để kết thúc lần giữ file"><input className={INPUT} maxLength={2000} value={note} onChange={e => setNote(e.target.value)} /></Field>
      <button type="button" className={BUTTON} disabled={busy || !note.trim()} onClick={() => void send({ action: 'RELEASE_HOLD', id: request.id, revision: request.revision, holdId: hold.id, note })}>Đã xử lý xong, giữ thêm 7 ngày</button>
    </div>)}
    {((!converted && (role === 'CUSTOMER' || staff)) || (staff && !purged)) && <form className="space-y-3" onSubmit={submit}>
      <Field label="Thao tác với yêu cầu / file"><select className={INPUT} required value={action} onChange={e => { setAction(e.target.value); setConfirmed(false); }}>
        <option value="">Chọn thao tác</option>
        {!converted && !closed && <option value="CLOSE">Không đặt nữa / đóng yêu cầu</option>}
        {!converted && closed && !purged && <option value="REOPEN">Mở lại để bổ sung và báo giá lại</option>}
        {staff && !purged && <option value="HOLD">Tạm giữ file để xử lý sự cố / in lại</option>}
      </select></Field>
      {action && <>
        <Field label="Lý do / mã sự việc"><textarea className={INPUT} required maxLength={2000} value={note} onChange={e => setNote(e.target.value)} /></Field>
        {action === 'HOLD' && <Field label="Ngày cần rà soát (giờ thiết bị)"><input className={INPUT} type="datetime-local" required value={reviewAt} onChange={e => setReviewAt(e.target.value)} /></Field>}
        <label className="flex items-start gap-3"><input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-1" />{action === 'CLOSE' ? 'Tôi xác nhận kết thúc yêu cầu. File dự kiến được xóa sau 48 giờ nếu không còn việc cần xử lý.' : action === 'REOPEN' ? 'Tôi hiểu báo giá cũ không được dùng lại; xưởng cần kiểm tra và báo giá mới.' : 'Giữ file đến khi xử lý xong. Ngày rà soát không tự kết thúc việc giữ file.'}</label>
        <button className={BUTTON} disabled={busy}>Ghi nhận</button>
      </>}
    </form>}
  </section>;
}

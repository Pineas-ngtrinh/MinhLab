'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import type { TelegramLinkStatus } from '../../contracts/telegram-link';
import { readApiResponse } from '../../lib/read-api-response';

export function TelegramLinkPanel() {
  const { user, isAuthReady } = useAuth();
  const [status, setStatus] = useState<TelegramLinkStatus | null>(null);
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const revision = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++revision.current;
    try {
      const response = await fetch('/api/auth/telegram-link', { cache: 'no-store' });
      const body = await readApiResponse<TelegramLinkStatus>(response);
      if (!response.ok || !body.success) throw new Error(body.error || 'Chưa tải được liên kết Telegram.');
      if (revision.current === current) { setStatus(body.data); setError(''); }
    } catch (cause) { if (revision.current === current) setError(cause instanceof Error ? cause.message : 'Mất kết nối máy chủ.'); }
  }, []);
  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [user?.id, user, refresh]);
  useEffect(() => {
    if (!status?.waiting || status.pending) return;
    const timer = window.setInterval(() => { if (!document.hidden && !lock.current) void refresh(); }, 4000);
    const onFocus = () => { if (!lock.current) void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [status?.waiting, status?.pending, refresh]);
  async function act(action: 'START' | 'CONFIRM' | 'UNLINK') {
    if (lock.current) return;
    revision.current++;
    lock.current = true; setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/telegram-link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, requestId: status?.pending?.requestId }) });
      const body = await readApiResponse<TelegramLinkStatus | { url: string }>(response);
      if (!response.ok || !body.success) throw new Error(body.error || 'Chưa thay đổi được liên kết.');
      if ('url' in body.data) { setUrl(body.data.url); await refresh(); }
      else { setStatus(body.data); setUrl(''); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Mất kết nối máy chủ.'); }
    finally { lock.current = false; setBusy(false); }
  }
  const button = 'inline-flex min-h-11 items-center justify-center rounded-lg border border-[#27313C] px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261] disabled:opacity-50';
  if (!isAuthReady) return <p role="status">Đang kiểm tra tài khoản…</p>;
  if (!user) return <p>Vui lòng <a className="text-[#C8A261] underline" href="/dang-nhap?redirect=/lien-ket-telegram">đăng nhập</a> rồi mở lại trang này để liên kết Telegram.</p>;
  return <section className="max-w-xl space-y-5 text-[#F4F1EA]">
    <h1 className="text-2xl font-semibold">Liên kết Telegram</h1>
    <p className="break-all text-sm text-[#A5ADB8]">Tài khoản website: {user.email}</p>
    <p className="text-sm leading-6 text-[#A5ADB8]">Mở bot của MinhLab, bấm Start rồi quay lại đây xác nhận tên Telegram của bạn. Chỉ cần liên kết một lần. Quyền xác nhận thanh toán do quản trị viên cấp trên website.</p>
    {!status && !error && <p role="status">Đang tải liên kết…</p>}
    {status?.linkedId && <p role="status" className="break-words text-sm text-[#C8A261]">Đã liên kết Telegram · {status.linkedId}</p>}
    {status?.pending ? <div className="space-y-3 border-y border-[#27313C] py-4">
      <p className="break-words text-sm leading-6">Telegram vừa gửi yêu cầu: <strong>{status.pending.name}</strong> · ID {status.pending.telegramId}. Đây có phải tài khoản của bạn?</p>
      <button className={`${button} bg-[#EB4037] text-white`} disabled={busy} onClick={() => void act('CONFIRM')}>{busy ? 'Đang liên kết…' : 'Đúng, liên kết tài khoản này'}</button>
      <p className="text-xs leading-5 text-[#A5ADB8]">Nếu không đúng tên của bạn, tạo đường dẫn mới bên dưới. Không xác nhận tài khoản lạ.</p>
    </div> : status?.waiting && <div className="space-y-3">
      {url && <a className={`${button} bg-[#EB4037] text-white`} href={url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Mở Telegram và bấm Start</a>}
      <p role="status" className="text-sm leading-6 text-[#A5ADB8]">Đang chờ bạn mở bot. Đường dẫn dùng trong 10 phút; quay lại trang này sau khi bấm Start. Không chia sẻ đường dẫn.</p>
    </div>}
    {error && <p role="alert" className="break-words text-sm text-[#FF8179]">{error}</p>}
    <div className="flex flex-wrap gap-3">
      <button className={button} disabled={busy || !status} onClick={() => void act('START')}>{busy ? 'Đang xử lý…' : status?.waiting ? 'Tạo đường dẫn mới' : status?.linkedId ? 'Đổi tài khoản Telegram' : 'Liên kết Telegram'}</button>
      <button className={button} disabled={busy} onClick={() => void refresh()}>Kiểm tra lại</button>
      {(status?.linkedId || status?.waiting) && <button className={button} disabled={busy} onClick={() => { if (window.confirm('Gỡ liên kết Telegram và hủy yêu cầu đang chờ?')) void act('UNLINK'); }}>Gỡ / hủy liên kết</button>}
    </div>
  </section>;
}

'use client';

import Link from 'next/link';
import { useRef, useState, type FormEvent } from 'react';
import { readApiResponse } from '../../lib/read-api-response';

export function EmailCodeVerification({ initialEmail = '' }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const lock = useRef(false);
  const emailInput = useRef<HTMLInputElement>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  async function send(verify: boolean) {
    if (lock.current || done) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || email.trim().length > 255) {
      setError('Vui lòng nhập địa chỉ email hợp lệ.'); setMessage(''); emailInput.current?.focus(); return;
    }
    if (verify && !/^[0-9]{8}$/.test(code)) {
      setError('Vui lòng nhập mã xác minh gồm 8 chữ số.'); setMessage(''); codeInput.current?.focus(); return;
    }
    if (!verify && Date.now() < resendAt) { setMessage('Vui lòng chờ 60 giây trước khi gửi lại mã.'); return; }
    lock.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(verify ? '/api/auth/verify-email' : '/api/auth/verification', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, ...(verify ? { code } : {}) }),
      });
      const result = await readApiResponse<unknown>(response);
      if (!response.ok || !result.success) throw new Error(result.error || 'Chưa thể xác minh email.');
      if (verify) { setDone(true); setCode(''); }
      else { setResendAt(Date.now() + 60_000); setMessage('Đã ghi nhận yêu cầu gửi mã mới. Kiểm tra hộp thư và mục thư rác.'); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Chưa kết nối được máy chủ.'); }
    finally { lock.current = false; setBusy(false); }
  }
  if (done) return <div className="space-y-4"><p role="status">Email đã được xác minh.</p><Link href="/dang-nhap" className="inline-flex min-h-12 items-center rounded-lg bg-[#EB4037] px-6 font-semibold text-white">Đăng nhập</Link></div>;
  const input = 'mt-2 min-h-12 w-full rounded-lg border border-[#27313C] bg-[#0B0F14] px-3 text-base text-[#F4F1EA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261]';
  return <form noValidate className="space-y-4" onSubmit={(event: FormEvent) => { event.preventDefault(); void send(true); }}>
    <p className="text-sm leading-6 text-[#A5ADB8]">Nhập mã 8 chữ số được gửi tới email đăng ký. Mã có hiệu lực 30 phút; không cần mở liên kết hay chuyển tab.</p>
    <label className="block text-sm">Email<input ref={emailInput} className={input} type="email" required autoComplete="email" maxLength={255} value={email} disabled={busy} aria-describedby={error ? 'email-code-error' : undefined} onChange={event => setEmail(event.target.value)} /></label>
    <label className="block text-sm">Mã xác minh<input ref={codeInput} className={`${input} font-mono tracking-widest`} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{8}" minLength={8} maxLength={8} required value={code} disabled={busy} aria-describedby={error ? 'email-code-error' : undefined} onChange={event => setCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 8))} /></label>
    {error && <p id="email-code-error" role="alert" className="text-sm text-[#FF8179]">{error}</p>}
    {message && <p role="status" className="text-sm text-[#C8A261]">{message}</p>}
    <button type="submit" disabled={busy} className="min-h-12 w-full rounded-lg bg-[#EB4037] px-4 font-semibold text-white disabled:opacity-50">{busy ? 'Đang xử lý…' : 'Xác minh tài khoản'}</button>
    <button type="button" disabled={busy || !email.trim()} onClick={() => void send(false)} className="min-h-11 text-sm text-[#C8A261] underline disabled:opacity-50">Gửi lại mã xác minh</button>
  </form>;
}

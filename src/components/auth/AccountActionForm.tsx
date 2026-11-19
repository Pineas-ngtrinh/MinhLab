'use client';

import Link from 'next/link';
import { EmailCodeVerification } from './EmailCodeVerification';
import { useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface AccountActionFormProps {
  mode: 'verify' | 'request' | 'reset' | 'resend';
  token?: string;
}

const ACTIONS = {
  verify: { title: 'Xác minh email', button: 'Xác minh email', endpoint: '/api/auth/verify-email' },
  request: { title: 'Quên mật khẩu', button: 'Gửi hướng dẫn đặt lại mật khẩu', endpoint: '/api/auth/password-reset' },
  reset: { title: 'Đặt lại mật khẩu', button: 'Lưu mật khẩu mới', endpoint: '/api/auth/password-reset/confirm' },
  resend: { title: 'Gửi lại email xác minh', button: 'Gửi liên kết xác minh', endpoint: '/api/auth/verification' },
};

export default function AccountActionForm({ mode, token = '' }: AccountActionFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const action = ACTIONS[mode];
  const needsToken = mode === 'verify' || mode === 'reset';
  const needsEmail = mode === 'request' || mode === 'resend';

  if ((mode === 'verify' && !token) || mode === 'resend') return <section className="mx-auto w-full max-w-lg px-5 py-12 text-[#F4F1EA]"><h1 className="mb-6 text-2xl font-semibold">Xác minh email</h1><EmailCodeVerification /></section>;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (needsToken && !token) { setError('Liên kết thiếu mã xác nhận. Hãy mở đầy đủ liên kết trong email.'); return; }
    if (mode === 'reset' && password !== confirmation) { setError('Mật khẩu xác nhận không trùng khớp.'); return; }
    setBusy(true);
    try {
      const response = await fetch(action.endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(needsEmail ? { email } : { token, ...(mode === 'reset' ? { password } : {}) }),
      });
      const result: { success?: boolean; message?: string; error?: string } = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Không thể xử lý yêu cầu. Vui lòng thử lại.');
      setMessage(result.message || 'Yêu cầu đã được xử lý.');
      setDone(true);
      setPassword(''); setConfirmation('');
      if (needsToken) window.history.replaceState(null, '', window.location.pathname);
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : 'Không thể kết nối. Vui lòng thử lại.');
    } finally { setBusy(false); }
  }

  const inputClass = 'mt-2 min-h-12 w-full border border-[#27313C] bg-[#0B0F14] px-3 text-base text-[#F4F1EA] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C8A261]';
  return (
    <section className="mx-auto w-full max-w-lg px-5 py-12 sm:py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-[#F4F1EA]">{action.title}</h1>
      <p className="mt-4 text-sm leading-relaxed text-[#A5ADB8]">
        {needsEmail ? 'Nhập email bạn đã dùng để đăng ký. Nếu tài khoản phù hợp, MinhLab sẽ gửi hướng dẫn tới hộp thư đó.' : 'Liên kết chỉ có thể dùng một lần và có hiệu lực trong 30 phút.'}
      </p>
      <form onSubmit={submit} className="mt-8 space-y-5">
        {needsEmail && <label className="block text-sm text-[#F4F1EA]" htmlFor="account-email">Email đăng ký
          <input id="account-email" type="email" autoComplete="email" required maxLength={255} value={email} onChange={e => setEmail(e.target.value)} className={inputClass} disabled={done} />
        </label>}
        {mode === 'reset' && !done && <>
          <div>
            <label className="block text-sm text-[#F4F1EA]" htmlFor="new-password">Mật khẩu mới (8–128 ký tự)</label>
            <div className="relative">
              <input id="new-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} className={`${inputClass} pr-12`} />
              <button type="button" onClick={() => setShowPassword(visible => !visible)} className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-[#737D89] transition-colors hover:text-[#F4F1EA] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C8A261]" aria-label={showPassword ? 'Ẩn mật khẩu mới' : 'Hiện mật khẩu mới'} aria-pressed={showPassword} aria-controls="new-password">
                {showPassword ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm text-[#F4F1EA]" htmlFor="confirm-password">Nhập lại mật khẩu mới</label>
            <div className="relative">
              <input id="confirm-password" type={showConfirmation ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={128} value={confirmation} onChange={e => setConfirmation(e.target.value)} className={`${inputClass} pr-12`} />
              <button type="button" onClick={() => setShowConfirmation(visible => !visible)} className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-[#737D89] transition-colors hover:text-[#F4F1EA] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#C8A261]" aria-label={showConfirmation ? 'Ẩn mật khẩu xác nhận' : 'Hiện mật khẩu xác nhận'} aria-pressed={showConfirmation} aria-controls="confirm-password">
                {showConfirmation ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </>}
        {error && <p role="alert" className="text-sm leading-relaxed text-[#FF756D]">{error}</p>}
        {message && <p role="status" className="text-sm leading-relaxed text-[#F4F1EA]">{message}</p>}
        {!done && <button type="submit" disabled={busy || (needsToken && !token)} className="min-h-12 w-full bg-[#EB4037] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#FF5147] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A261] disabled:cursor-not-allowed disabled:opacity-50">
          {busy ? 'Đang xử lý…' : action.button}
        </button>}
      </form>
      <Link href="/dang-nhap" className="mt-8 inline-block text-sm text-[#C8A261] underline underline-offset-4 focus-visible:ring-1 focus-visible:ring-[#C8A261]">Quay lại đăng nhập</Link>
    </section>
  );
}

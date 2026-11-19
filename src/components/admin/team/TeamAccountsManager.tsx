'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import type { ApiResponse } from '../../../contracts/api';
import type { ManagedAccount, ManagedAccountsPage, AssignAccountRole, LinkTelegramAccount } from '../../../contracts/team';
import { ROLES, ROLE_PRIORITY, type RoleCode } from '../../../lib/auth-roles';
import { Button, Input, Select, StatusBadge } from '../ui';
import { ModalDialog } from '../../common/ModalDialog';
import { ListPagination } from '../../common/ListPagination';

const ROLE_HELP: Record<RoleCode, string> = {
  CUSTOMER: 'Mua hàng, gửi yêu cầu in và xem dữ liệu của chính mình. Thu hồi các quyền nhân sự đang có.',
  WORKSHOP_OPERATOR: 'Nhập dữ liệu nháp, lập và duyệt kế hoạch, xác nhận in, QC và đóng gói. Không xem thanh toán hay địa chỉ khách.',
  FILE_REVIEWER: 'Kiểm file và phát hành báo giá cho các yêu cầu được phân công. Không xác nhận tiền.',
  PRINT_OPERATOR: 'Nhận công việc in, ghi tiến độ, QC và hoàn thiện theo quyền của thợ. Không xác nhận thanh toán.',
  ADMIN: 'Quản lý đơn hàng, xác nhận hoặc từ chối thanh toán, bàn giao vận chuyển, cấp và thu hồi quyền. Vẫn tuân thủ điều kiện nghiệp vụ.',
};
const STATUS_LABEL: Record<string, string> = { ACTIVE: 'Đang hoạt động', PENDING: 'Chờ xác minh', LOCKED: 'Đã khóa', DISABLED: 'Đã ngừng' };

export function AccountRoleDialog({ account, requireVerifiedEmail, busy, error, onClose, onSave }: {
  account: ManagedAccount;
  requireVerifiedEmail: boolean;
  busy: boolean;
  error: string;
  onClose(): void;
  onSave(input: AssignAccountRole | LinkTelegramAccount): Promise<void>;
}) {
  const [role, setRole] = useState<RoleCode>(account.effectiveRole ?? 'CUSTOMER');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const canGrant = account.status === 'ACTIVE' && (!requireVerifiedEmail || account.emailVerified);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!confirmed || busy) return;
    await onSave({ userId: account.id, role, expectedRoles: account.roles, reason: reason.trim() });
  }
  return <ModalDialog title="Thay đổi quyền tài khoản" onDismiss={() => { if (!busy) onClose(); }} className="items-start p-4 sm:p-8">
    <div className="admin-theme my-auto w-full min-w-0 max-w-xl space-y-5 rounded-xl border border-admin-border bg-admin-surface p-5 text-admin-text sm:p-7">
      <header className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="text-xl font-semibold">Thay đổi quyền</h2><p className="mt-2 break-words text-sm">{account.fullName}</p><p className="mt-1 break-all text-sm text-admin-secondary">{account.email}</p></div><Button type="button" onClick={onClose} disabled={busy}>Đóng</Button></header>
      <form className="space-y-4" onSubmit={save}>
        <p className="text-sm leading-6 text-admin-secondary">Đang sử dụng: <strong>{account.effectiveRole ? ROLES[account.effectiveRole].name : 'Chưa có vai trò hoạt động'}</strong>. Vai trò mới sẽ thay thế các quyền nhân sự hiện có; quyền khách hàng được giữ lại.</p>
        <Select id="account-role" label="Vai trò sử dụng" value={role} disabled={busy} onChange={event => { setRole(event.target.value as RoleCode); setConfirmed(false); }}>
          {ROLE_PRIORITY.map(code => <option key={code} value={code} disabled={code !== 'CUSTOMER' && !canGrant}>{ROLES[code].name}</option>)}
        </Select>
        <p className="text-sm leading-6 text-admin-secondary">{ROLE_HELP[role]}</p>
        {!canGrant && <p className="text-sm leading-6 text-admin-warning">Tài khoản chưa đủ điều kiện nhận quyền nhân sự. Bạn vẫn có thể thu hồi quyền về Khách hàng.</p>}
        <label className="block space-y-2 text-sm"><span>Lý do thay đổi</span><textarea className="min-h-24 w-full rounded-md border border-admin-border bg-admin-canvas p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent" required maxLength={2000} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} /></label>
        <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" required checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} className="mt-1" /><span>Tôi xác nhận đổi quyền của <strong className="break-all">{account.email}</strong> sang <strong>{ROLES[role].name}</strong>.</span></label>
        {error && <p role="alert" className="break-words text-sm leading-6 text-admin-danger">{error}</p>}
        <p className="text-xs leading-5 text-admin-muted">Thay đổi được ghi vào lịch sử và có hiệu lực trên yêu cầu tiếp theo của tài khoản.</p>
        <div className="flex flex-wrap justify-end gap-2"><Button type="button" onClick={onClose} disabled={busy}>Hủy</Button><Button type="submit" variant={role === 'ADMIN' ? 'danger' : 'primary'} disabled={busy || !confirmed || !reason.trim() || (role !== 'CUSTOMER' && !canGrant)}>{busy ? 'Đang lưu…' : 'Xác nhận đổi quyền'}</Button></div>
      </form>
    </div>
  </ModalDialog>;
}

export function TelegramAccountDialog({ account, busy, error, onClose, onSave }: {
  account: ManagedAccount;
  busy: boolean;
  error: string;
  onClose(): void;
  onSave(input: LinkTelegramAccount): Promise<void>;
}) {
  const [telegramUserId, setTelegramUserId] = useState(account.telegramUserId ?? '');
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const validId = telegramUserId === '' || /^[1-9][0-9]{0,19}$/.test(telegramUserId);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!confirmed || busy || !validId) return;
    await onSave({ action: 'LINK_TELEGRAM', userId: account.id, telegramUserId: telegramUserId || null,
      expectedTelegramUserId: account.telegramUserId ?? null, reason: reason.trim() });
  }
  return <ModalDialog title="Liên kết Telegram" onDismiss={() => { if (!busy) onClose(); }} className="items-start p-4 sm:p-8">
    <div className="admin-theme my-auto w-full min-w-0 max-w-xl space-y-5 rounded-xl border border-admin-border bg-admin-surface p-5 text-admin-text sm:p-7">
      <header className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="text-xl font-semibold">Liên kết tài khoản Telegram</h2><p className="mt-2 break-words text-sm">{account.fullName}</p><p className="mt-1 break-all text-sm text-admin-secondary">{account.email}</p></div><Button type="button" onClick={onClose} disabled={busy}>Đóng</Button></header>
      <form className="space-y-4" onSubmit={save}>
        <p className="text-sm leading-6 text-admin-secondary">Sau khi liên kết, quyền xác nhận và từ chối chuyển khoản trên Telegram tự động theo vai trò ADMIN của tài khoản website. Thu hồi vai trò hoặc gỡ liên kết sẽ chặn thao tác tiếp theo.</p>
        <Input id="telegram-user-id" label="Telegram user ID cá nhân" inputMode="numeric" value={telegramUserId} disabled={busy} onChange={event => setTelegramUserId(event.target.value.replace(/[^0-9]/g, '').slice(0, 20))} placeholder="Ví dụ: 9042071902" />
        <p className="text-xs leading-5 text-admin-muted">Nhập ID số dương của tài khoản cá nhân. ID nhóm có dấu trừ không dùng được. Để lấy ID cá nhân, mở Telegram với bot quản lý và dùng chức năng xem ID; không nhập tên hiển thị.</p>
        {!validId && <p role="alert" className="text-sm text-admin-danger">ID phải gồm 1–20 chữ số và bắt đầu từ 1.</p>}
        {telegramUserId && account.status !== 'ACTIVE' && <p className="text-sm text-admin-warning">Tài khoản website cần đang hoạt động để liên kết Telegram.</p>}
        <label className="block space-y-2 text-sm"><span>Lý do liên kết hoặc gỡ liên kết</span><textarea className="min-h-24 w-full rounded-md border border-admin-border bg-admin-canvas p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent" required maxLength={2000} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} /></label>
        <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" required checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} className="mt-1" /><span>Tôi xác nhận liên kết này thuộc về <strong className="break-all">{account.email}</strong> và hiểu rằng quyền website sẽ điều khiển các nút đối soát trong nhóm Telegram.</span></label>
        {error && <p role="alert" className="break-words text-sm leading-6 text-admin-danger">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2"><Button type="button" onClick={onClose} disabled={busy}>Hủy</Button><Button type="submit" variant={telegramUserId ? 'primary' : 'danger'} disabled={busy || !confirmed || !reason.trim() || !validId || (Boolean(telegramUserId) && account.status !== 'ACTIVE')}>{busy ? 'Đang lưu…' : telegramUserId ? 'Lưu liên kết' : 'Gỡ liên kết'}</Button></div>
      </form>
    </div>
  </ModalDialog>;
}

export function TeamAccountsManager() {
  const { user, isAuthReady } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [loaded, setLoaded] = useState<{ scope: string; data: ManagedAccountsPage } | null>(null);
  const [loadError, setLoadError] = useState<{ scope: string; message: string } | null>(null);
  const [edit, setEdit] = useState<ManagedAccount | null>(null);
  const [telegramEdit, setTelegramEdit] = useState<ManagedAccount | null>(null);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const writeLock = useRef(false);
  const mutation = useRef<AbortController | null>(null);
  const allowed = isAuthReady && user?.role === 'ADMIN';
  const scope = JSON.stringify([user?.id, page, query, revision]);
  const data = allowed && loaded?.scope === scope ? loaded.data : null;
  const error = loadError?.scope === scope ? loadError.message : '';
  const loading = allowed && !data && !error;

  useEffect(() => {
    if (!isAuthReady) return;
    if (!user) router.replace('/dang-nhap');
    else if (user.role !== 'ADMIN') router.replace('/admin');
  }, [user, isAuthReady, router]);

  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: '25', ...(query ? { q: query } : {}) });
    fetch(`/api/admin/team/accounts?${params}`, { cache: 'no-store', signal: controller.signal }).then(async response => {
      const body: ApiResponse<ManagedAccountsPage> = await response.json();
      if (!response.ok || !body.success) throw new Error(body.success ? 'Không tải được danh sách tài khoản.' : body.error);
      if (!controller.signal.aborted) { setLoaded({ scope, data: body.data }); setLoadError(null); }
    }).catch(cause => {
      if (!controller.signal.aborted) setLoadError({ scope, message: cause instanceof Error ? cause.message : 'Không tải được tài khoản.' });
    });
    return () => controller.abort();
  }, [allowed, page, query, scope]);

  useEffect(() => () => mutation.current?.abort(), [user?.id, user?.role]);

  async function save(input: AssignAccountRole | LinkTelegramAccount) {
    if (writeLock.current) return;
    writeLock.current = true;
    const controller = new AbortController();
    mutation.current = controller;
    setBusy(true); setActionError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/team/accounts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input), signal: controller.signal });
      const body: ApiResponse<{ account: ManagedAccount; unchanged: boolean }> = await response.json();
      if (!response.ok || !body.success) throw new Error(body.success ? 'Không cập nhật được quyền.' : body.error);
      if (!controller.signal.aborted) {
        setNotice('action' in input
          ? body.data.unchanged ? `Liên kết Telegram của ${body.data.account.email} không thay đổi.` : `Đã cập nhật Telegram cho ${body.data.account.email}.`
          : body.data.unchanged ? `Tài khoản ${body.data.account.email} đã có vai trò được chọn.` : `Đã đổi quyền ${body.data.account.email} sang ${ROLES[input.role].name}.`);
        setEdit(null); setTelegramEdit(null); setRevision(value => value + 1);
      }
    } catch (cause) {
      if (!controller.signal.aborted) setActionError(cause instanceof Error ? cause.message : 'Không cập nhật được quyền.');
    } finally { writeLock.current = false; setBusy(false); }
  }

  if (!allowed) return <p role="status" className="px-4 py-16 text-sm text-[#A5ADB8]">Đang kiểm tra quyền quản trị…</p>;
  return <main className="admin-theme min-h-[75vh] bg-admin-canvas text-admin-text"><div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-8">
    <header className="space-y-3"><Link href="/admin" className="inline-flex min-h-10 items-center text-sm text-admin-accent">← Bàn quản trị</Link><h1 className="text-2xl font-semibold sm:text-3xl">Tài khoản & phân quyền</h1><p className="max-w-3xl text-sm leading-6 text-admin-secondary">ADMIN cấp vai trò trên website và liên kết Telegram ID một lần tại từng tài khoản. Từ đó, quyền ADMIN hiện có sẽ điều khiển xác nhận chuyển khoản trong Telegram; thu hồi vai trò sẽ chặn thao tác.</p></header>
    <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={event => { event.preventDefault(); setQuery(search.trim()); setPage(1); setRevision(value => value + 1); setNotice(''); }}>
      <div className="min-w-0 flex-1"><Input id="team-search" label="Tìm tài khoản theo tên hoặc email" maxLength={100} value={search} onChange={event => setSearch(event.target.value)} placeholder="Tên hoặc email đã đăng ký" /></div><Button type="submit" disabled={busy}>Tìm tài khoản</Button><Button type="button" disabled={busy} onClick={() => { setEdit(null); setTelegramEdit(null); setActionError(''); setRevision(value => value + 1); }}>Tải lại</Button>
    </form>
    {notice && <p role="status" className="break-words text-sm leading-6 text-admin-success">{notice}</p>}
    {error && <p role="alert" className="text-sm text-admin-danger">{error}</p>}
    {loading ? <p role="status" className="py-8 text-sm text-admin-secondary">Đang tải tài khoản…</p> : data && !data.data.length ? <p role="status" className="rounded-lg border border-admin-border p-5 text-sm text-admin-secondary">Không tìm thấy tài khoản. Người dùng cần đăng ký trước khi được phân quyền.</p> : data && <ul className="divide-y divide-admin-border rounded-xl border border-admin-border bg-admin-surface px-4 sm:px-6">
      {data.data.map(account => { const canConfirm = account.status === 'ACTIVE' && (!data.requireVerifiedEmail || account.emailVerified) && Boolean(account.telegramUserId) && (account.effectiveRole === 'ADMIN'); return <li key={account.id} className="flex flex-wrap items-start justify-between gap-4 py-5"><div className="min-w-0 flex-1 space-y-2"><p className="break-words font-medium">{account.fullName}{account.id === user!.id && <span className="ml-2 text-xs text-admin-muted">Tài khoản của bạn</span>}</p><p className="break-all text-sm text-admin-secondary">{account.email}</p><div className="flex flex-wrap gap-2"><StatusBadge tone={account.status === 'ACTIVE' ? 'success' : 'warning'}>{STATUS_LABEL[account.status] ?? account.status}</StatusBadge><StatusBadge tone={account.effectiveRole === 'ADMIN' ? 'accent' : 'neutral'}>{account.effectiveRole ? ROLES[account.effectiveRole].name : 'Chưa có vai trò hoạt động'}</StatusBadge><StatusBadge tone={account.emailVerified ? 'neutral' : 'warning'}>{account.emailVerified ? 'Email đã xác minh' : 'Email chưa xác minh'}</StatusBadge><StatusBadge tone={canConfirm ? 'success' : 'warning'}>{canConfirm ? 'Được đối soát Telegram' : 'Chưa có quyền đối soát Telegram'}</StatusBadge></div>{account.telegramUserId && <p className="break-all font-mono text-xs text-admin-secondary">Telegram ID · {account.telegramUserId}</p>}</div><div className="flex flex-wrap gap-2"><Button type="button" disabled={busy || account.id === user!.id} onClick={() => { setActionError(''); setEdit(account); }}>Đổi quyền</Button><Button type="button" disabled={busy} onClick={() => { setActionError(''); setEdit(null); setTelegramEdit(account); }}>{account.telegramUserId ? 'Sửa Telegram' : 'Liên kết Telegram'}</Button></div></li>; })}
    </ul>}
    {data && <ListPagination variant="admin" pagination={data.pagination} isLoading={loading || busy} onPageChange={setPage} />}
    {edit && <AccountRoleDialog key={edit.id} account={edit} requireVerifiedEmail={data?.requireVerifiedEmail ?? true} busy={busy} error={actionError} onClose={() => { if (!busy) setEdit(null); }} onSave={save} />}
    {telegramEdit && <TelegramAccountDialog key={`telegram-${telegramEdit.id}`} account={telegramEdit} busy={busy} error={actionError} onClose={() => { if (!busy) setTelegramEdit(null); }} onSave={save} />}
  </div></main>;
}

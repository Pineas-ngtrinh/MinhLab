'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { ApiResponse } from '../../../contracts/api';
import type { ProductionPlan, ProductionWorkspace } from '../../../contracts/production';
import type { RoleCode } from '../../../lib/auth-roles';
import { shortOrderNumber } from '../../../lib/format';
import { eligible } from '../../../domain/production/planning';
import { DeletePlanButton, JobCard } from './ProductionPanels';
import { StatusBadge } from '../ui';

const button = 'min-h-11 rounded-lg border border-[#27313C] px-4 py-2 text-sm focus-visible:ring-2 focus-visible:ring-admin-accent disabled:cursor-wait disabled:opacity-40';
const localDate = (value: string) => new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
const planStatus: Record<string, string> = {
  WAITING_DATA: 'Thiếu dữ liệu',
  PENDING_APPROVAL: 'Chờ nhân viên duyệt',
  APPROVED: 'Đã phân công',
  REJECTED: 'Đã từ chối',
  STALE: 'Dữ liệu thay đổi · cần tính lại',
  SUPERSEDED: 'Đã thay bằng kế hoạch mới',
};

function planTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' | 'accent' {
  if (status === 'APPROVED') return 'success';
  if (status === 'REJECTED') return 'danger';
  if (status === 'WAITING_DATA' || status === 'STALE') return 'warning';
  if (status === 'PENDING_APPROVAL') return 'accent';
  return 'neutral';
}

export function ProductionDecisionInbox({ role }: { role: RoleCode }) {
  const [data, setData] = useState<ProductionWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const lock = useRef(false);
  const retry = useRef<{ payload: string; key: string } | null>(null);
  const canRequestPlan = role === 'ADMIN' || role === 'WORKSHOP_OPERATOR';
  const canDecide = canRequestPlan || role === 'PRINT_OPERATOR';

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const response = await fetch('/api/workshop/production', { cache: 'no-store', signal });
      const body: ApiResponse<ProductionWorkspace> = await response.json();
      if (!response.ok || !body.success)
        throw new Error(body.success ? 'Không tải được hàng đợi sản xuất.' : body.error);
      if (!signal?.aborted) {
        setData(body.data);
        setError('');
      }
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : 'Không tải được hàng đợi.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const initialLoad = window.setTimeout(() => void load(controller.signal), 0);
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 30_000);
    return () => {
      controller.abort();
      window.clearTimeout(initialLoad);
      window.clearInterval(interval);
    };
  }, [load]);

  async function send(input: Record<string, unknown>, successMessage: string) {
    if (lock.current) return false;
    lock.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    const payload = JSON.stringify(input);
    if (retry.current?.payload !== payload)
      retry.current = { payload, key: crypto.randomUUID() };
    try {
      const response = await fetch('/api/workshop/production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': retry.current.key },
        body: payload,
      });
      const body: ApiResponse<{ status?: string; explanation?: string }> = await response.json();
      if (!response.ok || !body.success)
        throw new Error(body.success ? 'Không thể cập nhật kế hoạch.' : body.error);
      retry.current = null;
      setNotice(body.data.status === 'STALE' ? 'Dữ liệu đã thay đổi; hãy tính lại kế hoạch.' : body.data.explanation ?? successMessage);
      await load();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể cập nhật kế hoạch.');
      return false;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  if (loading && !data) return <section className="py-5 text-sm text-[#A5ADB8]" aria-label="Lập kế hoạch đơn hàng">Đang tải kế hoạch sản xuất…</section>;
  if (!data) return <section className="space-y-3 rounded-xl border border-[#27313C] p-4" aria-label="Lập kế hoạch đơn hàng"><h2 className="font-semibold">Đề xuất mẻ in</h2><p role="alert" className="text-sm text-[#FFB0A7]">{error || 'Không tải được dữ liệu xưởng.'}</p><button type="button" className={button} onClick={() => void load()}>Thử lại</button></section>;

  const workspace = data;
  const pendingItems = workspace.items.filter((item) => eligible(item) && !item.groupId && !item.packedAt && !item.dispatchReadyAt);
  const orders = new Map<string, typeof pendingItems>();
  for (const item of pendingItems) orders.set(item.orderNumber, [...(orders.get(item.orderNumber) ?? []), item]);
  const reviewPlans = workspace.plans.filter((plan) => ['WAITING_DATA', 'PENDING_APPROVAL'].includes(plan.status));
  const activeJobs = workspace.jobs.filter((job) => !['COMPLETED', 'CANCELLED'].includes(job.status));
  const revisionTasks = workspace.revisions.filter((revision) => revision.status === 'DRAFT'
    && (((role === 'PRINT_OPERATOR' || role === 'WORKSHOP_OPERATOR') && !revision.verifiedBy) || (role === 'ADMIN' && !!revision.verifiedBy)));

  function blockerText(code: string) {
    const [kind, ...details] = code.split(':');
    const labels: Record<string, string> = {
      BOM_NOT_PUBLISHED: 'Chưa có định mức linh kiện sản phẩm được công bố',
      COMPONENT_NOT_PUBLISHED: 'Linh kiện chưa được duyệt',
      INVENTORY_UNKNOWN: 'Chưa kiểm kê tồn kho',
      TECHNICAL_CHECK_REQUIRED: 'Chưa có mẻ in được nhân viên xác nhận',
      ACCESSORY_WAITING: 'Thiếu linh kiện mua ngoài hoặc đã hoàn thiện',
      MACHINE_WAITING: 'Máy in không khả dụng hoặc đang dành cho mẻ khác',
      MATERIAL_SHORTAGE: 'Không đủ vật liệu đã kiểm tra',
      CHECK_QUANTITY_MISMATCH: 'Số lượng trong mẻ đã xác nhận không khớp nhu cầu',
      PROFILE_INCOMPATIBLE: 'Cấu hình máy in không phù hợp với linh kiện',
      SCHEDULE_CONFLICT: 'Lịch máy in bị trùng',
      GROUP_CONFLICT: 'Các mặt hàng thuộc nhóm máy in được giữ chỗ khác nhau',
      ORDER_INELIGIBLE: 'Đơn không còn đủ điều kiện sản xuất',
    };
    const refs = details.map((value) => {
      const revision = workspace.revisions.find((candidate) => candidate.id === value);
      const printer = workspace.printers.find((candidate) => candidate.id === value);
      const variant = workspace.variants.find((candidate) => candidate.id === value || candidate.sku === value);
      return revision?.kind === 'COMPONENT' ? revision.body.name : revision?.code
        ?? printer?.name ?? variant?.name ?? value;
    });
    if (kind === 'INVENTORY_UNKNOWN' || kind === 'MATERIAL_SHORTAGE') {
      const [stockKind, reference] = details;
      if (stockKind === 'material') return kind === 'INVENTORY_UNKNOWN' ? 'Chưa kiểm kê vật liệu' : 'Không đủ vật liệu đã kiểm tra';
      if (stockKind === 'component') {
        const component = workspace.revisions.find((revision) => revision.id === reference && revision.kind === 'COMPONENT');
        const name = component?.kind === 'COMPONENT' ? component.body.name : 'linh kiện';
        return kind === 'INVENTORY_UNKNOWN' ? `Chưa kiểm kê · ${name}` : `Tồn kho không đủ · ${name}`;
      }
      if (stockKind === 'finished') {
        const product = workspace.variants.find((variant) => variant.id === reference);
        const name = product?.name ?? 'sản phẩm hoàn thiện';
        return kind === 'INVENTORY_UNKNOWN' ? `Chưa kiểm kê · ${name}` : `Tồn kho không đủ · ${name}`;
      }
    }
    return `${labels[kind] ?? kind}${refs.length ? ` · ${refs.join(', ')}` : ''}`;
  }

  function orderLabel(itemId: string) {
    const item = workspace.items.find((candidate) => candidate.id === itemId);
    const variant = item && workspace.variants.find((candidate) => candidate.id === item.variantId);
    return item ? `Đơn ${shortOrderNumber(item.orderNumber)} · ${variant?.name ?? item.sku}` : 'Đơn hàng';
  }

  function componentName(revisionId: string) {
    const revision = workspace.revisions.find((candidate) => candidate.id === revisionId);
    return revision?.kind === 'COMPONENT' ? revision.body.name : 'Linh kiện';
  }

  function renderPlanReview(plan: ProductionPlan) {
    const includedOrders = new Set(plan.body.itemIds.map((itemId) => workspace.items.find((item) => item.id === itemId)?.orderId).filter(Boolean));
    return <article key={`${plan.id}:${plan.revision}`} className="space-y-4 rounded-xl border border-[#27313C] bg-[#111216] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Kế hoạch {plan.revision}</h3>
        <StatusBadge tone={planTone(plan.status)}>{planStatus[plan.status] ?? 'Trạng thái khác'}</StatusBadge>
      </div>
      <p className="text-sm leading-6 text-[#A5ADB8]">{plan.body.blockers.length > 0
        ? plan.body.jobs.length > 0
          ? `Đã đề xuất ${plan.body.jobs.length} mẻ cho ${includedOrders.size} đơn; còn ${plan.body.blockers.length} mục cần xử lý trước khi duyệt.`
          : `Chưa đề xuất được mẻ nào cho ${includedOrders.size} đơn. Cần xử lý ${plan.body.blockers.length} mục bên dưới trước khi duyệt.`
        : plan.body.jobs.length > 0
          ? `Kế hoạch gồm ${plan.body.jobs.length} mẻ in cho ${includedOrders.size} đơn. Các linh kiện tương thích được gom chung; từng đơn vẫn hoàn tất theo thứ tự khách đặt.`
          : `Không cần tạo mẻ in; dữ liệu cho ${includedOrders.size} đơn được đáp ứng bằng tồn kho.`}</p>
      <ul className="space-y-1 text-sm text-[#A5ADB8]">
        {plan.body.itemIds.map((itemId) => <li key={itemId}>{orderLabel(itemId)}</li>)}
      </ul>
      {plan.body.jobs.map((job, index) => <div key={`${job.checkId}:${index}`} className="space-y-2 border-t border-[#27313C] pt-3 text-sm">
        <p><strong>{workspace.printers.find((printer) => printer.id === job.printerId)?.name ?? 'Máy in'}</strong> · {localDate(job.startAt)} – {localDate(job.finishAt)}</p>
        <p className="text-[#A5ADB8]">Mẻ in đã xác nhận: {workspace.checks.find((check) => check.id === job.checkId)?.code ?? 'Chưa xác định'}</p>
        <ul className="space-y-1 text-[#A5ADB8]">
          {job.allocations.map((allocation, allocationIndex) => <li key={`${allocation.itemId}:${allocation.componentRevisionId}:${allocationIndex}`}>
            {orderLabel(allocation.itemId)} → {componentName(allocation.componentRevisionId)} × {allocation.quantity}
          </li>)}
        </ul>
      </div>)}
      {plan.body.stocks.length > 0 && <p className="text-sm text-[#A5ADB8]">Dùng hàng tồn kho: {plan.body.stocks.map((stock) => `${orderLabel(stock.itemId)} × ${stock.quantity}`).join(' · ')}</p>}
      {plan.body.blockers.length > 0 && <div className="rounded-lg border border-[#EB4037]/30 bg-[#EB4037]/5 p-3"><p className="mb-2 text-sm font-medium text-[#FFB0A7]">Chưa thể duyệt</p><ul className="list-inside list-disc space-y-1 text-sm text-[#FFB0A7]">{plan.body.blockers.map((blocker, index) => <li key={`${blocker}:${index}`}>{blockerText(blocker)}</li>)}</ul></div>}
      {plan.body.warnings.length > 0 && <ul className="space-y-1 text-xs text-[#C8A261]">{plan.body.warnings.map((warning, index) => <li key={`${warning}:${index}`}>{warning.startsWith('NO_DUE_DATE:') ? 'Chưa có ngày giao đã xác nhận; kế hoạch ưu tiên đơn đặt trước.' : warning}</li>)}</ul>}
      {canDecide && ['WAITING_DATA', 'PENDING_APPROVAL'].includes(plan.status) && <div className="space-y-3 border-t border-[#27313C] pt-3">
        {plan.status === 'PENDING_APPROVAL' && plan.body.blockers.length === 0 && <button type="button" className={`${button} border-admin-accent bg-admin-accent font-semibold text-white hover:bg-admin-accent-hover`} disabled={busy} onClick={() => void send({ action: 'APPROVE', id: plan.id, revision: plan.revision, note: 'Nhân viên đã duyệt kế hoạch sản xuất.' }, 'Đã duyệt kế hoạch. Mẻ in, phân công và vật liệu đã được giữ chỗ.')}>Duyệt và phân công đơn</button>}
        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const note = String(form.get('note') ?? '').trim(); if (note) void send({ action: 'REJECT', id: plan.id, revision: plan.revision, note }, 'Đã từ chối kế hoạch. Đơn hàng và nguồn lực chưa được phân công.'); }}>
          <input name="note" aria-label="Lý do yêu cầu sửa kế hoạch" required maxLength={1000} className="min-h-11 min-w-0 flex-1 rounded-lg border border-[#27313C] bg-[#08090C] px-3 text-sm" placeholder="Cho biết nội dung cần thay đổi" />
          <button type="submit" className={button} disabled={busy}>Yêu cầu sửa kế hoạch</button>
        </form>
      </div>}
      <DeletePlanButton plan={plan} canDelete={role === 'ADMIN'} busy={busy} actionError={error} send={(input) => send(input as Record<string, unknown>, 'Đã xóa kế hoạch. Các đơn hàng vẫn được giữ lại để lập kế hoạch mới.')} />
      {plan.status === 'APPROVED' && <p className="text-sm text-[#A5ADB8]">Đơn đã được phân công và nguồn lực được giữ chỗ. Nhân viên ghi nhận thời điểm bắt đầu khi máy thực sự chạy.</p>}
    </article>;
  }

  return <section className="space-y-4 rounded-lg border border-admin-border bg-admin-surface p-4 sm:p-5" aria-label="Điều phối và duyệt mẻ in">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-2"><h2 className="flex flex-wrap items-center gap-2 text-base font-semibold">Lập kế hoạch in <StatusBadge>{orders.size} đơn đang chờ</StatusBadge></h2><p className="max-w-2xl text-sm leading-6 text-admin-secondary">Xem cách gom mẻ và máy được đề xuất, rồi duyệt để phân công. Nhân viên ghi nhận thời điểm bắt đầu khi máy thực sự chạy.</p></div>
      <button type="button" className={button} disabled={loading || busy} onClick={() => void load()}>Làm mới</button>
    </header>
    {(error || notice) && <p role={error ? 'alert' : 'status'} className={`text-sm ${error ? 'text-[#FFB0A7]' : 'text-admin-success'}`}>{error || notice}</p>}
    <div className="border-t border-admin-border pt-4 text-sm">
      <p className="font-medium">Lập kế hoạch in: {workspace.agent.status === 'CONFIGURED' ? 'AI hỗ trợ đang bật' : 'bộ tối ưu nội bộ đang chạy'}</p>
      <p className="mt-1 leading-6 text-[#A5ADB8]">{workspace.agent.message}</p>
      {canRequestPlan && pendingItems.length > 0 && <button type="button" className={`${button} mt-3 border-admin-accent text-admin-accent hover:bg-admin-accent-soft`} disabled={busy} onClick={() => { const itemIds = pendingItems.map((item) => item.id); const startAt = new Date(Date.parse(workspace.serverTime) + 60 * 60 * 1000).toISOString(); void send({ action: 'RUN_AGENT', itemIds, startAt }, 'Đã tạo kế hoạch in, đang chờ nhân viên duyệt.'); }}>Lập kế hoạch in cho {orders.size} đơn</button>}
      {pendingItems.some((item) => !item.bomRevisionId) && <p className="mt-2 text-xs leading-5 text-[#A5ADB8]">Sản phẩm còn thiếu định mức linh kiện. Hệ thống liệt kê dữ liệu cần bổ sung và không tự suy đoán linh kiện.</p>}
    </div>
    {pendingItems.length > 0 ? <div className="space-y-3"><h3 className="text-sm font-medium text-admin-secondary">Đơn trong hàng chờ</h3><ul className="grid gap-4 sm:grid-cols-2">{[...orders.entries()].map(([number, items]) => <li key={number} className="border-l-2 border-admin-border pl-3"><p className="font-mono text-sm font-semibold text-admin-text" title={number}>Đơn {shortOrderNumber(number)}</p><ul className="mt-2 space-y-2 text-sm text-admin-secondary">{items.map((item) => { const variant = workspace.variants.find((candidate) => candidate.id === item.variantId); return <li key={item.id}><span>{variant?.name ?? item.sku} × {item.quantity}</span><span className={`mt-1 block text-xs ${item.bomRevisionId ? 'text-admin-muted' : 'text-admin-warning'}`}>{item.bomRevisionId ? 'Đã có định mức' : 'Cần bổ sung định mức linh kiện'}</span></li>; })}</ul></li>)}</ul></div> : <p className="py-4 text-sm text-admin-secondary">Không có đơn mới cần lập kế hoạch in.</p>}
    {(role === 'ADMIN' || role === 'WORKSHOP_OPERATOR') && pendingItems.some((item) => !item.bomRevisionId) && <Link href="/admin/san-pham" className="inline-flex min-h-11 items-center rounded-lg border border-[#27313C] px-4 py-2 text-sm text-admin-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent">Thiết lập định mức linh kiện cho sản phẩm</Link>}
    {revisionTasks.length > 0 && <div className="space-y-3 rounded-xl border border-[#27313C] bg-[#111216] p-4"><div><h3 className="font-semibold">Dữ liệu sản xuất chờ xác nhận</h3><p className="mt-1 text-sm text-[#A5ADB8]">Định mức linh kiện và cấu hình sản xuất chỉ áp dụng cho đơn mới sau khi được xác nhận và công bố.</p></div>{revisionTasks.map((revision) => {
      const name = revision.kind === 'BOM'
        ? `Định mức linh kiện · ${workspace.variants.find((variant) => variant.id === revision.variantId)?.sku ?? 'Mã biến thể chưa rõ'}`
        : revision.kind === 'COMPONENT' ? `Linh kiện · ${revision.body.name}` : `Cấu hình · ${revision.body.name}`;
      return <div key={revision.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-[#27313C] pt-3"><div><p className="text-sm">{name}</p><p className="mt-1 text-xs text-[#A5ADB8]">{revision.code} · phiên bản {revision.revision}</p></div>{role === 'PRINT_OPERATOR' || role === 'WORKSHOP_OPERATOR' ? <button type="button" className={button} disabled={busy} onClick={() => void send({ action: 'VERIFY', id: revision.id }, 'Đã ghi nhận kiểm tra kỹ thuật. Quản trị viên có thể công bố cho đơn mới.')}>Xác nhận kiểm tra kỹ thuật</button> : <button type="button" className={button} disabled={busy} onClick={() => void send({ action: 'PUBLISH', id: revision.id }, 'Đã công bố. Đơn mới sẽ dùng định mức này.')}>Công bố cho đơn mới</button>}</div>;
    })}</div>}
    {reviewPlans.length > 0 && <div className="space-y-3"><h3 className="font-semibold">Kế hoạch chờ duyệt</h3>{reviewPlans.map(renderPlanReview)}</div>}
    {activeJobs.length > 0 && <div className="space-y-2"><h3 className="font-semibold">Đơn đã phân công · mẻ in đang chạy</h3>{activeJobs.map((job) => <JobCard key={job.id} job={job} data={workspace} send={(input) => send(input as Record<string, unknown>, 'Đã cập nhật mẻ in.')} busy={busy} operator={role === 'PRINT_OPERATOR' || role === 'WORKSHOP_OPERATOR'} />)}</div>}
    {reviewPlans.length === 0 && pendingItems.length > 0 && (role === 'PRINT_OPERATOR' || role === 'WORKSHOP_OPERATOR') && <p className="text-sm text-[#A5ADB8]">Chưa có kế hoạch nào sẵn sàng để duyệt. Đơn vẫn trong hàng chờ lập kế hoạch; không cần tự xếp lịch từng đơn.</p>}
  </section>;
}

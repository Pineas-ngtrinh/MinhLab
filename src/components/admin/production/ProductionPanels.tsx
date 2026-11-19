'use client';
import { useState } from 'react';
import type { ProductionWorkspace, ProductionPlan, ProductionJob } from '../../../contracts/production';
import { BUTTON, INPUT, Field, type Command } from './ProductionForms';
import { StatusBadge } from '../ui';
import { ModalDialog } from '../../common/ModalDialog';
import { canDeleteProductionPlan } from '../../../domain/production/plan-policy';
export const STATUS: Record<string, string> = { WAITING_DATA: 'Chờ bổ sung dữ liệu', PENDING_APPROVAL: 'Chờ duyệt', APPROVED: 'Đã duyệt', REJECTED: 'Đã từ chối', STALE: 'Cần tính lại', SUPERSEDED: 'Đã thay thế', QUEUED: 'Đang chờ', PRINTING: 'Đang in', POST_PROCESSING: 'Đang hoàn thiện sau in', QC_PENDING: 'Chờ kiểm tra chất lượng', COMPLETED: 'Đạt kiểm tra chất lượng', FAILED: 'Sản phẩm lỗi', CANCELLED: 'Đã hủy' };
function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' | 'accent' {
    if (status === 'APPROVED' || status === 'COMPLETED') return 'success';
    if (status === 'REJECTED' || status === 'FAILED' || status === 'CANCELLED') return 'danger';
    if (status === 'WAITING_DATA' || status === 'PENDING_APPROVAL' || status === 'STALE' || status === 'QC_PENDING') return 'warning';
    if (status === 'QUEUED' || status === 'PRINTING' || status === 'POST_PROCESSING') return 'accent';
    return 'neutral';
}
const date = (v: string) => new Date(v).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
export function blockerLabel(code: string, data: ProductionWorkspace) {
    const [kind, ...detail] = code.split(':');
    const text: Record<string, string> = { BOM_NOT_PUBLISHED: 'Định mức linh kiện chưa được xác nhận và công bố', COMPONENT_NOT_PUBLISHED: 'Linh kiện chưa được công bố hoặc đã thu hồi', INVENTORY_UNKNOWN: 'Tồn kho chưa được kiểm tra', ACCESSORY_WAITING: 'Chờ phụ kiện hoặc công đoạn hoàn thiện', TECHNICAL_CHECK_REQUIRED: 'Số lượng còn lại cần được kiểm tra kỹ thuật', CHECK_QUANTITY_MISMATCH: 'Số lượng mẻ in không khớp nhu cầu còn lại', MACHINE_WAITING: 'Máy in không khả dụng hoặc được giữ cho nhóm khác', MATERIAL_SHORTAGE: 'Không đủ vật liệu đã xác nhận', SCHEDULE_CONFLICT: 'Lịch máy in bị trùng', ORDER_INELIGIBLE: 'Đơn không còn đủ điều kiện', GROUP_CONFLICT: 'Các mặt hàng thuộc nhóm máy in được giữ chỗ khác nhau', PROFILE_NOT_PUBLISHED: 'Cấu hình máy in chưa được công bố', PROFILE_INCOMPATIBLE: 'Cấu hình máy in không phù hợp với mẻ', CHECK_UNAVAILABLE: 'Xác nhận mẻ in không còn hiệu lực', NO_UNCOVERED_DEMAND: 'Không còn nhu cầu cần phân công' };
    const pretty = detail.map(v => data.revisions.find(r => r.id === v)?.code ?? data.printers.find(p => p.id === v)?.code ?? data.variants.find(p => p.id === v)?.sku ?? ({ finished: 'sản phẩm hoàn thiện', component: 'linh kiện', material: 'vật liệu' } as Record<string, string>)[v] ?? v).join(' · ');
    return `${text[kind] ?? 'Vướng mắc chưa được phân loại'}${pretty ? ` · ${pretty}` : ''}`;
}
export function PlanCard({ plan, data, send, busy, canApprove, canDecide = canApprove, canDelete = false, actionError = '', onEdit }: {
    plan: ProductionPlan;
    data: ProductionWorkspace;
    send: Command;
    busy: boolean;
    canApprove: boolean;
    canDecide?: boolean;
    canDelete?: boolean;
    actionError?: string;
    onEdit: () => void;
}) {
    const [note, setNote] = useState('');
    const decisionNote = plan.decisionNote === 'Được thay bằng revision nháp mới.'
        ? 'Được thay bằng phiên bản nháp mới.'
        : plan.decisionNote;
    return <article className="space-y-4 border-t border-[#27313C] py-6"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold">Kế hoạch {plan.id.slice(0, 8)} · r{plan.revision}</h3><StatusBadge tone={statusTone(plan.status)}>{STATUS[plan.status] ?? 'Trạng thái khác'}</StatusBadge></div><p className="text-sm text-[#A5ADB8]">{plan.body.itemIds.length} mặt hàng · {plan.body.jobs.length} mẻ in · {plan.body.stocks.reduce((n, x) => n + x.quantity, 0)} đơn vị lấy từ tồn kho</p>{plan.body.jobs.map((j, i) => <p key={i} className="text-sm leading-6">{data.printers.find(p => p.id === j.printerId)?.code} · {data.checks.find(c => c.id === j.checkId)?.code} · {date(j.startAt)} → {date(j.finishAt)}<br /><span className="text-[#A5ADB8]">Dự kiến chuyển sang đóng gói: {date(j.packingAt)}; máy vẫn được giữ chỗ đến khi bàn giao thực tế.</span></p>)}{plan.body.blockers.length > 0 && <ul className="space-y-2 text-sm leading-6 text-[#FFB0A7]">{plan.body.blockers.map((b, i) => <li className="break-words" key={i}>{blockerLabel(b, data)}</li>)}</ul>}<p className="text-sm text-[#A5ADB8]">Chưa có ngày giao được xác nhận. Đơn được ưu tiên theo thời điểm khách đặt trước; đây là lịch tạm tính dựa trên các mẻ in đã kiểm tra.</p>{decisionNote && <p className="text-sm">Ghi chú quyết định: {decisionNote}</p>}
 {(canApprove || canDecide) && ['WAITING_DATA', 'PENDING_APPROVAL', 'STALE', 'REJECTED'].includes(plan.status) && <div className="space-y-3">{canApprove && <button className={BUTTON} disabled={busy} onClick={onEdit}>Sửa và gửi phiên bản mới</button>}{canDecide && ['WAITING_DATA', 'PENDING_APPROVAL'].includes(plan.status) && <form className="space-y-3" onSubmit={e => { e.preventDefault(); void send({ action: 'APPROVE', id: plan.id, revision: plan.revision, note }); }}><Field label="Ghi chú / lý do quyết định"><input className={INPUT} required value={note} onChange={e => setNote(e.target.value)} maxLength={1000}/></Field><div className="flex flex-wrap gap-3"><button className={`${BUTTON} bg-[#EB4037] text-white`} type="submit" disabled={busy || plan.status !== 'PENDING_APPROVAL'}>Duyệt và giữ chỗ nguồn lực</button><button className={BUTTON} type="button" disabled={busy || !note.trim()} onClick={() => void send({ action: 'REJECT', id: plan.id, revision: plan.revision, note })}>Từ chối và nêu lý do</button></div></form>}</div>}
 <DeletePlanButton plan={plan} canDelete={canDelete} send={send} busy={busy} actionError={actionError}/></article>;
}
export function DeletePlanButton({ plan, canDelete, send, busy, actionError = '' }: {
    plan: Pick<ProductionPlan, 'id' | 'revision' | 'status'>;
    canDelete: boolean;
    send: Command;
    busy: boolean;
    actionError?: string;
}) {
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [deleteFailed, setDeleteFailed] = useState(false);
    if (!canDelete || !canDeleteProductionPlan(plan.status)) return null;
    return <> <button type="button" className={`${BUTTON} border-[#7C3937] text-[#FF8179]`} disabled={busy} onClick={() => { setDeleteFailed(false); setConfirmDelete(true); }}>Xóa kế hoạch</button>
 {confirmDelete && <ModalDialog title="Xóa kế hoạch in?" onDismiss={() => { if (!busy) setConfirmDelete(false); }}>
   <section className="w-full max-w-lg space-y-4 rounded-xl border border-[#27313C] bg-[#141A21] p-6">
     <h3 className="text-lg font-semibold">Xóa kế hoạch {plan.id.slice(0, 8)}?</h3>
     <p className="text-sm leading-6 text-[#A5ADB8]">Kế hoạch sẽ được gỡ khỏi danh sách. Các đơn hàng vẫn được giữ lại để lập kế hoạch mới; nhật ký thao tác được lưu.</p>
     {deleteFailed && <p role="alert" className="text-sm text-[#FF8179]">{actionError || 'Chưa thể xóa kế hoạch. Hãy tải lại dữ liệu và thử lại.'}</p>}
     <div className="flex flex-wrap justify-end gap-3">
       <button type="button" className={BUTTON} disabled={busy} onClick={() => setConfirmDelete(false)}>Quay lại</button>
       <button type="button" className={`${BUTTON} bg-[#EB4037] text-white`} disabled={busy} onClick={() => { void send({ action: 'DELETE_PLAN', id: plan.id, revision: plan.revision }).then(ok => { if (ok) setConfirmDelete(false); else setDeleteFailed(true); }); }}>{busy ? 'Đang xóa…' : 'Xóa kế hoạch'}</button>
     </div>
   </section>
 </ModalDialog>}</>;
}
export function JobCard({ job, data, send, busy, operator }: {
    job: ProductionJob;
    data: ProductionWorkspace;
    send: Command;
    busy: boolean;
    operator: boolean;
}) {
    const [good, setGood] = useState<Record<string, string>>({});
    const [machineFailure, setMachineFailure] = useState(false);
    const actions: Record<string, {
        action: string;
        label: string;
    }> = { QUEUED: { action: 'START', label: 'Ghi nhận giờ bắt đầu thực tế' }, PRINTING: { action: 'FINISH', label: 'Ghi nhận hoàn tất in' }, POST_PROCESSING: { action: 'QC_READY', label: 'Hoàn thiện sau in và chuyển kiểm tra chất lượng' } };
    const next = actions[job.status];
    return <article className="space-y-4 border-t border-[#27313C] py-6"><div className="flex flex-wrap justify-between gap-3"><h3 className="font-mono text-sm">Mẻ in {job.id.slice(0, 8)} · {data.printers.find(p => p.id === job.printerId)?.code}</h3><StatusBadge tone={statusTone(job.status)}>{STATUS[job.status] ?? 'Trạng thái khác'}</StatusBadge></div><p className="text-sm text-[#A5ADB8]">{job.actualStartAt ? `Bắt đầu thực tế: ${date(job.actualStartAt)}` : `Bắt đầu dự kiến: ${date(job.startAt)}`}</p><ul className="space-y-2 text-sm">{job.supplies.map(a => <li key={a.id}>{data.items.find(i => i.id === a.itemId)?.orderNumber ?? a.itemId.slice(0, 8)} · {data.revisions.find(r => r.id === a.componentRevisionId)?.code} · {a.quantity} đơn vị{a.inspectedAt ? ` · ${a.good} đạt, ${a.failed} lỗi` : ''}</li>)}</ul>
 {operator && next && <button className={BUTTON} disabled={busy} onClick={() => void send({ action: next.action, id: job.id })}>{next.label}</button>}
 {operator && job.status === 'PRINTING' && <div className="flex flex-wrap items-center gap-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={machineFailure} onChange={e => setMachineFailure(e.target.checked)}/>Máy gặp sự cố, cần bảo trì</label><button className={BUTTON} disabled={busy} onClick={() => void send({ action: 'FAIL', id: job.id, machineFailure })}>Ghi nhận mẻ lỗi và giữ máy để bảo trì</button></div>}
 {operator && job.status === 'QC_PENDING' && <form className="space-y-3" onSubmit={e => { e.preventDefault(); void send({ action: 'QC', id: job.id, results: job.supplies.map(a => ({ supplyId: a.id, good: Number(good[a.id]), failed: a.quantity - Number(good[a.id]) })) }); }}><p className="text-sm">Ghi số lượng đạt cho từng phần phân bổ. Số còn lại bị lỗi và cần kế hoạch in lại được duyệt.</p>{job.supplies.map((a, i) => <Field key={a.id} label={`Linh kiện ${i + 1} · ${data.revisions.find(r => r.id === a.componentRevisionId)?.code} · tối đa ${a.quantity}`}><input className={INPUT} required type="number" min="0" max={a.quantity} step="1" value={good[a.id] ?? ''} onChange={e => setGood({ ...good, [a.id]: e.target.value })}/></Field>)}<button type="submit" className={BUTTON} disabled={busy}>Lưu kết quả kiểm tra chất lượng thực tế</button></form>}</article>;
}

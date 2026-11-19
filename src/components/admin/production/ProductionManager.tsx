'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';
import type { ProductionWorkspace, Revision, Printer, ProductionPlan } from '../../../contracts/production';
import type { ApiResponse } from '../../../contracts/api';
import { hasEarlierUnfinishedOrder } from '../../../domain/production/planning';
import { BUTTON, INPUT, Field, RevisionForm, PrinterForm, InventoryForm, CheckForm } from './ProductionForms';
import { CustomProductionPanel } from './CustomProductionPanel';
import { PlanCard, JobCard } from './ProductionPanels';
import { ModalDialog } from '../../common/ModalDialog';
type Editor = {
    kind: 'REVISION';
    initial?: Revision;
} | {
    kind: 'PRINTER';
    initial?: Printer;
} | {
    kind: 'INVENTORY';
} | {
    kind: 'CHECK';
};
export function ProductionManager() {
    const { user, isAuthReady } = useAuth();
    const router = useRouter();
    const allowed = !!user && ['ADMIN', 'WORKSHOP_OPERATOR', 'PRINT_OPERATOR', 'FILE_REVIEWER'].includes(user.role);
    const [loaded, setLoaded] = useState<{
        owner: string;
        data: ProductionWorkspace;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const lock = useRef(false);
    const [reload, setReload] = useState(0);
    const [editor, setEditor] = useState<Editor | null>(null);
    const [tab, setTab] = useState('PLANS');
    const [selected, setSelected] = useState<string[]>([]);
    const [checks, setChecks] = useState<string[]>([]);
    const [startAt, setStartAt] = useState('');
    const [editingPlan, setEditingPlan] = useState<ProductionPlan | null>(null);
    const retry = useRef<{
        payload: string;
        key: string;
    } | null>(null);
    const data = loaded?.owner === user?.id ? loaded?.data : null;
    const canApprove = user?.role === 'ADMIN' || user?.role === 'WORKSHOP_OPERATOR';
    const operator = user?.role === 'PRINT_OPERATOR' || user?.role === 'WORKSHOP_OPERATOR';
    const admin = user?.role === 'ADMIN';
    useEffect(() => {
        if (isAuthReady && !allowed)
            router.replace(user ? '/admin' : '/dang-nhap');
    }, [isAuthReady, allowed, router, user]);
    useEffect(() => {
        if (!isAuthReady || !allowed || !user)
            return;
        const controller = new AbortController();
        fetch('/api/workshop/production', { cache: 'no-store', signal: controller.signal }).then(async (r) => {
            const body: ApiResponse<ProductionWorkspace> = await r.json();
            if (!r.ok || !body.success)
                throw new Error(body.error ?? 'Không tải được dữ liệu sản xuất.');
            if (!controller.signal.aborted) {
                setLoaded({ owner: user.id, data: body.data });
                setError('');
            }
        }).catch(c => {
            if (!controller.signal.aborted)
                setError(c instanceof Error ? c.message : 'Không tải được dữ liệu.');
        }).finally(() => {
            if (!controller.signal.aborted)
                setLoading(false);
        });
        return () => controller.abort();
    }, [isAuthReady, allowed, user, reload]);
    async function send(input: unknown): Promise<boolean> {
        if (lock.current)
            return false;
        lock.current = true;
        setBusy(true);
        setError('');
        setNotice('');
        const payload = JSON.stringify(input);
        if (retry.current?.payload !== payload)
            retry.current = { payload, key: crypto.randomUUID() };
        try {
            const r = await fetch('/api/workshop/production', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': retry.current.key }, body: payload });
            const body: ApiResponse<{
                status?: string; explanation?: string;
            }> = await r.json();
            if (!r.ok || !body.success)
                throw new Error(body.error ?? 'Không thể lưu thay đổi này.');
            retry.current = null;
            setNotice(body.data.status === 'STALE' ? 'Dữ liệu sản xuất hoặc lịch đã thay đổi. Hãy tạo phiên bản kế hoạch mới.' : body.data.explanation ?? 'Đã lưu thay đổi.');
            setReload(x => x + 1);
            return true;
        }
        catch (c) {
            setError(c instanceof Error ? c.message : 'Không thể lưu thay đổi này.');
            return false;
        }
        finally {
            lock.current = false;
            setBusy(false);
        }
    }
    const formSend = async (input: unknown) => {
        const ok = await send(input);
        if (ok)
            setEditor(null);
        return ok;
    };
    function editPlan(p: ProductionPlan) { setSelected(p.body.itemIds); setChecks(p.body.jobs.map(j => j.checkId)); setEditingPlan(p); setTab('PLANS'); }
    if (!isAuthReady || !allowed)
        return <div className="admin-theme min-h-screen bg-admin-canvas px-6 py-20 text-sm text-admin-secondary" role="status">Đang kiểm tra quyền truy cập…</div>;
    return <div className="admin-theme min-h-screen bg-admin-canvas text-admin-text"><div className="mx-auto min-h-[70vh] max-w-7xl space-y-6 px-4 pb-24 pt-6 sm:px-8"><header className="space-y-4"><Link href="/admin" className="inline-block py-2 text-sm text-admin-accent">← Tổng quan</Link><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="mb-2 text-xs font-medium uppercase tracking-wide text-admin-muted">MINHLAB / VẬN HÀNH XƯỞNG</p><h1 className="text-2xl font-semibold sm:text-3xl">Kế hoạch sản xuất</h1></div><button className={BUTTON} disabled={loading || busy} onClick={() => { setLoading(true); setReload(x => x + 1); }}>Làm mới</button></div><p className="max-w-3xl text-sm leading-6 text-admin-secondary">Dữ liệu sản xuất đã công bố được dùng cho đơn mới. Quản lý duyệt kế hoạch; nhân viên ghi nhận lúc bắt đầu, kiểm tra chất lượng và bàn giao.</p></header>
 {error && <p role="alert" className="break-words rounded-lg border border-[#EB4037]/40 p-4 text-sm text-[#FFB0A7]">{error}</p>}{notice && <p role="status" className="text-sm text-admin-success">{notice}</p>}
 {loading && <p role="status" className="py-6 text-sm text-[#A5ADB8]">Đang tải dữ liệu xưởng…</p>}
 {data && <><aside className="border-y border-admin-border py-4 text-sm leading-6 text-admin-secondary"><strong className="font-medium text-admin-text">Lập kế hoạch in · {data.agent.status === 'CONFIGURED' ? 'AI hỗ trợ đang bật' : 'bộ tối ưu nội bộ đang chạy'}</strong><p>{data.agent.message}</p></aside><nav aria-label="Không gian sản xuất" className="flex flex-wrap gap-2">{[['PLANS', 'Đơn hàng & kế hoạch'], ['JOBS', 'Mẻ in & bàn giao'], ['DATA', 'Linh kiện & định mức'], ['MACHINES', 'Máy in & kiểm tra'], ['CUSTOM', 'Đơn in theo yêu cầu']].map(([id, label]) => <button key={id} className={`${BUTTON} ${tab === id ? 'border-admin-accent text-admin-accent' : ''}`} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</nav>
 {tab === 'CUSTOM' && <CustomProductionPanel data={data.custom} profiles={data.revisions} role={user!.role} userId={user!.id} send={send} busy={busy}/>}
 {tab === 'PLANS' && <section className="space-y-5"><h2 className="text-xl font-semibold">Đơn hàng sản phẩm</h2>{data.items.length === 0 ? <p className="py-8 text-sm text-[#A5ADB8]">Chưa có đơn sản phẩm nào cần lập kế hoạch in.</p> : <><ul className="divide-y divide-[#27313C]">{data.items.map(i => <li key={i.id} className="flex items-start gap-3 py-4"><input className="mt-1 h-5 w-5 shrink-0" type="checkbox" aria-label={`Chọn đơn ${i.orderNumber}, mã biến thể ${i.sku}`} disabled={!canApprove || !!i.packedAt || !['CONFIRMED', 'IN_PRODUCTION'].includes(i.orderStatus)} checked={selected.includes(i.id)} onChange={e => setSelected(e.target.checked ? [...selected, i.id] : selected.filter(id => id !== i.id))}/><div className="min-w-0 text-sm"><p className="break-words font-mono">{i.orderNumber} · {i.sku} · SL {i.quantity}</p><p className="mt-1 text-admin-secondary">{i.dispatchReadyAt ? 'Đã đóng gói' : i.packedAt ? 'Đang đóng gói' : i.groupId ? 'Đã phân công sản xuất' : i.bomRevisionId ? 'Đã xác nhận định mức linh kiện' : 'Chờ công bố định mức linh kiện'}{i.bomRevisionId ? ` · ${data.revisions.find(r => r.id === i.bomRevisionId)?.code ?? ''} r${data.revisions.find(r => r.id === i.bomRevisionId)?.revision ?? ''}` : ''}</p></div></li>)}</ul>{canApprove && <form className="space-y-4 rounded-md border border-admin-border bg-admin-surface p-4 sm:p-6" onSubmit={e => {
                            e.preventDefault();
                            void send({ action: 'PROPOSE', itemIds: selected, checkIds: checks, startAt: new Date(startAt).toISOString(), ...(editingPlan ? { id: editingPlan.id, revision: editingPlan.revision } : {}) }).then(ok => {
                                if (ok)
                                    setEditingPlan(null);
                            });
                        }}><h3 className="font-semibold">{editingPlan ? 'Gửi phiên bản kế hoạch mới' : 'Chuẩn bị kế hoạch để duyệt'}</h3><p className="text-sm leading-6 text-[#A5ADB8]">Bộ tối ưu chọn các mẻ in đã được nhân viên xác nhận để đáp ứng nhu cầu còn lại. Bạn cũng có thể tự chọn mẻ. Mọi kế hoạch phải được duyệt trước khi phân công.</p><Field label="Thời gian bắt đầu dự kiến (giờ địa phương)"><input className={INPUT} type="datetime-local" required value={startAt} onChange={e => setStartAt(e.target.value)}/></Field>{checks.map((id, index) => <div key={index} className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2"><Field label={`Mẻ in ${index + 1}`}><select className={INPUT} value={id} required onChange={e => setChecks(checks.map((old, i) => i === index ? e.target.value : old))}><option value="">Chọn cấu hình mẻ in đã xác nhận</option>{data.checks.filter(c => !c.revoked).map(c => <option key={c.id} value={c.id}>{c.code}</option>)}</select></Field><button type="button" className={`${BUTTON} px-3`} onClick={() => setChecks(checks.filter((_, i) => i !== index))}>Xóa</button></div>)}<div className="flex flex-wrap gap-3"><button type="button" className={`${BUTTON} whitespace-normal`} onClick={() => setChecks([...checks, ''])}>Thêm cấu hình mẻ đã xác nhận</button><button className={`${BUTTON} whitespace-normal bg-[#EB4037] text-white`} disabled={busy || selected.length === 0} type="submit">Tính và lưu kế hoạch nháp</button><button type="button" className={`${BUTTON} whitespace-normal`} disabled={busy || !selected.length || !startAt} onClick={() => void send({ action: 'RUN_AGENT', itemIds: selected, startAt: new Date(startAt).toISOString() })}>Tạo kế hoạch in</button>{editingPlan && <button type="button" className={`${BUTTON} whitespace-normal`} onClick={() => setEditingPlan(null)}>Hủy chỉnh sửa</button>}</div></form>}</>}
 <h2 className="pt-6 text-xl font-semibold">Kế hoạch gần đây</h2>{data.plans.length === 0 && <p className="py-6 text-sm text-[#A5ADB8]">Chưa có kế hoạch. Hãy chọn mặt hàng đủ điều kiện và bổ sung dữ liệu sản xuất cần thiết để bắt đầu.</p>}{data.plans.map(p => <PlanCard key={p.id} plan={p} data={data} send={send} busy={busy} canApprove={canApprove} canDecide={canApprove || user?.role === 'PRINT_OPERATOR'} canDelete={admin} actionError={error} onEdit={() => editPlan(p)}/>)}</section>}
 {tab === 'JOBS' && <section className="space-y-6"><h2 className="text-xl font-semibold">Mẻ in đã duyệt</h2>{!data.jobs.length && <p className="py-6 text-sm text-[#A5ADB8]">Chưa có mẻ in nào được phân công.</p>}{data.jobs.map(j => <JobCard key={j.id} job={j} data={data} send={send} busy={busy} operator={operator}/>)}<h2 className="pt-4 text-xl font-semibold">Đóng gói và bàn giao · theo thứ tự đơn</h2>{data.items.filter(i => i.groupId).map(i => { const waitsForEarlierOrder = hasEarlierUnfinishedOrder(data, i); return <div key={i.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-[#27313C] py-4"><p className="break-words text-sm">{i.orderNumber} · {i.sku} · SL {i.quantity}{waitsForEarlierOrder && <span className="ml-2 text-xs text-[#C8A261]">Chờ hoàn tất các đơn đặt trước</span>}</p>{i.dispatchReadyAt ? <span className="text-sm text-admin-success">Đã đóng gói</span> : operator ? <button className={BUTTON} disabled={busy || waitsForEarlierOrder} onClick={() => void send({ action: i.packedAt ? 'READY' : 'PACK', id: i.id })}>{i.packedAt ? 'Xác nhận đã đóng gói xong' : 'Chuyển đơn đã hoàn thành sang đóng gói'}</button> : <span className="text-sm text-[#A5ADB8]">{i.packedAt ? 'Đang đóng gói' : 'Chờ nhân viên bàn giao'}</span>}</div>; })}</section>}
 {tab === 'DATA' && <section className="space-y-5"><div className="flex flex-wrap gap-3">{admin && <button className={BUTTON} onClick={() => setEditor({ kind: 'REVISION' })}>Thêm linh kiện, định mức sản phẩm hoặc cấu hình máy in</button>}{(admin || operator) && <button className={BUTTON} onClick={() => setEditor({ kind: 'INVENTORY' })}>Ghi nhận tồn kho thực tế</button>}</div>{!data.revisions.length && <p className="py-8 text-sm text-admin-secondary">Chưa có dữ liệu sản xuất. Quản trị viên tạo bản nháp, nhân viên xác nhận kỹ thuật, sau đó quản trị viên công bố phiên bản đã duyệt.</p>}<ul className="divide-y divide-admin-border">{data.revisions.map(r => <li key={r.id} className="space-y-3 py-5"><p className="break-words text-sm"><span className="font-mono">{r.code} · r{r.revision}</span> · {r.kind === 'BOM' ? 'Định mức linh kiện' : r.kind === 'COMPONENT' ? 'Linh kiện' : 'Cấu hình'} · {r.status === 'PUBLISHED' ? 'Đã công bố' : r.status === 'REVOKED' ? 'Đã thu hồi' : r.verifiedBy ? 'Đã xác nhận, chờ công bố' : 'Bản nháp, chờ xác nhận'}</p>{r.kind === 'BOM' ? <ul className="space-y-1 text-sm text-admin-secondary">{r.body.lines.map((l, i) => <li key={i}>{data.revisions.find(c => c.id === l.componentRevisionId)?.code} × {l.quantity} đơn vị mỗi bộ</li>)}</ul> : <p className="text-sm text-admin-secondary">{r.body.name}{r.kind === 'COMPONENT' ? ` · ${r.body.unit} · ${({ PRINTED: 'In 3D', STOCKED: 'Lấy từ kho', PURCHASED: 'Mua ngoài', FINISHING: 'Hoàn thiện' } as Record<string, string>)[r.body.routing] ?? 'Chưa phân loại'} · ${r.body.objectsPerUnit ?? 'Chưa xác nhận số lượng'} vật thể mỗi đơn vị${r.body.mirrorRequired ? ' · cần nhân bản đối xứng' : ''}` : ` · ${r.body.processCode}`}</p>}<div className="flex flex-wrap gap-2">{operator && r.status === 'DRAFT' && !r.verifiedBy && <button className={BUTTON} disabled={busy} onClick={() => void send({ action: 'VERIFY', id: r.id })}>Xác nhận kiểm tra kỹ thuật</button>}{admin && r.status === 'DRAFT' && r.verifiedBy && <button className={BUTTON} disabled={busy} onClick={() => void send({ action: 'PUBLISH', id: r.id })}>Công bố phiên bản</button>}{admin && <button className={BUTTON} onClick={() => setEditor({ kind: 'REVISION', initial: r })}>Tạo phiên bản mới</button>}{admin && r.status === 'PUBLISHED' && <button className={BUTTON} disabled={busy} onClick={() => void send({ action: 'REVOKE', id: r.id })}>Thu hồi phiên bản</button>}</div></li>)}</ul></section>}
 {tab === 'MACHINES' && <section className="space-y-5"><div className="flex flex-wrap gap-3">{admin && <button className={BUTTON} onClick={() => setEditor({ kind: 'PRINTER' })}>Thêm máy in</button>}{operator && <button className={BUTTON} onClick={() => setEditor({ kind: 'CHECK' })}>Ghi nhận kiểm tra mẻ in</button>}</div>{data.printers.length === 0 && <p className="py-8 text-sm text-[#A5ADB8]">Chưa có máy in nào được ghi nhận.</p>}{data.printers.map(p => { const h = data.holds.find(x => x.printerId === p.id); const running = data.jobs.some(j => j.printerId === p.id && j.status === 'PRINTING'); return <div key={p.id} className="space-y-3 border-t border-[#27313C] py-5"><h3 className="text-sm font-semibold">{p.code} · {p.name}</h3><p className="text-sm text-[#A5ADB8]">{p.technology} · {p.status === 'AVAILABLE' ? (running ? 'Đang sử dụng' : h ? 'Được giữ đến khi đóng gói' : 'Sẵn sàng') : p.status === 'MAINTENANCE' ? 'Đang bảo trì' : 'Chưa sẵn sàng'}{h ? ` · nhóm ${h.groupId.slice(0, 8)} · ${h.itemIds.length} mặt hàng cần bàn giao` : ''}</p>{admin && <button className={BUTTON} onClick={() => setEditor({ kind: 'PRINTER', initial: p })}>Cập nhật trạng thái máy in đã xác nhận</button>}</div>; })}<h2 className="pt-5 text-xl font-semibold">Các mẻ in đã xác nhận</h2>{data.checks.length === 0 && <p className="py-6 text-sm text-[#A5ADB8]">Chưa có kiểm tra cách xếp bàn in hoặc thông số cắt lớp.</p>}{data.checks.map(c => <div key={c.id} className="space-y-3 border-t border-[#27313C] py-4"><p className="text-sm">{c.code} · {c.durationMinutes} phút in · {c.materialQuantity} g/ml · {c.revoked ? 'Đã thu hồi' : 'Đã xác nhận'}</p><p className="text-sm text-[#A5ADB8]">{c.members.map(m => `${data.revisions.find(r => r.id === m.componentRevisionId)?.code} × ${m.quantity}`).join(' / ')}</p>{(operator || admin) && !c.revoked && <button className={BUTTON} disabled={busy} onClick={() => void send({ action: 'REVOKE_CHECK', id: c.id })}>Thu hồi xác nhận</button>}</div>)}</section>}
 {editor && <ModalDialog title="Dữ liệu sản xuất" onDismiss={() => {
                    if (!busy)
                        setEditor(null);
                }} className="items-start p-4 sm:p-8"><section className="my-auto w-full max-w-2xl min-w-0 rounded-xl border border-[#27313C] bg-[#08090C] p-5 sm:p-8"><button className={`${BUTTON} mb-6`} disabled={busy} onClick={() => setEditor(null)}>Đóng</button>{error && <p role="alert" className="mb-4 break-words text-sm text-[#FFB0A7]">{error}</p>}{editor.kind === 'REVISION' ? <RevisionForm key={editor.initial?.id ?? 'new'} data={data} send={formSend} busy={busy} initial={editor.initial}/> : editor.kind === 'PRINTER' ? <PrinterForm send={formSend} busy={busy} initial={editor.initial}/> : editor.kind === 'CHECK' ? <CheckForm data={data} send={formSend} busy={busy}/> : <InventoryForm data={data} send={formSend} busy={busy}/>}</section></ModalDialog>}</>}
 </div></div>;
}

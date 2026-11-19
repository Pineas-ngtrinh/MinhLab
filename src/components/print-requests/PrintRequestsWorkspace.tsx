'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import type { PrintRequestView, PrintRequestWorkspace } from '../../contracts/print-requests';
import type { ApiResponse } from '../../contracts/api';
import { formatVND } from '../../lib/format';
import { BUTTON, INPUT, Field } from '../admin/production/ProductionForms';
import { RequestRetention } from './RequestRetention';
import { RequestSubmissionForm } from './RequestSubmissionForm';
import { ListPagination } from '../common/ListPagination';
import { ModalDialog } from '../common/ModalDialog';
const LABELS: Record<string, string> = { SUBMITTED: 'Chờ tiếp nhận', UNDER_REVIEW: 'Đang kiểm tra', NEEDS_REVISION: 'Cần bổ sung', READY_FOR_QUOTE: 'Đã gửi báo giá', CLOSED: 'Đã kết thúc / chuyển đơn', REJECTED: 'Không nhận in' };
const date = (v: string) => new Date(v).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
function QuoteForm({ request, materials, send, busy }: {
    request: PrintRequestView;
    materials: PrintRequestWorkspace['materials'];
    send: (v: unknown) => Promise<void>;
    busy: boolean;
}) {
    return <form className="space-y-4 border-t border-[#27313C] pt-5" onSubmit={e => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const str = (k: string) => String(f.get(k) ?? '');
            const n = (k: string) => Number(f.get(k));
            void send({ action: 'ISSUE', id: request.id, revision: request.revision, input: { materialId: str('materialId'), color: str('color'), length: n('length'), width: n('width'), height: n('height'), scale: n('scale'), unitPrice: n('unitPrice'), shipping: n('shipping'), validUntil: new Date(str('validUntil')).toISOString(), promisedFinishAt: new Date(str('promisedFinishAt')).toISOString(), terms: str('terms'), evidenceCode: str('evidenceCode'), checksConfirmed: f.get('checksConfirmed') === 'on' } });
        }}><h3 className="font-semibold">Duyệt kỹ thuật và phát hành báo giá</h3><p className="text-sm leading-6 text-[#A5ADB8]">Chốt đủ {request.quantity} bản. Giá mỗi bản bao gồm các phụ phí chế tạo; giao hàng ghi riêng và cần được xác nhận. Đổi giá/cấu hình tạo báo giá mới, khách phải đồng ý lại.</p><div className="grid gap-4 sm:grid-cols-2"><Field label="Vật liệu thực tế"><select className={INPUT} name="materialId" required><option value="">Chọn vật liệu đang hoạt động</option>{materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field><Field label="Màu chốt"><input className={INPUT} required name="color" maxLength={60}/></Field>{[['length', 'Kích thước X (mm)'], ['width', 'Kích thước Y (mm)'], ['height', 'Kích thước Z (mm)'], ['scale', 'Tỷ lệ đã chốt (%)'], ['unitPrice', 'Giá mỗi bản gồm phụ phí (VND)'], ['shipping', 'Phí giao hàng đã chốt (VND)']].map(([n, label]) => <Field key={n} label={label}><input className={INPUT} name={n} type="number" min={n === 'shipping' ? 0 : 0.01} step={['unitPrice', 'shipping'].includes(n) ? 1 : '0.01'} required/></Field>)}<Field label="Báo giá có hiệu lực đến (giờ máy tính)"><input className={INPUT} name="validUntil" type="datetime-local" required/></Field><Field label="Hoàn thành dự kiến (giờ máy tính)"><input className={INPUT} name="promisedFinishAt" type="datetime-local" required/></Field></div><Field label="Điều khoản và thay đổi so với mong muốn của khách"><textarea className={INPUT} name="terms" maxLength={6000} required/></Field><Field label="Mã xác nhận kỹ thuật tại xưởng"><input className={INPUT} name="evidenceCode" maxLength={40} pattern="[A-Za-z0-9_-]+" required/></Field><label className="flex items-start gap-3 text-sm leading-6"><input name="checksConfirmed" type="checkbox" required className="mt-1"/>Tôi đã kiểm đúng file/revision, đơn vị/kích thước, support/layout, máy/profile, vật tư, lịch xưởng và đủ mọi khoản tiền. Đã xác nhận mọi khác biệt cần khách đồng ý.</label><button className={`${BUTTON} bg-[#EB4037] text-white`} disabled={busy || !request.rightsAccepted || request.file?.scanStatus !== 'CLEAN' || request.file.analysisStatus !== 'COMPLETE'}>Phát hành báo giá revision mới</button></form>;
}
function RequestCard({ r, workspace, role, userId, send, busy, onRevise }: {
    r: PrintRequestView;
    workspace: PrintRequestWorkspace;
    role: string;
    userId: string;
    send: (v: unknown) => Promise<void>;
    busy: boolean;
    onRevise: () => void;
}) {
    const [note, setNote] = useState('');
    const [assignee, setAssignee] = useState('');
    const [showQuote, setShowQuote] = useState(false);
    const reviewer = role === 'FILE_REVIEWER' && r.assignedReviewerId === userId;
    const latest = r.quotes[0];
    return <article className="space-y-5 border-t border-[#27313C] py-7"><div className="flex flex-wrap justify-between gap-3"><h2 className="break-all font-mono text-sm">{r.number}</h2><span className="text-sm text-[#C8A261]">{r.closedReason === 'CONVERTED' ? 'Đã chuyển đơn' : LABELS[r.status] ?? r.status} · r{r.revision}</span></div><p className="text-sm leading-6"><strong>{r.quantity} bản</strong> · {r.requested.material} · {r.requested.color}<br /><span className="text-[#A5ADB8]">{r.requested.purpose}</span></p>{r.note && <p className="whitespace-pre-wrap text-sm text-[#A5ADB8]">{r.note}</p>}{r.contact?.name && <p className="text-sm text-[#A5ADB8]">Người nhận: {r.contact.name} · {r.contact.phone}<br />{r.contact.address}</p>}
 {r.file ? <div className="space-y-2 text-sm">{r.file.originalFilename && <p className="break-all">{r.file.originalFilename}</p>}<p>{r.file.scanStatus === 'CLEAN' ? 'Đã kiểm an toàn file' : r.file.scanStatus === 'PENDING' ? 'Đang chờ công cụ kiểm an toàn file' : 'File không đạt / cần xử lý'} · {r.file.analysisStatus === 'COMPLETE' ? 'Đã phân tích STL' : r.file.analysisStatus === 'FAILED' ? 'Phân tích chưa đạt' : r.file.analysisStatus === 'MANUAL_REVIEW' ? 'Chờ kỹ thuật kiểm file OBJ / STEP' : 'Chờ phân tích STL'}</p>{r.file.analysis && <p className="text-[#A5ADB8]">Kích thước nguồn: {r.file.analysis.bboxMm.w.toFixed(2)} × {r.file.analysis.bboxMm.d.toFixed(2)} × {r.file.analysis.bboxMm.h.toFixed(2)} mm · {r.file.analysis.flags.includes('MANUAL_REVIEW') ? 'Kỹ thuật kiểm tra thủ công' : `${r.file.analysis.triangleCount} tam giác`}{r.file.analysis.flags.length ? ` · ${r.file.analysis.flags.join(', ')}` : ''}</p>}{r.file.availability !== 'PURGED' && (role === 'CUSTOMER' || reviewer) && <a className="inline-block py-2 text-[#C8A261] underline" href={`/api/print-files/${r.file.id}`}>Tải file mô hình riêng tư</a>}</div> : <p className="text-sm text-[#A5ADB8]">Cần bổ sung file trước khi duyệt cấu hình/báo giá.</p>}
 {r.issue && <p className="whitespace-pre-wrap text-sm leading-6 text-[#FFB0A7]">Xưởng cần bạn xử lý: {r.issue}</p>}
 {role === 'ADMIN' && !['CLOSED', 'REJECTED'].includes(r.status) && <form className="space-y-3" onSubmit={e => { e.preventDefault(); void send({ action: 'ASSIGN', id: r.id, revision: r.revision, reviewerId: assignee, note }); }}><Field label="Kỹ thuật được phân công"><select className={INPUT} value={assignee} required onChange={e => setAssignee(e.target.value)}><option value="">Chọn nhân sự kỹ thuật</option>{workspace.reviewers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field><Field label="Lý do phân công / chuyển người"><input className={INPUT} required value={note} onChange={e => setNote(e.target.value)} maxLength={2000}/></Field><button className={BUTTON} disabled={busy}>Ghi phân công</button></form>}
 {role === 'CUSTOMER' && !['CLOSED', 'REJECTED'].includes(r.status) && <button className={BUTTON} onClick={onRevise}>Bổ sung file / yêu cầu điều chỉnh</button>}
 {role === 'FILE_REVIEWER' && !r.assignedReviewerId && !['CLOSED', 'REJECTED'].includes(r.status) && <button className={BUTTON} disabled={busy} onClick={() => void send({ action: 'CLAIM', id: r.id, revision: r.revision })}>Nhận phiếu kiểm tra</button>}
 {role === 'FILE_REVIEWER' && r.assignedReviewerId && r.assignedReviewerId !== userId && <p className="text-sm text-[#A5ADB8]">Phiếu do kỹ thuật khác phụ trách.</p>}
 {reviewer && r.file?.scanStatus === 'CLEAN' && r.file.analysisStatus === 'MANUAL_REVIEW' && <form className="space-y-3 border-t border-[#27313C] pt-5" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void send({ action: 'FILE_MANUAL_ANALYSIS', id: r.id, revision: r.revision, input: { w: Number(f.get('w')), d: Number(f.get('d')), h: Number(f.get('h')), evidenceCode: String(f.get('evidenceCode')) } }); }}><h3 className="font-semibold">Kiểm file OBJ / STEP tại xưởng</h3><p className="text-sm leading-6 text-[#A5ADB8]">File đã qua công cụ kiểm an toàn. Mở trên phần mềm kỹ thuật tại xưởng, xác nhận đơn vị mm, hình học và kích thước nguồn. Bước này không phải dự đoán FDM.</p><div className="grid gap-3 sm:grid-cols-3">{[['w', 'X (mm)'], ['d', 'Y (mm)'], ['h', 'Z (mm)']].map(([n, label]) => <Field key={n} label={label}><input className={INPUT} name={n} type="number" min="0.001" step="0.001" required/></Field>)}</div><Field label="Mã xác nhận kiểm file"><input className={INPUT} name="evidenceCode" required pattern="[A-Za-z0-9_-]+" maxLength={40}/></Field><button className={BUTTON} disabled={busy}>Ghi kết quả kiểm file thủ công</button></form>}
 {reviewer && !['CLOSED', 'REJECTED'].includes(r.status) && <div className="space-y-4"><Field label="Vấn đề và hướng dẫn khách bổ sung / lý do từ chối"><textarea className={INPUT} value={note} onChange={e => setNote(e.target.value)} maxLength={2000}/></Field><div className="flex flex-wrap gap-3"><button className={BUTTON} disabled={busy || !note.trim()} onClick={() => void send({ action: 'NEEDS_REVISION', id: r.id, revision: r.revision, note })}>Yêu cầu bổ sung</button><button className={BUTTON} disabled={busy || !note.trim()} onClick={() => void send({ action: 'REJECTED', id: r.id, revision: r.revision, note })}>Từ chối nhận in</button><button className={BUTTON} onClick={() => setShowQuote(!showQuote)}>{showQuote ? 'Đóng phần báo giá' : 'Soạn báo giá chính thức'}</button></div>{showQuote && <QuoteForm request={r} materials={workspace.materials} send={send} busy={busy}/>}</div>}
 {latest && <section className="space-y-4 rounded-xl border border-[#27313C] bg-[#0B0B0E] p-4 sm:p-6"><h3 className="text-lg font-semibold">Báo giá r{latest.revision} · {latest.status === 'CONVERTED' ? 'Đã chuyển đơn' : latest.status === 'SENT' ? 'Đã phát hành' : 'Đã thay thế / đóng'}</h3><dl className="grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-[#A5ADB8]">Khách yêu cầu</dt><dd className="mt-1">{r.requested.material} · {r.requested.color} · {r.quantity} bản</dd></div><div><dt className="text-[#A5ADB8]">Xưởng chốt</dt><dd className="mt-1">{latest.spec.material} · {latest.spec.color} · {latest.quantity} bản<br />{latest.spec.length} × {latest.spec.width} × {latest.spec.height} mm · {latest.spec.scale}%</dd></div><div><dt className="text-[#A5ADB8]">Mỗi bản / giao hàng</dt><dd className="mt-1">{formatVND(latest.unitPrice)} / {formatVND(latest.shipping)}</dd></div><div><dt className="text-[#A5ADB8]">Tổng cần thanh toán</dt><dd className="mt-1 text-lg font-semibold text-[#C8A261]">{formatVND(latest.total)}</dd></div></dl><p className="text-sm leading-6">Hiệu lực đến: {date(latest.validUntil)}<br />Dự kiến hoàn thành: {date(latest.promisedFinishAt)}</p><p className="whitespace-pre-wrap text-sm leading-6 text-[#A5ADB8]">{latest.terms}</p>{latest.orderNumber ? <Link className="inline-block py-2 text-sm text-[#C8A261] underline" href={role === 'CUSTOMER' ? `/theo-doi-don?order=${encodeURIComponent(latest.orderNumber)}` : '/admin'}>Mở đơn {latest.orderNumber}</Link> : role === 'CUSTOMER' && latest.status === 'SENT' && !['CLOSED', 'REJECTED'].includes(r.status) && latest.requestRevision === r.revision && <button className={`${BUTTON} bg-[#EB4037] text-white`} disabled={busy} onClick={() => void send({ action: 'ACCEPT', id: r.id, revision: r.revision, quoteId: latest.id, termsHash: latest.termsHash })}>Đồng ý toàn bộ báo giá và tạo một đơn</button>}{role === 'CUSTOMER' && latest.status === 'SENT' && <div className="space-y-3"><Field label="Nội dung cần điều chỉnh / lý do chưa đồng ý"><textarea className={INPUT} value={note} onChange={e => setNote(e.target.value)} maxLength={2000}/></Field><button className={BUTTON} disabled={busy || !note.trim()} onClick={() => void send({ action: 'DECLINE', id: r.id, revision: r.revision, quoteId: latest.id, note })}>Chưa đồng ý, gửi lại xưởng</button></div>}</section>}
 <RequestRetention key={`${r.revision}:${(r.fileHolds ?? []).map(h => h.id).join(',')}`} request={r} role={role} busy={busy} send={send} />
 </article>;
}
export function PrintRequestsWorkspace() {
    const { user, isAuthReady } = useAuth();
    const [loaded, setLoaded] = useState<{
        owner: string;
        data: PrintRequestWorkspace;
    } | null>(null);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const lock = useRef(false);
    const retry = useRef<{
        payload: string;
        key: string;
    } | null>(null);
    const [reload, setReload] = useState(0);
    const [filter, setFilter] = useState('ALL');
    const [fileFilter, setFileFilter] = useState('ALL');
    const [page, setPage] = useState(1);
    const [edit, setEdit] = useState<{
        request?: PrintRequestView;
    } | null>(null);
    const allowed = !!user && ['CUSTOMER', 'FILE_REVIEWER', 'ADMIN'].includes(user.role);
    const data = loaded?.owner === user?.id ? loaded?.data : null;
    useEffect(() => {
        if (!isAuthReady || !allowed || !user)
            return;
        const c = new AbortController();
        fetch(`/api/print-requests?page=${page}${filter === 'ALL' ? '' : filter === 'MINE' ? '&mine=1' : `&status=${encodeURIComponent(filter)}`}`, { cache: 'no-store', signal: c.signal }).then(async (r) => {
            const b: ApiResponse<PrintRequestWorkspace> = await r.json();
            if (!r.ok || !b.success)
                throw new Error(b.error ?? 'Không thể tải phiếu.');
            if (!c.signal.aborted) {
                setLoaded({ owner: user.id, data: b.data });
                setError('');
            }
        }).catch(e => {
            if (!c.signal.aborted)
                setError(e instanceof Error ? e.message : 'Không thể tải phiếu.');
        }).finally(() => {
            if (!c.signal.aborted)
                setLoading(false);
        });
        return () => c.abort();
    }, [user, isAuthReady, allowed, reload, filter, page]);
    async function send(input: unknown) {
        if (lock.current)
            return;
        lock.current = true;
        setBusy(true);
        setError('');
        const payload = JSON.stringify(input);
        if (retry.current?.payload !== payload)
            retry.current = { payload, key: crypto.randomUUID() };
        try {
            const r = await fetch('/api/print-requests', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': retry.current.key }, body: payload });
            const b: ApiResponse<{
                number?: string;
            }> = await r.json();
            if (!r.ok || !b.success)
                throw new Error(b.error ?? 'Không thể ghi thao tác.');
            retry.current = null;
            setNotice(b.data?.number ? `Đã tạo / khôi phục đơn ${b.data.number}.` : 'Đã ghi nhận thao tác.');
            setReload(x => x + 1);
        }
        catch (e) {
            setError(e instanceof Error ? e.message : 'Không thể ghi thao tác.');
        }
        finally {
            lock.current = false;
            setBusy(false);
        }
    }
    if (!isAuthReady)
        return <p role="status" className="p-8 text-sm">Đang kiểm tra phiên…</p>;
    if (!allowed)
        return <div className="space-y-4 p-8"><h1 className="text-xl">Yêu cầu in riêng tư</h1><p className="text-sm">Đăng nhập bằng tài khoản khách hàng hoặc nhân sự được phân công để xem phiếu.</p><Link className="text-[#C8A261] underline" href="/dang-nhap">Đăng nhập</Link></div>;
    const pageRows = data?.requests ?? [];
    const rows = pageRows.filter(r => fileFilter === 'ALL' || (r.retainedFiles ?? []).some(f =>
        fileFilter === 'PURGED' ? f.availability === 'PURGED' : fileFilter === 'HELD' ? f.retentionReason === 'HOLD' : !!f.scheduledDeletionAt));
    return <div className="mx-auto min-h-[70vh] max-w-5xl space-y-6 px-4 pb-24 pt-6 text-[#F4F1EA] sm:px-8"><header className="space-y-4"><Link className="inline-block py-2 text-sm text-[#C8A261]" href={user!.role === 'CUSTOMER' ? '/tai-khoan' : '/admin'}>← Bàn làm việc</Link><h1 className="text-2xl font-semibold sm:text-3xl">Yêu cầu in & báo giá</h1><p className="text-sm leading-6 text-[#A5ADB8]">Phiếu, file và báo giá theo đúng revision. Xác nhận báo giá tạo một đơn chờ VietQR; quản trị viên đối soát tiền theo quy trình của xưởng.</p></header>{error && <p role="alert" className="break-words text-sm text-[#FFB0A7]">{error}</p>}{notice && <p role="status" className="text-sm text-[#C8A261]">{notice}</p>}{data && !data.privateFilesConfigured && <p className="border-y border-[#27313C] py-4 text-sm leading-6 text-[#A5ADB8]">Đang chờ cấu hình kho private và kiểm an toàn file. Có thể lưu phiếu tư vấn chưa kèm file; chưa phát hành báo giá khi thiếu file hợp lệ.</p>}<div className="flex flex-wrap items-end gap-3"><Field label="Lọc phiếu"><select className={INPUT} value={filter} onChange={e => { setFilter(e.target.value); setPage(1); setLoading(true); }}><option value="ALL">Tất cả</option>{user!.role === 'FILE_REVIEWER' && <option value="MINE">Tôi phụ trách</option>}{Object.entries(LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>{['ADMIN'].includes(user!.role) && <Field label="Lọc file trong trang hiện tại"><select className={INPUT} value={fileFilter} onChange={e => setFileFilter(e.target.value)}><option value="ALL">Tất cả file</option><option value="EXPIRING">Đã có ngày dự kiến xóa</option><option value="HELD">Đang giữ xử lý sự việc</option><option value="PURGED">Đã hết hạn lưu</option></select></Field>}<button className={BUTTON} onClick={() => { setLoading(true); setReload(x => x + 1); }}>Tải lại</button>{user!.role === 'CUSTOMER' && <button className={BUTTON} onClick={() => setEdit({})}>Gửi yêu cầu mới</button>}</div>{loading ? <p role="status" className="py-8 text-sm text-[#A5ADB8]">Đang tải phiếu…</p> : rows.length === 0 ? <p role="status" className="py-8 text-sm text-[#A5ADB8]">Chưa có yêu cầu trong nhóm này.</p> : data && rows.map(r => <RequestCard key={r.id} r={r} workspace={data} role={user!.role} userId={user!.id} send={send} busy={busy} onRevise={() => setEdit({ request: r })}/>)}
 {data && <ListPagination pagination={data.pagination} isLoading={loading} onPageChange={p => { setPage(p); setLoading(true); }}/>}
 {edit && <ModalDialog title="Gửi yêu cầu in" onDismiss={() => setEdit(null)} className="items-start p-4 sm:p-8"><div className="my-auto w-full max-w-2xl min-w-0 rounded-xl border border-[#27313C] bg-[#08090C] p-5 sm:p-8"><button className={BUTTON} onClick={() => setEdit(null)}>Đóng</button><RequestSubmissionForm existing={edit.request} onSaved={() => { setEdit(null); setReload(x => x + 1); }}/></div></ModalDialog>}
 </div>;
}

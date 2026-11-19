'use client';
import { useState } from 'react';
import type { CustomProductionView, CustomProductionItem, CustomBatch } from '../../../contracts/custom-production';
import type { Revision } from '../../../contracts/production';
import { BUTTON, INPUT, Field, type Command } from './ProductionForms';
import { STATUS } from './ProductionPanels';
function BatchRow({ b, operator, send, busy }: {
    b: CustomBatch;
    operator: boolean;
    send: Command;
    busy: boolean;
}) {
    const [good, setGood] = useState('');
    const next: Record<string, {
        action: string;
        label: string;
    }> = { QUEUED: { action: 'CUSTOM_START', label: 'Ghi nhận giờ bắt đầu thực tế' }, PRINTING: { action: 'CUSTOM_FINISH', label: 'Ghi nhận hoàn tất in' }, POST_PROCESSING: { action: 'CUSTOM_QC_READY', label: 'Hoàn thiện sau in và chuyển kiểm tra chất lượng' } };
    const action = next[b.status];
    return <div className="space-y-3 border-t border-[#27313C] py-4"><p className="text-sm">Mẻ in {b.id.slice(0, 8)} · {b.quantity} đơn vị · {STATUS[b.status] ?? 'Trạng thái khác'} · {b.good} đạt, {b.failed} lỗi</p><p className="text-sm text-[#A5ADB8]">{b.actualStartAt ? `Bắt đầu thực tế ${new Date(b.actualStartAt).toLocaleString('vi-VN')}` : `Dự kiến ${new Date(b.startAt).toLocaleString('vi-VN')}`} · mã xác nhận {b.evidenceCode}</p>{operator && action && <button className={BUTTON} disabled={busy} onClick={() => void send({ action: action.action, id: b.id })}>{action.label}</button>}{operator && b.status === 'PRINTING' && <button className={`${BUTTON} ml-2`} disabled={busy} onClick={() => void send({ action: 'CUSTOM_FAIL', id: b.id })}>Ghi nhận mẻ in lỗi</button>}{operator && b.status === 'QC_PENDING' && <form className="space-y-3" onSubmit={e => { e.preventDefault(); void send({ action: 'CUSTOM_QC', id: b.id, good: Number(good), failed: b.quantity - Number(good) }); }}><Field label="Số lượng đạt kiểm tra chất lượng (số còn lại bị lỗi)"><input className={INPUT} type="number" min="0" max={b.quantity} step="1" required value={good} onChange={e => setGood(e.target.value)}/></Field><button className={BUTTON} disabled={busy}>Lưu kết quả kiểm tra chất lượng</button></form>}</div>;
}
function CustomItem({ i, batches, profiles, role, userId, send, busy }: {
    i: CustomProductionItem;
    batches: CustomBatch[];
    profiles: Revision[];
    role: string;
    userId: string;
    send: Command;
    busy: boolean;
}) {
    const [show, setShow] = useState(false);
    const reviewer = role === 'FILE_REVIEWER' && i.reviewerId === userId;
    const operator = role === 'PRINT_OPERATOR';
    const missing = i.quantity - batches.reduce((n, b) => n + (['FAILED', 'COMPLETED', 'CANCELLED'].includes(b.status) ? b.good : b.quantity), 0);
    return <article className="space-y-4 border-t border-[#27313C] py-6"><h3 className="break-words font-mono text-sm">{i.orderNumber} · {i.quantity} sản phẩm theo yêu cầu</h3><p className="text-sm text-[#A5ADB8]">{i.materialCode} · {i.color} · {i.length} × {i.width} × {i.height} mm<br />Số lượng chưa có mẻ in: {missing}</p>{(reviewer || (operator && batches.length > 0)) && <a className="inline-block py-2 text-sm text-admin-accent underline hover:text-admin-accent-hover" href={`/api/print-files/${i.fileId}`}>Tải phiên bản tệp đã duyệt</a>}{reviewer && missing > 0 && !i.packedAt && <div className="space-y-4"><button className={BUTTON} onClick={() => setShow(!show)}>{show ? 'Đóng phần tạo mẻ in' : 'Kiểm tra và duyệt mẻ in'}</button>{show && <form className="space-y-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void send({ action: 'CUSTOM_APPROVE', input: { itemId: i.id, profileId: String(f.get('profileId')), quantity: Number(f.get('quantity')), durationMinutes: Number(f.get('durationMinutes')), materialQuantity: Number(f.get('materialQuantity')), startAt: new Date(String(f.get('startAt'))).toISOString(), evidenceCode: String(f.get('evidenceCode')), confirmed: f.get('confirmed') === 'on' } }); }}><Field label="Cấu hình máy in đã công bố, phù hợp vật liệu và màu sắc"><select className={INPUT} name="profileId" required><option value="">Chọn cấu hình</option>{profiles.filter(r => r.kind === 'PROFILE' && r.status === 'PUBLISHED' && r.body.material === i.materialCode && r.body.color === i.color && r.body.technology === i.technology).map(r => <option key={r.id} value={r.id}>{r.code} r{r.revision}</option>)}</select></Field><div className="grid gap-4 sm:grid-cols-2">{[['quantity', 'Số lượng trong mẻ'], ['durationMinutes', 'Thời lượng mẻ (phút)'], ['materialQuantity', 'Vật liệu cho mẻ (g/ml)']].map(([name, label]) => <Field key={name} label={label}><input className={INPUT} name={name} type="number" min={name === 'materialQuantity' ? '0.001' : '1'} max={name === 'quantity' ? missing : 1000000} step={name === 'materialQuantity' ? '0.001' : '1'} required/></Field>)}<Field label="Thời gian bắt đầu dự kiến (giờ địa phương)"><input className={INPUT} type="datetime-local" name="startAt" required/></Field></div><Field label="Mã xác nhận cách xếp bàn in / thông số cắt lớp"><input className={INPUT} name="evidenceCode" required maxLength={40} pattern="[A-Za-z0-9_-]+"/></Field><label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" name="confirmed" required className="mt-1"/>Tôi đã kiểm tra tệp, số lượng, giá đỡ/cách xếp, cấu hình máy, vật liệu và khâu bàn giao đóng gói. Duyệt sẽ giữ chỗ nguồn lực nhưng không khởi động máy in.</label><button className={`${BUTTON} bg-[#EB4037] text-white`} disabled={busy}>Duyệt mẻ và giữ chỗ máy in / vật liệu</button></form>}</div>}{batches.map(b => <BatchRow key={b.id} b={b} operator={operator} send={send} busy={busy}/>)}{operator && !i.readyAt && <button className={BUTTON} disabled={busy} onClick={() => void send({ action: i.packedAt ? 'CUSTOM_READY' : 'CUSTOM_PACK', id: i.id })}>{i.packedAt ? 'Xác nhận đã đóng gói xong' : 'Chuyển toàn bộ sản phẩm đã đạt kiểm tra chất lượng sang đóng gói'}</button>}{i.readyAt && <p className="text-sm text-admin-success">Đã đóng gói toàn bộ sản phẩm theo yêu cầu.</p>}</article>;
}
export function CustomProductionPanel({ data, profiles, role, userId, send, busy }: {
    data: CustomProductionView;
    profiles: Revision[];
    role: string;
    userId: string;
    send: Command;
    busy: boolean;
}) {
    if (role === 'WORKSHOP_OPERATOR') {
        return <section className="space-y-3 rounded-xl border border-[#27313C] p-4"><h2 className="text-xl font-semibold">Đơn in theo yêu cầu</h2><p className="text-sm leading-6 text-[#A5ADB8]">Vai trò này xử lý sản phẩm trong danh mục. Tệp riêng tư của khách chỉ hiển thị với kỹ thuật viên được phân công.</p></section>;
    }
    return <section className="space-y-4"><h2 className="text-xl font-semibold">Đơn in theo yêu cầu đã duyệt</h2><p className="max-w-3xl text-sm leading-6 text-[#A5ADB8]">Đơn in theo yêu cầu được lập kế hoạch riêng với đơn sản phẩm. Người duyệt được phân công kiểm tra từng mẻ; nhân viên ghi nhận lúc bắt đầu, hoàn thiện sau in và kiểm tra chất lượng. Chỉ số lượng bị lỗi mới được đưa vào kế hoạch in lại.</p>{data.items.length === 0 ? <p className="py-8 text-sm text-[#A5ADB8]">Bạn chưa được phân công đơn in theo yêu cầu nào đã đối soát.</p> : data.items.map(i => <CustomItem key={i.id} i={i} batches={data.batches.filter(b => b.itemId === i.id)} profiles={profiles} role={role} userId={userId} send={send} busy={busy}/>)}</section>;
}

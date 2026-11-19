'use client';
import { useState, type FormEvent, type ReactNode } from 'react';
import type { ProductionWorkspace, Revision } from '../../../contracts/production';
export const INPUT = 'mt-1 min-h-11 w-full min-w-0 rounded-lg border border-[#27313C] bg-[#111216] px-3 py-2 text-sm text-[#F4F1EA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent';
export const BUTTON = 'min-h-11 rounded-lg border border-[#27313C] px-4 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent disabled:opacity-40';
export type Command = (input: unknown) => Promise<boolean>;
export function Field({ label, children }: {
    label: string;
    children: ReactNode;
}) { return <label className="block min-w-0 text-sm text-[#A5ADB8]">{label}{children}</label>; }
const value = (f: FormData, n: string) => String(f.get(n) ?? '');
const number = (f: FormData, n: string) => Number(f.get(n));
function Quantities({ options, name, label, initial }: {
    options: {
        id: string;
        label: string;
    }[];
    name: string;
    label: string;
    initial?: {
        id: string;
        quantity: number;
    }[];
}) {
    const [rows, setRows] = useState(initial?.map((x, i) => ({ ...x, key: i })) ?? [{ id: '', quantity: 0, key: 0 }]);
    return <fieldset className="space-y-3"><legend className="mb-2 text-sm">{label}</legend>{rows.map((r, i) => <div key={r.key} className="grid grid-cols-[minmax(0,1fr)_80px_44px] gap-2"><select aria-label={`${label} ${i + 1}`} className={INPUT} name={`${name}Id`} required defaultValue={r.id}><option value="">Chọn phiên bản</option>{options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</select><input aria-label={`Số lượng ${i + 1}`} type="number" min="1" max="10000" step="1" required name={`${name}Qty`} defaultValue={r.quantity || ''} className={INPUT}/><button className={`${BUTTON} mt-1 px-1`} type="button" aria-label={`Xóa dòng ${i + 1}`} onClick={() => setRows(rows.filter(x => x.key !== r.key))}>×</button></div>)}<button type="button" className={BUTTON} onClick={() => setRows([...rows, { id: '', quantity: 0, key: Math.max(-1, ...rows.map(r => r.key)) + 1 }])}>Thêm dòng</button></fieldset>;
}
function readLines(f: FormData, name: string) { return f.getAll(`${name}Id`).map((id, i) => ({ componentRevisionId: String(id), quantity: Number(f.getAll(`${name}Qty`)[i]) })); }
export function RevisionForm({ data, send, busy, initial, initialKind, initialVariantId }: {
    data: ProductionWorkspace;
    send: Command;
    busy: boolean;
    initial?: Revision;
    initialKind?: Revision['kind'];
    initialVariantId?: string;
}) {
    const [kind, setKind] = useState(initial?.kind ?? initialKind ?? 'COMPONENT');
    const [routing, setRouting] = useState(initial?.kind === 'COMPONENT' ? initial.body.routing : 'PRINTED');
    const body = initial?.kind === 'COMPONENT' || initial?.kind === 'PROFILE' ? initial.body : null;
    async function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const dimensions = value(f,'width') || value(f,'depth') || value(f,'height') || value(f,'margin') || value(f,'spacing')
            ? { width: number(f,'width'), depth: number(f,'depth'), height: number(f,'height') } : undefined;
        const input = kind === 'BOM' ? { kind, code: value(f, 'code'), variantId: value(f, 'variantId'), body: { lines: readLines(f, 'bom') } } :
            kind === 'PROFILE' ? { kind, code: value(f, 'code'), printerId: value(f, 'printerId'), body: { groupingRules: initial?.kind === 'PROFILE' ? initial.body.groupingRules : undefined, plate: dimensions && { ...dimensions, margin: value(f,'margin') ? number(f,'margin') : null, spacing: value(f,'spacing') ? number(f,'spacing') : null }, name: value(f, 'name'), technology: value(f, 'technology'), material: value(f, 'material'), color: value(f, 'color'), appearance: value(f, 'appearance'), processCode: value(f, 'processCode') } } :
                { kind, code: value(f, 'code'), body: { envelope: dimensions, geometryCode: value(f,'geometryCode'), finishedColor: value(f,'finishedColor'), name: value(f, 'name'), unit: value(f, 'unit'), routing, objectsPerUnit: value(f, 'objectsPerUnit') ? number(f, 'objectsPerUnit') : null, mirrorRequired: f.get('mirrorRequired') === 'on', technology: value(f, 'technology'), material: value(f, 'material'), color: value(f, 'color'), appearance: value(f, 'appearance') } };
        await send({ action: 'SAVE_REVISION', input });
    }
    const components = data.revisions.filter(r => r.kind === 'COMPONENT' && r.status === 'PUBLISHED').map(r => ({ id: r.id, label: `${r.code} · r${r.revision}` }));
    return <form onSubmit={submit} className="space-y-5"><h3 className="text-lg font-semibold">{initial ? 'Tạo phiên bản tiếp theo' : 'Thêm dữ liệu sản xuất'}</h3><p className="text-sm leading-6 text-[#A5ADB8]">Lưu bản nháp → nhân viên xác nhận quy trình → quản trị viên công bố. Chỉ nhập thông tin và mã xác nhận; tệp chế tạo được lưu tại xưởng.</p><div className="grid gap-4 sm:grid-cols-2"><Field label="Loại dữ liệu"><select className={INPUT} value={kind} disabled={!!initial} onChange={e => setKind(e.target.value as Revision['kind'])}><option value="COMPONENT">Linh kiện / phụ kiện</option><option value="BOM">Định mức linh kiện sản phẩm</option><option value="PROFILE">Cấu hình máy in</option></select></Field><Field label="Mã định danh (không phải tên tệp)"><input name="code" required pattern="[A-Za-z0-9_-]+" maxLength={40} defaultValue={initial?.code} className={INPUT}/></Field></div>
 {kind === 'BOM' ? <><Field label="Biến thể sản phẩm"><select className={INPUT} name="variantId" required defaultValue={initial?.kind === 'BOM' ? initial.variantId : initialVariantId ?? ''}><option value="">Chọn biến thể</option>{data.variants.map(v => <option key={v.id} value={v.id}>{v.sku} · {v.name}</option>)}</select></Field><Quantities key={`bom-${initial?.id}`} name="bom" label="Linh kiện và số lượng mỗi bộ" options={components} initial={initial?.kind === 'BOM' ? initial.body.lines.map(l => ({ id: l.componentRevisionId, quantity: l.quantity })) : undefined}/></> :
            <><Field label="Tên hiển thị"><input className={INPUT} name="name" required maxLength={120} defaultValue={body?.name}/></Field>{kind === 'COMPONENT' ? <><Field label="Cách cung ứng"><select className={INPUT} value={routing} onChange={e => setRouting(e.target.value as typeof routing)}><option value="PRINTED">In 3D</option><option value="STOCKED">Có sẵn trong kho</option><option value="PURCHASED">Mua ngoài / chuẩn bị sẵn</option><option value="FINISHING">Hoàn thiện / đóng bộ</option></select></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Đơn vị (chiếc, bộ lắp tay, v.v.)"><input className={INPUT} name="unit" maxLength={40} defaultValue={initial?.kind === 'COMPONENT' ? initial.body.unit : ''}/></Field><Field label="Số vật thể thực tế trong mỗi đơn vị"><input className={INPUT} type="number" min="1" max="10000" name="objectsPerUnit" defaultValue={initial?.kind === 'COMPONENT' ? (initial.body.objectsPerUnit ?? '') : ''}/></Field></div><label className="flex items-center gap-3 text-sm"><input type="checkbox" name="mirrorRequired" defaultChecked={initial?.kind === 'COMPONENT' && initial.body.mirrorRequired}/>Cần nhân bản và đối xứng đơn vị này khi xếp bàn in</label></> :
                    <><Field label="Máy in"><select className={INPUT} name="printerId" required defaultValue={initial?.kind === 'PROFILE' ? initial.printerId : ''}><option value="">Chọn máy in</option>{data.printers.map(p => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}</select></Field><Field label="Mã quy trình / thông số đã được xưởng xác nhận"><input className={INPUT} name="processCode" pattern="[A-Za-z0-9_-]+" maxLength={40} defaultValue={initial?.kind === 'PROFILE' ? initial.body.processCode : ''}/></Field></>}
 {(kind === 'PROFILE' || routing === 'PRINTED') && <div className="grid gap-4 sm:grid-cols-2"><Field label="Công nghệ"><select className={INPUT} name="technology" defaultValue={body?.technology ?? ''}><option value="">Chọn công nghệ</option><option value="FDM">FDM</option><option value="SLA">Nhựa resin / SLA</option></select></Field>{(['material', 'color', 'appearance'] as const).map((k) => <Field key={k} label={{ material: 'Mã vật liệu', color: 'Mã màu in', appearance: 'Mã màu đục / trong' }[k]}><input className={INPUT} name={k} pattern="[A-Za-z0-9_-]+" maxLength={40} defaultValue={body?.[k]}/></Field>)}</div>}</>}
 {kind !== 'BOM' && <details><summary className="cursor-pointer text-sm">Hình học và kích thước đã xác nhận</summary>
 <p className="my-3 text-sm">{kind === 'PROFILE' ? 'Nhập đủ vùng in, lề và khoảng hở (mm) để kiểm tra xếp khay. Bản cũ dùng bố trí đã xác nhận tại xưởng.' : 'Kích thước của cả một đơn vị khi đặt in, gồm phần đỡ và phần đối xứng (mm).'}</p>
 <div className="grid gap-3 sm:grid-cols-2">{(['width','depth','height'] as const).map(k=><Field key={k} label={{width:'Rộng',depth:'Sâu',height:'Cao'}[k]}><input className={INPUT} name={k} type="number" step="0.001" min="0.001" defaultValue={initial?.kind==='PROFILE' ? initial.body.plate?.[k] : initial?.kind==='COMPONENT' ? initial.body.envelope?.[k] : ''}/></Field>)}
 {kind==='PROFILE' ? (['margin','spacing'] as const).map(k=><Field key={k} label={k==='margin'?'Lề mỗi cạnh':'Khoảng hở'}><input className={INPUT} name={k} type="number" min="0" step="0.001" defaultValue={initial?.kind==='PROFILE' ? initial.body.plate?.[k] : ''}/></Field>) : <><Field label="Mã hình học đã đối chiếu"><input className={INPUT} name="geometryCode" maxLength={40} defaultValue={initial?.kind==='COMPONENT'?initial.body.geometryCode:''}/></Field><Field label="Màu sau hoàn thiện"><input className={INPUT} name="finishedColor" maxLength={80} defaultValue={initial?.kind==='COMPONENT'?initial.body.finishedColor:''}/></Field></>}
 </div></details>}
 <button className={`${BUTTON} bg-[#EB4037] text-white`} disabled={busy} type="submit">Lưu phiên bản nháp</button></form>;
}
export function PrinterForm({ send, busy, initial }: {
    send: Command;
    busy: boolean;
    initial?: ProductionWorkspace['printers'][number];
}) {
    return <form className="space-y-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void send({ action: 'SAVE_PRINTER', id: initial?.id, input: { code: value(f, 'code'), name: value(f, 'name'), technology: value(f, 'technology'), status: value(f, 'status') } }); }}><h3 className="text-lg font-semibold">{initial ? 'Cập nhật máy in' : 'Thêm máy in cho xưởng'}</h3><div className="grid gap-4 sm:grid-cols-2"><Field label="Mã máy in"><input className={INPUT} name="code" required pattern="[A-Za-z0-9_-]+" maxLength={30} defaultValue={initial?.code}/></Field><Field label="Tên máy in"><input className={INPUT} name="name" required maxLength={120} defaultValue={initial?.name}/></Field><Field label="Công nghệ"><select className={INPUT} name="technology" required defaultValue={initial?.technology ?? ''}><option value="">Chọn</option><option value="FDM">FDM</option><option value="SLA">SLA</option></select></Field><Field label="Trạng thái xác nhận"><select className={INPUT} name="status" defaultValue={initial?.status ?? 'OFFLINE'}><option value="OFFLINE">Chưa sẵn sàng</option><option value="AVAILABLE">Đã xác nhận, sẵn sàng</option><option value="MAINTENANCE">Đang bảo trì / gặp sự cố</option><option value="RETIRED">Ngừng sử dụng</option></select></Field></div><button type="submit" className={BUTTON} disabled={busy}>Lưu máy in</button></form>;
}
export function InventoryForm({ data, send, busy }: {
    data: ProductionWorkspace;
    send: Command;
    busy: boolean;
}) {
    const [key, setKey] = useState('');
    const current = data.inventory.find(x => x.key === key);
    const options = data.revisions.filter(r => r.status === 'PUBLISHED').map(r => ({ key: r.kind === 'COMPONENT' ? `component:${r.id}` : r.kind === 'BOM' ? `finished:${r.variantId}:${r.id}` : `material:${r.body.material}:${r.body.color}:${r.body.appearance}`, label: `${r.kind === 'COMPONENT' ? 'Linh kiện' : r.kind === 'BOM' ? 'Sản phẩm hoàn thiện' : 'Vật liệu'} · ${r.code} r${r.revision}` }));
    return <form className="space-y-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void send({ action: 'INVENTORY', stockKey: key, quantity: number(f, 'quantity'), revision: current?.revision ?? 0 }); }}><h3 className="text-lg font-semibold">Ghi nhận tồn kho chưa phân bổ</h3><p className="text-sm leading-6 text-[#A5ADB8]">Nhập số lượng đã đạt kiểm tra chất lượng còn lại sau kiểm kê. Không tính hàng đã giữ cho đơn. Tồn kho chưa xác nhận được xem là thiếu dữ liệu; cần xác nhận cả trường hợp số lượng bằng không.</p><Field label="Mặt hàng tồn kho"><select className={INPUT} required value={key} onChange={e => setKey(e.target.value)}><option value="">Chọn</option>{[...new Map(options.map(o => [o.key, o])).values()].map(o => <option key={o.key} value={o.key}>{o.label}</option>)}</select></Field><p className="text-sm text-[#A5ADB8]">Số liệu hiện tại: {current ? `${current.available} · phiên bản ${current.revision}` : 'Chưa ghi nhận kiểm kê'}</p><Field label="Số lượng thực tế chưa phân bổ (đơn vị theo định mức; vật liệu tính bằng g/ml)"><input className={INPUT} type="number" min="0" max="1000000" step={key.startsWith('material:') ? '0.001' : '1'} required name="quantity"/></Field><button type="submit" className={BUTTON} disabled={busy}>Xác nhận kiểm kê</button></form>;
}
export function CheckForm({ data, send, busy }: {
    data: ProductionWorkspace;
    send: Command;
    busy: boolean;
}) {
    const components = data.revisions.filter(r => r.kind === 'COMPONENT' && r.status === 'PUBLISHED' && r.body.routing === 'PRINTED').map(r => ({ id: r.id, label: `${r.code} r${r.revision}` }));
    return <form className="space-y-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); void send({ action: 'SAVE_CHECK', input: { code: value(f, 'code'), profileRevisionId: value(f, 'profileRevisionId'), members: readLines(f, 'member'), durationMinutes: number(f, 'durationMinutes'), preparationMinutes: number(f, 'preparationMinutes'), finishingMinutes: number(f, 'finishingMinutes'), materialQuantity: number(f, 'materialQuantity'), evidenceCode: value(f, 'evidenceCode'), resourcesConfirmed: f.get('confirmed') === 'on' } }); }}><h3 className="text-lg font-semibold">Xác nhận thiết lập in cho toàn mẻ</h3><p className="text-sm leading-6 text-[#A5ADB8]">Kiểm tra thông số cắt lớp, giá đỡ, khoảng hở và cách đối xứng trên máy in của xưởng. Số lượng tính theo đơn vị hoặc bộ đã công bố; không tính một bộ lắp tay thành một vật thể.</p><div className="grid gap-4 sm:grid-cols-2"><Field label="Mã mẻ đã xác nhận"><input className={INPUT} required name="code" pattern="[A-Za-z0-9_-]+" maxLength={40}/></Field><Field label="Mã xác nhận của xưởng"><input className={INPUT} required name="evidenceCode" pattern="[A-Za-z0-9_-]+" maxLength={40}/></Field></div><Field label="Cấu hình máy in"><select className={INPUT} name="profileRevisionId" required><option value="">Chọn cấu hình đã công bố</option>{data.revisions.filter(r => r.kind === 'PROFILE' && r.status === 'PUBLISHED').map(r => <option key={r.id} value={r.id}>{r.code} r{r.revision}</option>)}</select></Field><Quantities name="member" options={components} label="Linh kiện và số lượng thực tế trong mẻ"/><div className="grid gap-4 sm:grid-cols-2">{(['durationMinutes', 'preparationMinutes', 'finishingMinutes', 'materialQuantity'] as const).map(n => <Field key={n} label={{ durationMinutes: 'Thời gian in mẻ (phút)', preparationMinutes: 'Thời gian chuẩn bị / thiết lập (phút)', finishingMinutes: 'Thời gian từ lúc in xong đến bàn giao đóng gói (phút)', materialQuantity: 'Vật liệu cho mẻ (g/ml)' }[n]}><input className={INPUT} type="number" required min={n === 'materialQuantity' ? '0.001' : n === 'durationMinutes' ? '1' : '0'} step={n === 'materialQuantity' ? '0.001' : '1'} name={n}/></Field>)}</div><label className="flex items-start gap-3 text-sm leading-6"><input className="mt-1" type="checkbox" name="confirmed" required/>Tôi đã kiểm tra cách xếp, giá đỡ/đối xứng, vật liệu, cấu hình máy, nhân sự và bàn giao đóng gói cho số lượng trên.</label><button className={`${BUTTON} bg-[#EB4037] text-white`} type="submit" disabled={busy}>Lưu xác nhận kỹ thuật</button></form>;
}

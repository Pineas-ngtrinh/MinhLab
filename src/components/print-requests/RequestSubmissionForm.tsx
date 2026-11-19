'use client';
import { useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { readApiResponse } from '../../lib/read-api-response';
import type { PrintRequestView } from '../../contracts/print-requests';
import { BUTTON, INPUT, Field } from '../admin/production/ProductionForms';
interface Preset {
    file: File | null;
    quantity: number;
    material: string;
    color: string;
    purpose: string;
    note: string;
    name: string;
    phone: string;
    rights: boolean;
    validationError?: string | null;
}
export function RequestSubmissionForm({ preset, existing, onSaved }: {
    preset?: Preset;
    existing?: PrintRequestView;
    onSaved?: () => void;
}) {
    const { user, login, isAuthReady } = useAuth();
    const [busy, setBusy] = useState(false);
    const lock = useRef(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const upload = useRef<{
        file: File;
        id: string;
    } | null>(null);
    const retry = useRef<{
        payload: string;
        key: string;
    } | null>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    async function submit(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (lock.current || saved)
            return;
        lock.current = true;
        setBusy(true);
        setError('');
        setSaved(false);
        const form = new FormData(e.currentTarget);
        const str = (n: string) => String(form.get(n) ?? '');
        try {
            if (preset?.validationError) throw new Error(preset.validationError);
            const file = preset?.file ?? (form.get('file') instanceof File && (form.get('file') as File).size ? (form.get('file') as File) : null);
            let fileId = existing?.file?.availability === 'PURGED' ? null : existing?.file?.id ?? null;
            if (file) {
                if (file.size > 50 * 1024 * 1024) throw new Error('File tải lên tối đa 50 MB. File xem trước có thể lớn hơn; hãy giảm dung lượng hoặc liên hệ xưởng.');
                const format = file.name.split('.').pop()?.toUpperCase();
                if (!format || !['STL', 'OBJ', 'STEP'].includes(format))
                    throw new Error('Chỉ nhận STL, OBJ hoặc STEP theo cấu hình xưởng.');
                if (upload.current?.file !== file) {
                    const r = await fetch('/api/print-files', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-Model-Format': format, 'X-File-Name': encodeURIComponent(file.name) }, body: file });
                    const b = await readApiResponse<{ id: string }>(r);
                    if (!r.ok || !b.success)
                        throw new Error(b.error ?? 'Chưa lưu được file.');
                    upload.current = { file, id: b.data.id };
                }
                fileId = upload.current!.id;
            }
            const input = { fileId, quantity: preset?.quantity ?? Number(str('quantity')), material: preset?.material ?? str('material'), color: preset?.color ?? str('color'), purpose: preset?.purpose ?? str('purpose'), note: preset?.note ?? str('note'), rightsAccepted: preset?.rights ?? form.get('rights') === 'on', contact: { name: preset?.name ?? str('name'), phone: preset?.phone ?? str('phone'), address: str('address') } };
            const payload = JSON.stringify({ action: 'SUBMIT', input, ...(existing ? { id: existing.id, revision: existing.revision } : {}) });
            if (retry.current?.payload !== payload)
                retry.current = { payload, key: crypto.randomUUID() };
            const r = await fetch('/api/print-requests', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': retry.current.key }, body: payload });
            const b = await readApiResponse<{ id: string }>(r);
            if (!r.ok || !b.success)
                throw new Error(b.error ?? 'Chưa lưu được yêu cầu.');
            retry.current = null;
            setSaved(true);
            onSaved?.();
        }
        catch (c) {
            setError(c instanceof Error ? c.message : 'Chưa thể gửi yêu cầu.');
        }
        finally {
            lock.current = false;
            setBusy(false);
        }
    }
    if (!isAuthReady)
        return <p role="status" className="py-5 text-sm">Đang kiểm tra phiên đăng nhập…</p>;
    if (!user)
        return <section className="space-y-4 border-t border-[#27313C] py-6"><h2 className="text-xl font-semibold">Gửi yêu cầu đến xưởng</h2><p className="text-sm leading-6 text-[#A5ADB8]">Đăng nhập tại đây để giữ file đang chọn trong tab. Yêu cầu chính thức và file riêng tư gắn với tài khoản của bạn.</p><form className="grid max-w-xl gap-3" onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError('');
                try {
                    await login(email, password);
                    setPassword('');
                }
                catch (c) {
                    setError(c instanceof Error ? c.message : 'Chưa đăng nhập được.');
                }
                finally {
                    setBusy(false);
                }
            }}><Field label="Email"><input className={INPUT} type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)}/></Field><Field label="Mật khẩu"><input className={INPUT} type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)}/></Field>{error && <p role="alert" className="text-sm text-[#FFB0A7]">{error}</p>}<button className={BUTTON} disabled={busy}>Đăng nhập để gửi yêu cầu</button><Link className="py-2 text-sm text-[#C8A261]" href="/dang-ky" target="_blank" rel="noopener">Chưa có tài khoản? Đăng ký trong tab mới</Link></form></section>;
    if (user.role !== 'CUSTOMER')
        return <p className="py-5 text-sm text-[#A5ADB8]">Tài khoản khách hàng dùng để gửi yêu cầu. Nhân sự xử lý tại bàn làm việc.</p>;
    return <form onSubmit={submit} className="space-y-4 border-t border-[#27313C] py-6"><h2 className="text-xl font-semibold">{existing ? 'Bổ sung revision mới' : 'Gửi yêu cầu chính thức'}</h2><p className="max-w-3xl text-sm leading-6 text-[#A5ADB8]">Giá đang xem là tham khảo. Xưởng kiểm file và gửi báo giá có hạn hiệu lực; bạn chỉ tạo đơn sau khi đồng ý toàn bộ báo giá. Chưa có file vẫn gửi phiếu tư vấn và bổ sung sau.</p><details className="max-w-3xl text-sm leading-6 text-[#A5ADB8]"><summary className="cursor-pointer py-2 text-[#C8A261]">Thời hạn lưu file và quyền riêng tư</summary><p>File chỉ được tải lên khi bạn gửi yêu cầu. File tải lên bỏ dở được giữ 48 giờ; yêu cầu đã kết thúc mà không đặt in giữ thêm 48 giờ. Nếu đặt in, xưởng giữ file trong suốt quá trình làm đơn và 7 ngày sau khi hoàn tất. Khi hết hạn lưu, bạn cần gửi lại file nếu muốn in tiếp.</p></details>
 {preset ? <p className="text-sm leading-6">{preset.file?.name ?? 'Chưa có file'} · {preset.quantity} bản · {preset.material} · {preset.color}<br />{preset.name || 'Cần điền họ tên ở phần trên'} · {preset.phone || 'Cần điền điện thoại ở phần trên'}</p> : <><Field label={existing?.file ? 'File STL / OBJ / STEP mới (để trống để giữ bản cũ)' : 'File STL / OBJ / STEP (có thể bổ sung sau)'}><input className={INPUT} type="file" accept=".stl,.obj,.step" name="file"/></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Số lượng"><input className={INPUT} type="number" name="quantity" min="1" max="100" step="1" required defaultValue={existing?.quantity ?? 1}/></Field><Field label="Vật liệu mong muốn"><input className={INPUT} required name="material" maxLength={120} defaultValue={existing?.requested.material}/></Field><Field label="Màu mong muốn"><input className={INPUT} required name="color" maxLength={60} defaultValue={existing?.requested.color}/></Field><Field label="Họ tên người nhận"><input className={INPUT} required name="name" maxLength={120} defaultValue={existing?.contact.name ?? user.fullName}/></Field><Field label="Điện thoại"><input className={INPUT} required name="phone" maxLength={20} defaultValue={existing?.contact.phone}/></Field></div><Field label="Mục đích, kích thước / tỷ lệ và yêu cầu hoàn thiện"><textarea className={INPUT} required name="purpose" maxLength={1000} defaultValue={existing?.requested.purpose}/></Field><Field label="Ghi chú"><textarea className={INPUT} name="note" maxLength={2000} defaultValue={existing?.note}/></Field><label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" name="rights" className="mt-1" required defaultChecked={existing?.rightsAccepted}/>Tôi có quyền sử dụng và gửi file cho xưởng kiểm tra / chế tạo.</label></>}
 <Field label="Địa chỉ nhận hàng để xưởng xác định phí"><textarea className={INPUT} name="address" required maxLength={255} defaultValue={existing?.contact.address}/></Field>{error && <p role="alert" className="break-words text-sm text-[#FFB0A7]">{error}</p>}{saved && <p role="status" className="text-sm text-[#C8A261]">Đã lưu yêu cầu. <Link href="/yeu-cau-in" className="underline">Mở phiếu và theo dõi báo giá</Link> <button className="ml-2 underline" type="button" onClick={() => setSaved(false)}>Tạo phiếu tiếp theo</button></p>}<button type="submit" className={`${BUTTON} bg-[#EB4037] text-white`} disabled={busy || saved}>{busy ? 'Đang lưu file và yêu cầu…' : preset?.file || existing?.file ? 'Gửi yêu cầu in' : 'Gửi phiếu tư vấn, bổ sung file sau'}</button></form>;
}

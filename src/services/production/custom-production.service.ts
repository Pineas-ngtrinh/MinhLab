import type { CustomProductionDependencies, CustomProductionWriter } from './custom-production.ports';
import type { CustomBatchInput } from '../../contracts/custom-production';
import { materialStockKey } from '../../domain/production/planning';
import { AppError } from '../../lib/errors';
type Actor = {
    id: string;
    role: string;
};
const permit = (a: Actor, roles: string[]) => {
    if (!roles.includes(a.role))
        throw new AppError('Không có quyền thực hiện bước in theo yêu cầu này.', 403);
};
export function createCustomProduction(d: CustomProductionDependencies) {
    const mutate = (a: Actor, key: string, input: unknown, run: (w: CustomProductionWriter) => Promise<unknown>) => d.transaction(async (w) => {
        const hash = d.hash(input), prior = await w.replay(key);
        if (prior) {
            if (prior.actorId !== a.id || prior.hash !== hash)
                throw new AppError('Khóa thao tác đã dùng với nội dung khác.', 409);
            return prior.result;
        }
        const result = await run(w);
        await w.remember(key, a.id, hash, result);
        return result;
    });
    return {
        view: (a: Actor) => d.transaction(async (w) => {
            const v = await w.view();
            if (a.role === 'FILE_REVIEWER') {
                v.items = v.items.filter(i => i.reviewerId === a.id);
                v.batches = v.batches.filter(b => v.items.some(i => i.id === b.itemId));
            }
            return v;
        }),
        approve(a: Actor, key: string, input: CustomBatchInput) {
            permit(a, ['FILE_REVIEWER']);
            if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 100 || !Number.isInteger(input.durationMinutes) || input.durationMinutes < 1 || !Number.isFinite(input.materialQuantity) || input.materialQuantity <= 0 || !Number.isFinite(Date.parse(input.startAt)))
                throw new AppError('Thông số mẻ in theo yêu cầu không hợp lệ.');
            return mutate(a, key, { action: 'APPROVE_CUSTOM_BATCH', input }, async (w) => {
                const v = await w.view(), s = await w.resources();
                const item = v.items.find(i => i.id === input.itemId);
                if (!item || item.reviewerId !== a.id)
                    throw new AppError('Không tìm thấy phiếu in theo yêu cầu được phân công.', 404);
                if (item.paymentStatus !== 'PAID' || !['CONFIRMED', 'IN_PRODUCTION'].includes(item.orderStatus) || item.packedAt || !item.fileReady)
                    throw new AppError('Đơn hoặc tệp chưa đủ điều kiện để tạo công việc.', 409);
                const batches = v.batches.filter(b => b.itemId === item.id);
                const covered = batches.reduce((n, b) => n + (['FAILED', 'COMPLETED', 'CANCELLED'].includes(b.status) ? b.good : b.quantity), 0);
                if (input.quantity > item.quantity - covered)
                    throw new AppError('Vượt số lượng còn thiếu; không tạo trùng lượng đang thực hiện hoặc đã đạt kiểm tra chất lượng.', 409);
                const profile = s.revisions.find(r => r.id === input.profileId && r.kind === 'PROFILE' && r.status === 'PUBLISHED');
                if (!profile || profile.kind !== 'PROFILE' || profile.body.technology !== item.technology || profile.body.material !== item.materialCode || profile.body.color !== item.color)
                    throw new AppError('Cấu hình máy in chưa được công bố hoặc không khớp vật liệu/công nghệ/màu đã chốt.', 409);
                if (s.printers.find(p => p.id === profile.printerId)?.status !== 'AVAILABLE')
                    throw new AppError('Máy chưa được xác nhận sẵn sàng.', 409);
                const stock = s.inventory.find(i => i.key === materialStockKey(profile.body));
                if (!stock || stock.available < input.materialQuantity)
                    throw new AppError('Tồn vật liệu chưa xác nhận hoặc không đủ cho cả mẻ.', 409);
                if (!input.confirmed)
                    throw new AppError('Cần nhân viên kỹ thuật xác nhận cách xếp bàn in, giá đỡ và vật tư cho cả mẻ.', 409);
                const id = await w.approve(input, a.id);
                await w.audit('CUSTOM_BATCH_APPROVED', id, a.id, { quantity: input.quantity, evidenceCode: input.evidenceCode });
                return { id };
            });
        },
        step(a: Actor, key: string, id: string, action: 'START' | 'FINISH' | 'QC_READY' | 'FAIL') {
            permit(a, ['PRINT_OPERATOR']);
            return mutate(a, key, { action: `CUSTOM_${action}`, id }, async (w) => {
                const v = await w.view();
                const b = v.batches.find(b => b.id === id);
                if (!b)
                    throw new AppError('Không tìm thấy mẻ in theo yêu cầu.', 404);
                if (b.status !== ({ START: 'QUEUED', FINISH: 'PRINTING', QC_READY: 'POST_PROCESSING', FAIL: 'PRINTING' }[action]))
                    throw new AppError('Mẻ in không ở bước xử lý phù hợp.', 409);
                if (action === 'START') {
                    const item = v.items.find(i => i.id === b.itemId), s = await w.resources();
                    if (!item || item.paymentStatus !== 'PAID' || !item.fileReady || !['CONFIRMED', 'IN_PRODUCTION'].includes(item.orderStatus))
                        throw new AppError('Đơn hoặc tệp không còn đủ điều kiện.', 409);
                    if (Date.parse(b.startAt) > Date.parse(d.now()))
                        throw new AppError('Chưa đến giờ bắt đầu đã được duyệt.', 409);
                    if (s.printers.find(p => p.id === b.printerId)?.status !== 'AVAILABLE' || !s.revisions.some(r => r.id === b.profileId && r.status === 'PUBLISHED'))
                        throw new AppError('Máy in hoặc cấu hình chưa sẵn sàng hay đã bị thu hồi.', 409);
                }
                await w.step(b, action, a.id);
                await w.audit(`CUSTOM_${action}`, id, a.id, {});
                return { id };
            });
        },
        qc(a: Actor, key: string, id: string, good: number, failed: number) {
            permit(a, ['PRINT_OPERATOR']);
            return mutate(a, key, { action: 'CUSTOM_QC', id, good, failed }, async (w) => {
                const b = (await w.view()).batches.find(b => b.id === id);
                if (!b)
                    throw new AppError('Không tìm thấy mẻ.', 404);
                if (b.status !== 'QC_PENDING' || !Number.isInteger(good) || !Number.isInteger(failed) || good < 0 || failed < 0 || good + failed !== b.quantity)
                    throw new AppError('Phải ghi đủ số lượng đạt/lỗi của cả mẻ.', 409);
                await w.qc(b, good, failed, a.id);
                await w.audit('CUSTOM_QC_RECORDED', id, a.id, { good, failed });
                return { id };
            });
        },
        pack(a: Actor, key: string, id: string, ready: boolean) {
            permit(a, ['PRINT_OPERATOR']);
            return mutate(a, key, { action: ready ? 'CUSTOM_READY' : 'CUSTOM_PACK', id }, async (w) => {
                const v = await w.view();
                const item = v.items.find(i => i.id === id);
                if (!item)
                    throw new AppError('Không tìm thấy sản phẩm in theo yêu cầu.', 404);
                const batches = v.batches.filter(b => b.itemId === id);
                if (item.paymentStatus !== 'PAID' || !['CONFIRMED', 'IN_PRODUCTION'].includes(item.orderStatus) || batches.reduce((n, b) => n + b.good, 0) !== item.quantity || batches.some(b => !['FAILED', 'COMPLETED', 'CANCELLED'].includes(b.status)))
                    throw new AppError('Chưa đủ số lượng đạt kiểm tra chất lượng hoặc vẫn còn mẻ đang mở.', 409);
                if (ready ? !item.packedAt : !!item.packedAt)
                    throw new AppError('Không ở bước bàn giao/đóng gói phù hợp.', 409);
                await w.pack(id, ready, a.id);
                await w.audit(ready ? 'CUSTOM_PACKING_COMPLETED' : 'CUSTOM_PACKING_TRANSFERRED', id, a.id, {});
                return { id };
            });
        },
    };
}

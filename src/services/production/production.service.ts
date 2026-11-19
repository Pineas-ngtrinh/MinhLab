import type { ProductionDependencies, ProductionNotifications, ProductionWriter, ProductionActor } from './production.ports';
import type { RevisionInput, TechnicalCheckInput, Printer } from '../../contracts/production';
import { buildPlan, revisionProblems, checkProblems, eligible, canPack, hasEarlierUnfinishedOrder } from '../../domain/production/planning';
import { AppError } from '../../lib/errors';
import { canDeleteProductionPlan } from '../../domain/production/plan-policy';
function permit(actor: ProductionActor, roles: ProductionActor['role'][]) {
    if (!roles.includes(actor.role))
        throw new AppError('Vai trò hiện tại không có quyền thực hiện thao tác sản xuất này.', 403);
}
function assertProblems(problems: string[]) {
    const labels: Record<string, string> = { COMPONENT_UNIT_UNCONFIRMED: 'Chưa xác nhận đơn vị/nhóm và số vật thể trong mỗi đơn vị.', PRINT_SPEC_INCOMPLETE: 'Thiếu công nghệ, vật liệu, màu in hoặc quy cách đục/trong.', PROFILE_INCOMPLETE: 'Cấu hình máy in chưa đủ quy cách và mã quy trình đã kiểm định.', PRINTER_TECHNOLOGY_MISMATCH: 'Máy in không phù hợp với công nghệ đã chọn.', BOM_EMPTY: 'Định mức linh kiện chưa có thành phần.', INVALID_BOM_QUANTITY: 'Số lượng linh kiện phải là số nguyên dương.' };
    if (problems.length)
        throw new AppError(problems.map(p => labels[p] ?? p).join(' · '), 409);
}
export function createProductionService(d: ProductionDependencies) {
    async function mutate(actor: ProductionActor, key: string, action: string, input: unknown, run: (w: ProductionWriter, notifications?: ProductionNotifications) => Promise<unknown>) {
        return d.transaction(async (w, notifications) => {
            const requestHash = d.hash({ action, input });
            const replay = await w.replay(key);
            if (replay) {
                if (replay.actorId !== actor.id || replay.requestHash !== requestHash)
                    throw new AppError('Khóa thao tác đã dùng với nội dung hoặc người thực hiện khác.', 409);
                return replay.result;
            }
            const result = await run(w, notifications);
            await w.remember(key, actor.id, requestHash, result);
            return result;
        });
    }
    return {
        workspace: () => d.transaction(w => w.workspace()),
        saveRevision(actor: ProductionActor, key: string, input: RevisionInput) {
            permit(actor, ['ADMIN', 'WORKSHOP_OPERATOR']);
            return mutate(actor, key, 'REVISION_CREATE', input, async (w) => {
                const id = await w.saveRevision(input, actor.id);
                await w.audit('MANUFACTURING_DRAFT_CREATED', id, actor.id, { kind: input.kind, code: input.code });
                return { id };
            });
        },
        revisionAction(actor: ProductionActor, key: string, id: string, action: 'VERIFY' | 'PUBLISH' | 'REVOKE') {
            permit(actor, action === 'VERIFY' ? ['PRINT_OPERATOR', 'WORKSHOP_OPERATOR'] : ['ADMIN']);
            return mutate(actor, key, action, { id }, async (w) => {
                const s = await w.snapshot();
                const r = s.revisions.find(x => x.id === id);
                if (!r)
                    throw new AppError('Không tìm thấy phiên bản dữ liệu.', 404);
                if (action !== 'REVOKE' && r.status !== 'DRAFT')
                    throw new AppError('Chỉ xử lý bản nháp; bản đã công bố không được sửa.', 409);
                if (action !== 'REVOKE')
                    assertProblems(revisionProblems(r, s));
                if (action === 'PUBLISH' && !r.verifiedBy)
                    throw new AppError('Cần thợ xác nhận kỹ thuật trước khi công bố.', 409);
                await w.setRevision(id, action === 'PUBLISH' ? 'PUBLISHED' : action === 'REVOKE' ? 'REVOKED' : 'DRAFT', actor.id, action === 'VERIFY');
                await w.audit(`MANUFACTURING_${action}`, id, actor.id, {});
                await w.event(action === 'PUBLISH' ? 'ManufacturingRevisionPublished' : 'ManufacturingRevisionChanged', id);
                return { id };
            });
        },
        savePrinter(actor: ProductionActor, key: string, input: Omit<Printer, 'id'>, id?: string) {
            permit(actor, ['ADMIN']);
            return mutate(actor, key, 'PRINTER_SAVE', { input, id }, async (w) => {
                const s = await w.snapshot();
                if (id && s.holds.some(h => h.printerId === id) && s.printers.some(p => p.id === id && p.technology !== input.technology))
                    throw new AppError('Không đổi công nghệ của máy đang được giữ.', 409);
                const printerId = await w.savePrinter(input, actor.id, id);
                await w.audit('PRINTER_SAVED', printerId, actor.id, input);
                await w.event('MachineChanged', printerId);
                return { id: printerId };
            });
        },
        inventory(actor: ProductionActor, key: string, stockKey: string, quantity: number, revision: number) {
            permit(actor, ['ADMIN', 'PRINT_OPERATOR', 'WORKSHOP_OPERATOR']);
            if (!Number.isFinite(quantity) || quantity < 0 || Math.abs(quantity * 1000 - Math.round(quantity * 1000)) > 0.000001)
                throw new AppError('Lượng tồn không hợp lệ hoặc vượt quá ba chữ số thập phân.');
            if (!stockKey.startsWith('material:') && !Number.isInteger(quantity))
                throw new AppError('Tồn đơn vị/nhóm linh kiện phải là số nguyên.');
            return mutate(actor, key, 'INVENTORY_CONFIRM', { stockKey, quantity, revision }, async (w) => {
                const s = await w.snapshot();
                const valid = stockKey.startsWith('component:') ? s.revisions.some(r => r.id === stockKey.slice(10) && r.kind === 'COMPONENT' && r.status === 'PUBLISHED') :
                    stockKey.startsWith('finished:') ? s.revisions.some(r => r.kind === 'BOM' && r.status === 'PUBLISHED' && stockKey === `finished:${r.variantId}:${r.id}`) :
                        s.revisions.some(r => r.kind === 'PROFILE' && r.status === 'PUBLISHED' && stockKey === `material:${r.body.material}:${r.body.color}:${r.body.appearance}`);
                if (!valid)
                    throw new AppError('Mặt hàng tồn kho phải tham chiếu dữ liệu cấu hình đã công bố.');
                await w.inventory(stockKey, quantity, revision, actor.id);
                return { key: stockKey };
            });
        },
        saveCheck(actor: ProductionActor, key: string, input: TechnicalCheckInput) {
            permit(actor, ['PRINT_OPERATOR', 'WORKSHOP_OPERATOR']);
            return mutate(actor, key, 'CHECK_CREATE', input, async (w) => {
                assertProblems(checkProblems(input, await w.snapshot()));
                const id = await w.saveCheck(input, actor.id);
                await w.audit('BATCH_TECHNICALLY_CONFIRMED', id, actor.id, { code: input.code });
                return { id };
            });
        },
        revokeCheck(actor: ProductionActor, key: string, id: string) {
            permit(actor, ['PRINT_OPERATOR', 'WORKSHOP_OPERATOR', 'ADMIN']);
            return mutate(actor, key, 'CHECK_REVOKE', { id }, async (w) => { await w.revokeCheck(id); await w.audit('BATCH_CHECK_REVOKED', id, actor.id, {}); return { id }; });
        },
        prepare(actor: ProductionActor, key: string, itemIds: string[]) {
            permit(actor, ['ADMIN', 'WORKSHOP_OPERATOR', 'AGENT']);
            return mutate(actor, key, 'REQUIREMENTS_PREPARE', { itemIds }, async (w) => {
                const s = await w.snapshot();
                if (itemIds.some(id => !s.items.some(i => i.id === id && eligible(i))))
                    throw new AppError('Chỉ chuẩn bị mặt hàng trong danh mục khi đã đủ điều kiện.', 409);
                await w.pinRequirements(itemIds);
                return { itemIds };
            });
        },
        propose(actor: ProductionActor, key: string, itemIds: string[], checkIds: string[], startAt: string, existing?: {
            id: string;
            revision: number;
        }, scheduleUnconfirmed = false) {
            permit(actor, ['ADMIN', 'WORKSHOP_OPERATOR', 'AGENT']);
            return mutate(actor, key, 'PLAN_PROPOSE', { itemIds, checkIds, startAt, existing, scheduleUnconfirmed }, async (w, notifications) => {
                await w.pinRequirements(itemIds);
                const s = await w.snapshot();
                if (existing) {
                    const old = await w.plan(existing.id);
                    if (!old || old.revision !== existing.revision || ['APPROVED', 'SUPERSEDED'].includes(old.status))
                        throw new AppError('Phiên bản kế hoạch này không thể sửa; hãy tạo phương án điều chỉnh.', 409);
                }
                const body = buildPlan(s, itemIds, checkIds, startAt);
                if (scheduleUnconfirmed)
                    body.blockers.push('SCHEDULE_UNCONFIRMED: Cần người có quyền xác nhận khung giờ trước khi duyệt.');
                const id = await w.savePlan(body, d.hash(s), actor.id, existing?.id, existing?.revision);
                await w.audit('PLAN_PROPOSED', id, actor.id, { blockers: body.blockers, proposedBy: actor.role });
                await notifications?.planProposed({
                    planId: id,
                    revision: (existing?.revision ?? 0) + 1,
                    status: body.blockers.length ? 'WAITING_DATA' : 'PENDING_APPROVAL',
                    orderCount: new Set(s.items.filter(item => body.itemIds.includes(item.id)).map(item => item.orderId)).size,
                    batchCount: body.jobs.length,
                    blockerCount: body.blockers.length,
                });
                return { id };
            });
        },
        deletePlan(actor: ProductionActor, key: string, id: string, revision: number) {
            permit(actor, ['ADMIN']);
            return mutate(actor, key, 'PLAN_DELETE', { id, revision }, async (w) => {
                const plan = await w.plan(id);
                if (!plan) throw new AppError('Không tìm thấy kế hoạch.', 404);
                if (plan.revision !== revision) throw new AppError('Kế hoạch đã có phiên bản mới. Hãy tải lại.', 409);
                if (!canDeleteProductionPlan(plan.status))
                    throw new AppError('Chỉ xóa kế hoạch chưa được duyệt; kế hoạch đã phân công phải giữ lịch sử sản xuất.', 409);
                await w.deletePlan(id, revision, actor.id);
                await w.audit('PLAN_DELETED', id, actor.id, { revision, status: plan.status });
                return { id, explanation: 'Đã xóa kế hoạch khỏi danh sách.' };
            });
        },
        decide(actor: ProductionActor, key: string, id: string, revision: number, decision: 'APPROVE' | 'REJECT', note: string) {
            permit(actor, ['ADMIN', 'PRINT_OPERATOR', 'WORKSHOP_OPERATOR']);
            return mutate(actor, key, 'PLAN_DECIDE', { id, revision, decision, note }, async (w) => {
                const plan = await w.plan(id);
                if (!plan)
                    throw new AppError('Không tìm thấy kế hoạch.', 404);
                if (plan.revision !== revision)
                    throw new AppError('Kế hoạch đã có phiên bản mới. Hãy tải lại.', 409);
                if (!['WAITING_DATA', 'PENDING_APPROVAL'].includes(plan.status))
                    throw new AppError('Kế hoạch đã được quyết định hoặc cần tính lại.', 409);
                if (decision === 'REJECT') {
                    await w.decidePlan(id, 'REJECTED', actor.id, note);
                    await w.audit('PLAN_REJECTED', id, actor.id, { note });
                    return { id, status: 'REJECTED' };
                }
                if (plan.body.blockers.length || plan.status !== 'PENDING_APPROVAL')
                    throw new AppError('Kế hoạch đang chờ dữ liệu, chưa được duyệt.', 409);
                const s = await w.snapshot();
                if (d.hash(s) !== plan.snapshotHash || plan.body.jobs.some(j => Date.parse(j.startAt) < Date.parse(d.now()))) {
                    await w.decidePlan(id, 'STALE', actor.id, 'Dữ liệu hoặc lịch đã thay đổi.');
                    await w.audit('PLAN_STALE', id, actor.id, {});
                    return { id, status: 'STALE' };
                }
                await w.applyPlan(plan, actor.id);
                await w.decidePlan(id, 'APPROVED', actor.id, note);
                await w.audit('PLAN_APPROVED', id, actor.id, { revision });
                await w.event('PlanApproved', id);
                return { id, status: 'APPROVED' };
            });
        },
        jobAction(actor: ProductionActor, key: string, id: string, action: 'START' | 'FINISH' | 'QC_READY' | 'FAIL', machineFailure = false) {
            permit(actor, ['PRINT_OPERATOR', 'WORKSHOP_OPERATOR']);
            return mutate(actor, key, `JOB_${action}`, { id, machineFailure }, async (w) => {
                const s = await w.snapshot();
                const job = s.jobs.find(j => j.id === id);
                if (!job)
                    throw new AppError('Không tìm thấy mẻ in.', 404);
                const expected = { START: 'QUEUED', FINISH: 'PRINTING', QC_READY: 'POST_PROCESSING', FAIL: 'PRINTING' }[action];
                if (job.status !== expected)
                    throw new AppError('Mẻ in không ở bước phù hợp.', 409);
                if (action === 'START') {
                    const hold = s.holds.find(h => h.id === job.holdId);
                    const printer = s.printers.find(p => p.id === job.printerId);
                    if (!hold || printer?.status !== 'AVAILABLE' || s.jobs.some(j => j.printerId === job.printerId && j.status === 'PRINTING'))
                        throw new AppError('Máy chưa sẵn sàng hoặc đang chạy mẻ khác.', 409);
                    if (Date.parse(job.startAt) > Date.parse(d.now()))
                        throw new AppError('Chưa đến giờ bắt đầu đã được duyệt.', 409);
                    if (!s.checks.some(c => c.id === job.check.id && !c.revoked))
                        throw new AppError('Xác nhận kỹ thuật đã bị thu hồi.', 409);
                    assertProblems(checkProblems(job.check, s));
                    if (job.supplies.some(a => !s.items.some(i => i.id === a.itemId && eligible(i))))
                        throw new AppError('Đơn không còn đủ điều kiện sản xuất.', 409);
                }
                await w.jobAction(job, action, actor.id, machineFailure);
                await w.audit(`JOB_${action}`, id, actor.id, { machineFailure });
                await w.event(`Job${action}`, id);
                return { id };
            });
        },
        inspect(actor: ProductionActor, key: string, id: string, results: {
            supplyId: string;
            good: number;
            failed: number;
        }[]) {
            permit(actor, ['PRINT_OPERATOR', 'WORKSHOP_OPERATOR']);
            return mutate(actor, key, 'QC_RECORD', { id, results }, async (w) => {
                const s = await w.snapshot();
                const job = s.jobs.find(j => j.id === id);
                if (!job)
                    throw new AppError('Không tìm thấy mẻ in.', 404);
                if (job.status !== 'QC_PENDING' || results.length !== job.supplies.length || new Set(results.map(r => r.supplyId)).size !== results.length || results.some(r => !Number.isInteger(r.good) || !Number.isInteger(r.failed) || r.good < 0 || r.failed < 0 || !job.supplies.some(a => a.id === r.supplyId && r.good + r.failed === a.quantity)))
                    throw new AppError('Phải ghi đủ số lượng đạt/lỗi cho từng phần phân bổ, không vượt số lượng.', 409);
                await w.inspect(job, results, actor.id);
                await w.audit('QC_RECORDED', id, actor.id, results);
                await w.event('QualityChanged', id);
                return { id };
            });
        },
        pack(actor: ProductionActor, key: string, itemId: string, ready: boolean) {
            permit(actor, ['PRINT_OPERATOR', 'WORKSHOP_OPERATOR']);
            return mutate(actor, key, ready ? 'PACKING_COMPLETED' : 'PACKING_TRANSFER', { itemId }, async (w) => {
                const s = await w.snapshot();
                const item = s.items.find(i => i.id === itemId);
                if (!item)
                    throw new AppError('Không tìm thấy dòng sản xuất.', 404);
                if (ready ? !item.packedAt : !!item.packedAt)
                    throw new AppError('Dòng sản xuất không ở bước bàn giao phù hợp.', 409);
                if (hasEarlierUnfinishedOrder(s, item))
                    throw new AppError('Đang chờ hoàn tất đơn đặt trước rồi mới đóng gói đơn này.', 409);
                if (!canPack(s, item) || s.jobs.some(j => j.supplies.some(a => a.itemId === itemId) && !['COMPLETED', 'FAILED', 'CANCELLED'].includes(j.status)))
                    throw new AppError('Chưa đủ linh kiện đạt kiểm tra chất lượng, phụ kiện hoặc còn công việc đang mở.', 409);
                await w.pack(itemId, ready, actor.id);
                await w.audit(ready ? 'PACKING_COMPLETED' : 'PACKING_TRANSFERRED', item.id, actor.id, {});
                await w.event('PackingChanged', item.id);
                return { itemId };
            });
        },
    };
}

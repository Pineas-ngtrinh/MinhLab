import { createHash } from 'node:crypto';
import { withTransaction } from '../lib/db';
import { createProductionService } from '../services/production/production.service';
import { PostgresProductionWriter, lockProduction } from '../repositories/production/production.repository';
import { productionRecord, productionNumber, productionIds, parseRevision, parseTechnicalCheck, parsePrinter, productionDate } from '../lib/production-validation';
import { textField } from '../lib/request-validation';
import { uuidField } from '../lib/catalog-validation';
import type { ProductionActor } from '../services/production/production.ports';
import { AppError } from '../lib/errors';
import { CustomProduction } from './custom-production';
import { productionAgentConfig } from '../integrations/production/openai-agent';
import { productionTelegramNotifications } from '../integrations/notifications/production-telegram';
export const ProductionService = createProductionService({
    transaction: operation => withTransaction(async (client) => {
        await lockProduction(client);
        return operation(new PostgresProductionWriter(client), productionTelegramNotifications(client));
    }),
    hash: value => createHash('sha256').update(JSON.stringify(value)).digest('hex'), now: () => new Date().toISOString(),
});
export async function productionWorkspace(actor: {
    id: string;
    role: string;
}) {
    return { ...await ProductionService.workspace(), serverTime: new Date().toISOString(), custom: await CustomProduction.view(actor), agent: { status: productionAgentConfig() ? 'CONFIGURED' as const : 'WAITING_CONFIGURATION' as const, message: productionAgentConfig() ? 'AI hỗ trợ đề xuất bản nháp từ metadata sản xuất đã được cấp quyền. Core kiểm tra điều kiện; người có quyền vẫn duyệt trước khi phân công.' : 'Bộ tối ưu nội bộ dùng dữ liệu xưởng đã xác nhận; không gửi dữ liệu ra ngoài. Người có quyền vẫn duyệt kế hoạch trước khi phân công.' } };
}
/** Single HTTP boundary parses every command; core still checks each capability. */
export async function executeProduction(value: unknown, actor: ProductionActor, keyValue: string | null) {
    const key = textField(keyValue, 'Idempotency-Key', 120);
    if (!/^[A-Za-z0-9_-]{16,120}$/.test(key))
        throw new AppError('Idempotency-Key cần 16–120 ký tự chữ/số/gạch ngang.');
    const v = productionRecord(value);
    const id = () => uuidField(v.id);
    const rev = () => productionNumber(v.revision, 'Revision', 1);
    switch (v.action) {
        case 'SAVE_REVISION': return ProductionService.saveRevision(actor, key, parseRevision(v.input));
        case 'VERIFY':
        case 'PUBLISH':
        case 'REVOKE': return ProductionService.revisionAction(actor, key, id(), v.action);
        case 'SAVE_PRINTER': return ProductionService.savePrinter(actor, key, parsePrinter(v.input), v.id ? uuidField(v.id) : undefined);
        case 'INVENTORY': return ProductionService.inventory(actor, key, textField(v.stockKey, 'Khóa tồn', 160), productionNumber(v.quantity, 'Lượng chưa phân bổ đạt QC', 0, 1000000, false), productionNumber(v.revision, 'Revision tồn', 0));
        case 'SAVE_CHECK': return ProductionService.saveCheck(actor, key, parseTechnicalCheck(v.input));
        case 'REVOKE_CHECK': return ProductionService.revokeCheck(actor, key, id());
        case 'PREPARE': return ProductionService.prepare(actor, key, productionIds(v.itemIds));
        case 'PROPOSE': return ProductionService.propose(actor, key, productionIds(v.itemIds), Array.isArray(v.checkIds) && v.checkIds.length === 0 ? [] : productionIds(v.checkIds, false), productionDate(v.startAt), v.id ? { id: id(), revision: rev() } : undefined);
        case 'APPROVE':
        case 'REJECT': return ProductionService.decide(actor, key, id(), rev(), v.action, textField(v.note, 'Lý do/quyết định', 1000));
        case 'DELETE_PLAN': return ProductionService.deletePlan(actor, key, id(), rev());
        case 'START':
        case 'FINISH':
        case 'QC_READY':
        case 'FAIL': {
            if (v.machineFailure !== undefined && typeof v.machineFailure !== 'boolean')
                throw new AppError('Tình trạng lỗi máy không hợp lệ.');
            return ProductionService.jobAction(actor, key, id(), v.action, v.machineFailure === true);
        }
        case 'QC': {
            if (!Array.isArray(v.results) || v.results.length > 100)
                throw new AppError('Kết quả QC không hợp lệ.');
            return ProductionService.inspect(actor, key, id(), v.results.map(x => { const r = productionRecord(x); return { supplyId: uuidField(r.supplyId), good: productionNumber(r.good, 'Số đạt'), failed: productionNumber(r.failed, 'Số hỏng') }; }));
        }
        case 'PACK':
        case 'READY': return ProductionService.pack(actor, key, id(), v.action === 'READY');
        default: throw new AppError('Thao tác sản xuất không được hỗ trợ.');
    }
}

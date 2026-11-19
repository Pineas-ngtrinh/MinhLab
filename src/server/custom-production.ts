import { createHash } from 'node:crypto';
import { withTransaction } from '../lib/db';
import { lockProduction } from '../repositories/production/production.repository';
import { PostgresCustomProductionWriter } from '../repositories/production/custom-production.repository';
import { createCustomProduction } from '../services/production/custom-production.service';
import { productionRecord, productionNumber, productionDate, metadataCode } from '../lib/production-validation';
import { textField } from '../lib/request-validation';
import { uuidField } from '../lib/catalog-validation';
import { AppError } from '../lib/errors';
export const CustomProduction = createCustomProduction({ transaction: run => withTransaction(async (c) => { await lockProduction(c); return run(new PostgresCustomProductionWriter(c)); }), hash: v => createHash('sha256').update(JSON.stringify(v)).digest('hex'), now: () => new Date().toISOString() });
export async function executeCustomProduction(raw: unknown, actor: {
    id: string;
    role: string;
}, keyValue: string | null) {
    const v = productionRecord(raw), key = textField(keyValue, 'Idempotency-Key', 120);
    if (!/^[A-Za-z0-9_-]{16,120}$/.test(key))
        throw new AppError('Khóa thao tác không hợp lệ.');
    const id = () => uuidField(v.id);
    switch (v.action) {
        case 'CUSTOM_APPROVE': {
            const b = productionRecord(v.input);
            return CustomProduction.approve(actor, key, { itemId: uuidField(b.itemId), profileId: uuidField(b.profileId), quantity: productionNumber(b.quantity, 'Số lượng mẻ', 1, 100), durationMinutes: productionNumber(b.durationMinutes, 'Thời lượng cả mẻ', 1, 43200), materialQuantity: productionNumber(b.materialQuantity, 'Vật liệu cả mẻ', 0.001, 1000000, false), startAt: productionDate(b.startAt), evidenceCode: metadataCode(b.evidenceCode), confirmed: b.confirmed === true });
        }
        case 'CUSTOM_START':
        case 'CUSTOM_FINISH':
        case 'CUSTOM_QC_READY':
        case 'CUSTOM_FAIL': return CustomProduction.step(actor, key, id(), v.action.slice(7) as 'START' | 'FINISH' | 'QC_READY' | 'FAIL');
        case 'CUSTOM_QC': return CustomProduction.qc(actor, key, id(), productionNumber(v.good, 'Số đạt'), productionNumber(v.failed, 'Số hỏng'));
        case 'CUSTOM_PACK':
        case 'CUSTOM_READY': return CustomProduction.pack(actor, key, id(), v.action === 'CUSTOM_READY');
        default: throw new AppError('Thao tác mẻ custom không hợp lệ.');
    }
}

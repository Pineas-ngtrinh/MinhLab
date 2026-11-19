import type { RevisionInput, TechnicalCheckInput, Printer } from '../contracts/production';
import { AppError } from './errors';
import { isRecord, textField } from './request-validation';
import { uuidField } from './catalog-validation';
export function productionRecord(value: unknown): Record<string, unknown> {
    if (!isRecord(value))
        throw new AppError('Dữ liệu sản xuất phải là một object.');
    return value;
}
export function productionNumber(value: unknown, label: string, min = 0, max = 1000000, integer = true, decimals = integer ? 0 : 3): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))
        throw new AppError(`${label} không hợp lệ.`);
    if (Math.abs(value * 10 ** decimals - Math.round(value * 10 ** decimals)) > 0.000001)
        throw new AppError(`${label} chỉ nhận tối đa ${decimals} chữ số thập phân.`);
    return value;
}
export function metadataCode(value: unknown, label = 'Mã'): string {
    const code = textField(value, label, 40);
    if (!/^[A-Za-z0-9_-]+$/.test(code))
        throw new AppError(`${label} chỉ dùng chữ không dấu, số, gạch ngang/gạch dưới; không nhập tên file hay đường dẫn.`);
    return code;
}
export function productionIds(value: unknown, unique = true): string[] {
    if (!Array.isArray(value) || value.length < 1 || value.length > 100)
        throw new AppError('Cần chọn từ 1 đến 100 mục.');
    const ids = value.map(v => uuidField(v));
    if (unique && new Set(ids).size !== ids.length)
        throw new AppError('Không được chọn trùng mục.');
    return ids;
}
function choice<T extends string>(value: unknown, options: readonly T[], label: string): T {
    if (typeof value !== 'string' || !options.includes(value as T))
        throw new AppError(`${label} không hợp lệ.`);
    return value as T;
}
function parseGroupingRules(value: unknown) {
    if (!Array.isArray(value) || value.length > 50) throw new AppError('Mỗi cấu hình nhận tối đa 50 quy tắc.');
    const ids = new Set<string>();
    return value.map(entry => {
        const r = productionRecord(entry), id = metadataCode(r.id,'Mã quy tắc');
        if (ids.has(id)) throw new AppError('Mã quy tắc bị trùng.');
        ids.add(id);
        return { id, priority: productionNumber(r.priority,'Ưu tiên',0,1000),
            effect: choice(r.effect,['ALLOW','DENY'] as const,'Quyết định'),
            field: choice(r.field,['geometryCode','finishedColor','material','color','appearance'] as const,'Thuộc tính'),
            value: textField(r.value,'Giá trị điều kiện',80) };
    });
}
function dimensions(value: unknown) {
    const v = productionRecord(value);
    return { width: productionNumber(v.width,'Chiều rộng',0.001,100000,false),
        depth: productionNumber(v.depth,'Chiều sâu',0.001,100000,false), height: productionNumber(v.height,'Chiều cao',0.001,100000,false) };
}
export function parseRevision(value: unknown): RevisionInput {
    const v = productionRecord(value);
    const b = productionRecord(v.body);
    const code = metadataCode(v.code);
    if (v.kind === 'BOM') {
        if (!Array.isArray(b.lines) || b.lines.length > 100)
            throw new AppError('BOM tối đa 100 dòng.');
        return { kind: 'BOM', code, variantId: uuidField(v.variantId), body: { lines: b.lines.map(x => { const l = productionRecord(x); return { componentRevisionId: uuidField(l.componentRevisionId), quantity: productionNumber(l.quantity, 'Số lượng', 1, 10000) }; }) } };
    }
    if (v.kind === 'COMPONENT') {
        const routing = choice(b.routing, ['PRINTED', 'STOCKED', 'PURCHASED', 'FINISHING'], 'Routing');
        if (typeof b.mirrorRequired !== 'boolean')
            throw new AppError('Cần xác nhận yêu cầu mirror.');
        return { kind: 'COMPONENT', code, body: { ...(b.envelope !== undefined ? { envelope: dimensions(b.envelope) } : {}), ...(b.geometryCode ? { geometryCode: metadataCode(b.geometryCode) } : {}), ...(b.finishedColor ? { finishedColor: textField(b.finishedColor, 'Màu hoàn thiện', 80) } : {}), name: textField(b.name, 'Tên linh kiện', 120), unit: textField(b.unit, 'Đơn vị/nhóm', 40, false), routing,
                objectsPerUnit: b.objectsPerUnit === null || b.objectsPerUnit === undefined ? null : productionNumber(b.objectsPerUnit, 'Số object trên đơn vị', 1, 10000), mirrorRequired: b.mirrorRequired,
                technology: routing === 'PRINTED' ? choice(b.technology ?? '', ['FDM', 'SLA', ''], 'Công nghệ') : '',
                material: routing === 'PRINTED' && b.material ? metadataCode(b.material, 'Vật liệu') : '', color: routing === 'PRINTED' && b.color ? metadataCode(b.color, 'Màu lúc in') : '', appearance: routing === 'PRINTED' && b.appearance ? metadataCode(b.appearance, 'Đục/clear') : '' } };
    }
    if (v.kind === 'PROFILE')
        return { kind: 'PROFILE', code, printerId: uuidField(v.printerId), body: { ...(b.groupingRules !== undefined ? { groupingRules: parseGroupingRules(b.groupingRules) } : {}), ...(b.plate !== undefined ? { plate: { ...dimensions(b.plate), margin: productionNumber(productionRecord(b.plate).margin,'Lề bàn',0,10000,false), spacing: productionNumber(productionRecord(b.plate).spacing,'Khoảng hở',0,10000,false) } } : {}), name: textField(b.name, 'Tên profile', 120), technology: choice(b.technology ?? '', ['FDM', 'SLA', ''], 'Công nghệ'), material: b.material ? metadataCode(b.material, 'Vật liệu') : '', color: b.color ? metadataCode(b.color, 'Màu lúc in') : '', appearance: b.appearance ? metadataCode(b.appearance, 'Đục/clear') : '', processCode: b.processCode ? metadataCode(b.processCode, 'Mã quy trình đã kiểm định') : '' } };
    throw new AppError('Loại revision không hợp lệ.');
}
export function parseTechnicalCheck(value: unknown): TechnicalCheckInput {
    const v = productionRecord(value);
    if (!Array.isArray(v.members) || !v.members.length || v.members.length > 100)
        throw new AppError('Cần 1–100 loại linh kiện trong mẻ.');
    if (v.resourcesConfirmed !== true)
        throw new AppError('Cần xác nhận layout/mirror/support, vật tư, nhân sự và công đoạn đến đóng gói tại xưởng.');
    return { code: metadataCode(v.code), profileRevisionId: uuidField(v.profileRevisionId), members: v.members.map(x => { const m = productionRecord(x); return { componentRevisionId: uuidField(m.componentRevisionId), quantity: productionNumber(m.quantity, 'Số lượng trong mẻ', 1, 10000) }; }),
        durationMinutes: productionNumber(v.durationMinutes, 'Thời gian cả mẻ', 1, 43200), preparationMinutes: productionNumber(v.preparationMinutes, 'Chuẩn bị', 0, 43200), finishingMinutes: productionNumber(v.finishingMinutes, 'Hậu xử lý đến đóng gói', 0, 43200),
        materialQuantity: productionNumber(v.materialQuantity, 'Vật liệu cả mẻ (g/ml)', 0.001, 1000000, false), evidenceCode: metadataCode(v.evidenceCode, 'Mã xác nhận kỹ thuật'), resourcesConfirmed: true };
}
export function parsePrinter(value: unknown): Omit<Printer, 'id'> {
    const v = productionRecord(value);
    return { code: metadataCode(v.code), name: textField(v.name, 'Tên máy', 120), technology: choice(v.technology, ['FDM', 'SLA'], 'Công nghệ'), status: choice(v.status, ['AVAILABLE', 'MAINTENANCE', 'OFFLINE', 'RETIRED'], 'Tình trạng máy') };
}
export function productionDate(value: unknown): string {
    const raw = textField(value, 'Thời điểm bắt đầu dự kiến', 40);
    const time = Date.parse(raw);
    if (!Number.isFinite(time) || !/(Z|[+-]\d{2}:\d{2})$/.test(raw))
        throw new AppError('Thời điểm phải chứa múi giờ hợp lệ.');
    return new Date(time).toISOString();
}

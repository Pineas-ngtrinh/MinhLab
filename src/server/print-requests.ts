import { createHash } from 'node:crypto';
import { withTransaction } from '../lib/db';
import { createPrintRequestService } from '../services/print-requests/print-request.service';
import { PostgresRequestWriter, readRequestMaterials, readFileReviewers, lockPrintRequests } from '../repositories/print-requests/print-request.repository';
import { PostgresOrderWriteRepository } from '../repositories/orders/order-write.repository';
import { orderNotifications } from '../integrations/notifications/order-notifications';
import { createAcceptedCustomOrder } from '../services/orders';
import { manualVietQrDestination } from './payment-config';
import { productionRecord, productionNumber, productionDate, metadataCode } from '../lib/production-validation';
import { textField } from '../lib/request-validation';
import { uuidField } from '../lib/catalog-validation';
import type { RequestActor } from '../services/print-requests/print-request.ports';
import type { PrintSubmission, PrintQuoteInput } from '../contracts/print-requests';
import { AppError } from '../lib/errors';
import { privateFileConfig } from '../integrations/private-files/local-store';
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const PrintRequestService = createPrintRequestService({ hash, now: () => new Date().toISOString(), transaction: operation => withTransaction(async (c) => {
        await lockPrintRequests(c);
        return operation(new PostgresRequestWriter(c, input => createAcceptedCustomOrder({ orders: new PostgresOrderWriteRepository(c), notifications: orderNotifications(c) }, input, manualVietQrDestination())));
    }) });
export async function printWorkspace(actor: RequestActor, options: import('../contracts/pagination').PageOptions = { page: 1, pageSize: 25 }, mine = false) {
    const page = await PrintRequestService.list(actor, options, mine);
    const materials = actor.role === 'FILE_REVIEWER' ? await readRequestMaterials() : [];
    return { requests: page.data.map(r => actor.role === 'ADMIN' ? r : { ...r, fileHolds: undefined }), pagination: page.pagination, materials, reviewers: actor.role === 'ADMIN' ? await readFileReviewers() : [], privateFilesConfigured: !!privateFileConfig() };
}
function submission(raw: unknown): PrintSubmission {
    const v = productionRecord(raw);
    const c = productionRecord(v.contact);
    if (typeof v.rightsAccepted !== 'boolean')
        throw new AppError('Cần ghi nhận quyền sử dụng file.');
    const phone = textField(c.phone, 'Điện thoại', 20);
    if (!/^\+?[0-9 ()-]{8,20}$/.test(phone))
        throw new AppError('Điện thoại không hợp lệ.');
    return { fileId: v.fileId ? uuidField(v.fileId) : null, quantity: productionNumber(v.quantity, 'Số lượng', 1, 100), material: textField(v.material, 'Vật liệu mong muốn', 120), color: textField(v.color, 'Màu mong muốn', 60), purpose: textField(v.purpose, 'Mục đích / độ bền / hoàn thiện', 1000), note: textField(v.note, 'Ghi chú', 2000, false), rightsAccepted: v.rightsAccepted, contact: { name: textField(c.name, 'Tên người nhận', 120), phone, address: textField(c.address, 'Địa chỉ để chốt phí giao', 255) } };
}
export async function executePrintRequest(raw: unknown, actor: RequestActor, keyValue: string | null) {
    const v = productionRecord(raw);
    const key = textField(keyValue, 'Idempotency-Key', 120);
    if (!/^[A-Za-z0-9_-]{16,120}$/.test(key))
        throw new AppError('Khóa thao tác không hợp lệ.');
    const opKey = hash({ actor: actor.id, key });
    const id = () => uuidField(v.id), revision = () => productionNumber(v.revision, 'Revision', 1);
    switch (v.action) {
        case 'SUBMIT': return PrintRequestService.submit(actor, opKey, submission(v.input), v.id ? { id: id(), revision: revision() } : undefined);
        case 'FILE_MANUAL_ANALYSIS': {
            const b = productionRecord(v.input);
            return PrintRequestService.confirmManualAnalysis(actor, opKey, id(), revision(), { w: productionNumber(b.w, 'Kích thước X', 0.001, 9999999, false, 3), d: productionNumber(b.d, 'Kích thước Y', 0.001, 9999999, false, 3), h: productionNumber(b.h, 'Kích thước Z', 0.001, 9999999, false, 3) }, metadataCode(b.evidenceCode, 'Mã kiểm file tại xưởng'));
        }
        case 'ASSIGN': return PrintRequestService.assign(actor, opKey, id(), revision(), uuidField(v.reviewerId), textField(v.note, 'Lý do phân công', 2000));
        case 'DECLINE': return PrintRequestService.decline(actor, opKey, id(), uuidField(v.quoteId), revision(), textField(v.note, 'Nội dung điều chỉnh / từ chối', 2000));
        case 'CLOSE':
        case 'REOPEN':
        case 'HOLD':
        case 'RELEASE_HOLD': return PrintRequestService.lifecycle(actor, opKey, id(), revision(), v.action,
            textField(v.note, 'Lý do / kết quả xử lý', 2000), v.action === 'HOLD' ? productionDate(v.reviewAt) : undefined,
            v.action === 'RELEASE_HOLD' ? uuidField(v.holdId) : undefined);
        case 'CLAIM': return PrintRequestService.claim(actor, opKey, id(), revision());
        case 'NEEDS_REVISION':
        case 'REJECTED': return PrintRequestService.decision(actor, opKey, id(), revision(), v.action, textField(v.note, 'Lý do và hướng dẫn', 2000));
        case 'ISSUE': {
            const b = productionRecord(v.input);
            if (b.checksConfirmed !== true)
                throw new AppError('Cần xác nhận đủ checklist kỹ thuật và giá cuối.');
            const input: PrintQuoteInput = { requestId: id(), revision: revision(), materialId: uuidField(b.materialId), color: textField(b.color, 'Màu chốt', 60), length: productionNumber(b.length, 'Kích thước X', 0.01, 9999999, false, 2), width: productionNumber(b.width, 'Kích thước Y', 0.01, 9999999, false, 2), height: productionNumber(b.height, 'Kích thước Z', 0.01, 9999999, false, 2), scale: productionNumber(b.scale, 'Tỉ lệ %', 0.01, 9999, false, 2), unitPrice: productionNumber(b.unitPrice, 'Giá mỗi bản', 1, 999999999), shipping: productionNumber(b.shipping, 'Phí giao hàng', 0, 999999999), validUntil: productionDate(b.validUntil), promisedFinishAt: productionDate(b.promisedFinishAt), terms: textField(b.terms, 'Điều khoản / thay đổi so với yêu cầu', 6000), evidenceCode: metadataCode(b.evidenceCode, 'Mã xác nhận kỹ thuật'), checksConfirmed: true };
            return PrintRequestService.issue(actor, opKey, input);
        }
        case 'ACCEPT': return PrintRequestService.accept(actor, opKey, id(), revision(), uuidField(v.quoteId), textField(v.termsHash, 'Hash điều khoản', 64));
        default: throw new AppError('Thao tác yêu cầu in không hợp lệ.');
    }
}

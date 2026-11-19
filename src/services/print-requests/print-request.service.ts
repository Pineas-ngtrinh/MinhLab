import type { RequestDependencies, RequestActor, RequestState } from './print-request.ports';
import type { PrintSubmission, PrintQuoteInput } from '../../contracts/print-requests';
import { customQuoteProblems } from '../../domain/print-requests/quote-policy';
import { AppError } from '../../lib/errors';
const role = (a: RequestActor, roles: RequestActor['role'][]) => {
    if (!roles.includes(a.role))
        throw new AppError('Không có quyền thao tác yêu cầu in.', 403);
};
const own = (a: RequestActor, r: RequestState) => {
    if (a.role === 'CUSTOMER' && a.id !== r.ownerId)
        throw new AppError('Không tìm thấy yêu cầu in.', 404);
};
export function createPrintRequestService(d: RequestDependencies) {
    // Lần gửi lại cùng nội dung nhận kết quả cũ. Đổi tài khoản hoặc sửa nội dung thì phải dùng khóa mới.
    const operation = (a: RequestActor, key: string, input: unknown, run: (w: Parameters<Parameters<RequestDependencies['transaction']>[0]>[0]) => Promise<unknown>) => d.transaction(async (w) => {
        const hash = d.hash(input);
        const replay = await w.replay(key);
        if (replay) {
            if (replay.actorId !== a.id || replay.hash !== hash)
                throw new AppError('Khóa thao tác đã được dùng với nội dung khác.', 409);
            return replay.result;
        }
        const result = await run(w);
        await w.remember(key, a.id, hash, result);
        return result;
    });
    return {
        list: (a: RequestActor, options: import('../../contracts/pagination').PageOptions, mine = false) => d.transaction(async (w) => {
            const page = await w.list(a.role === 'CUSTOMER' ? a.id : undefined, options, mine && a.role === 'FILE_REVIEWER' ? a.id : undefined);
            return { ...page, data: page.data.map(r => a.role === 'FILE_REVIEWER' && r.assignedReviewerId !== a.id ? { ...r, file: r.file ? { ...r.file, originalFilename: undefined } : null, contact: { name: '', phone: '', address: '' }, note: '', requested: { ...r.requested, purpose: '' }, quotes: [] } : r) };
        }),
        submit(a: RequestActor, key: string, input: PrintSubmission, existing?: {
            id: string;
            revision: number;
        }) {
            role(a, ['CUSTOMER']);
            return operation(a, key, { action: 'SUBMIT', input, existing }, async (w) => {
                const old = existing ? await w.request(existing.id) : null;
                if (existing && !old)
                    throw new AppError('Không tìm thấy yêu cầu in.', 404);
                if (old) {
                    own(a, old);
                    if (old.view.revision !== existing!.revision || ['CLOSED', 'REJECTED'].includes(old.view.status))
                        throw new AppError('Yêu cầu đã đổi hoặc đã chuyển đơn; cần yêu cầu/báo giá mới.', 409);
                }
                if (input.fileId && !await w.fileOwner(input.fileId, a.id))
                    throw new AppError('File không thuộc tài khoản hoặc không còn dùng được.', 404);
                const id = await w.submit(input, a.id, old ?? undefined);
                await w.audit(old ? 'REQUEST_REVISED' : 'REQUEST_SUBMITTED', id, a.id, {});
                return { id };
            });
        },
        // Sau khi chuyển đơn, việc giữ tệp cần tính cả trạng thái của đơn đó.
        lifecycle(a: RequestActor, key: string, id: string, revision: number, action: 'CLOSE' | 'REOPEN' | 'HOLD' | 'RELEASE_HOLD', note: string, reviewAt?: string, holdId?: string) {
            role(a, action === 'HOLD' || action === 'RELEASE_HOLD' ? ['ADMIN'] : ['CUSTOMER', 'ADMIN']);
            return operation(a, key, { action, id, revision, note, reviewAt, holdId }, async w => {
                const r = await w.request(id);
                if (!r) throw new AppError('Không tìm thấy yêu cầu in.', 404);
                own(a, r);
                if (r.view.revision !== revision) throw new AppError('Phiếu đã thay đổi, vui lòng tải lại.', 409);
                const converted = r.view.closedReason === 'CONVERTED' || r.view.quotes.some(q => q.orderNumber);
                if ((action === 'CLOSE' || action === 'REOPEN') && converted) throw new AppError('Phiếu đã chuyển đơn; xử lý qua đơn hàng.', 409);
                if (action === 'CLOSE' && ['CLOSED', 'REJECTED'].includes(r.view.status)) throw new AppError('Phiếu đã kết thúc.', 409);
                if (action === 'REOPEN' && !['CLOSED', 'REJECTED'].includes(r.view.status)) throw new AppError('Phiếu vẫn đang hoạt động.', 409);
                if ((action === 'REOPEN' || action === 'HOLD') && !await w.canReuseFiles(id)) throw new AppError('File đã hết thời hạn lưu hoặc đang được xóa. Cần gửi file và yêu cầu mới.', 409);
                if (action === 'HOLD' && (!reviewAt || Date.parse(reviewAt) <= Date.parse(d.now()))) throw new AppError('Ngày rà soát giữ file phải ở tương lai.');
                await w.lifecycle(id, action, a.id, note, reviewAt, holdId);
                await w.audit(`REQUEST_${action}`, id, a.id, { note, reviewAt, holdId });
                return { id };
            });
        },
        claim(a: RequestActor, key: string, id: string, revision: number) {
            role(a, ['FILE_REVIEWER']);
            return operation(a, key, { action: 'CLAIM', id, revision }, async (w) => {
                const r = await w.request(id);
                if (!r)
                    throw new AppError('Không tìm thấy yêu cầu.', 404);
                if (r.view.revision !== revision || ['CLOSED', 'REJECTED'].includes(r.view.status))
                    throw new AppError('Phiếu đã đổi trạng thái/revision.', 409);
                if (r.view.assignedReviewerId && r.view.assignedReviewerId !== a.id)
                    throw new AppError('Phiếu đã có người phụ trách.', 409);
                await w.claim(id, a.id);
                await w.audit('REQUEST_CLAIMED', id, a.id, {});
                return { id };
            });
        },
        assign(a: RequestActor, key: string, id: string, revision: number, reviewerId: string, note: string) {
            role(a, ['ADMIN']);
            return operation(a, key, { action: 'ASSIGN', id, revision, reviewerId, note }, async (w) => {
                const r = await w.request(id);
                if (!r)
                    throw new AppError('Không tìm thấy phiếu.', 404);
                if (r.view.revision !== revision || ['CLOSED', 'REJECTED'].includes(r.view.status) || !await w.reviewerExists(reviewerId))
                    throw new AppError('Phiếu đã đổi hoặc người nhận không có vai trò kỹ thuật đang hoạt động.', 409);
                await w.assign(id, reviewerId);
                await w.audit('REQUEST_REASSIGNED', id, a.id, { from: r.view.assignedReviewerId, to: reviewerId, note });
                return { id };
            });
        },
        decline(a: RequestActor, key: string, id: string, quoteId: string, revision: number, note: string) {
            role(a, ['CUSTOMER']);
            return operation(a, key, { action: 'DECLINE', id, quoteId, revision, note }, async (w) => {
                const r = await w.request(id);
                if (!r)
                    throw new AppError('Không tìm thấy phiếu.', 404);
                own(a, r);
                if (r.view.revision !== revision || !r.view.quotes.some(q => q.id === quoteId && q.status === 'SENT'))
                    throw new AppError('Báo giá không còn ở trạng thái chờ quyết định.', 409);
                await w.decline(id, quoteId, note);
                await w.audit('QUOTE_DECLINED', quoteId, a.id, { note });
                return { id };
            });
        },
        decision(a: RequestActor, key: string, id: string, revision: number, status: 'NEEDS_REVISION' | 'REJECTED', note: string) {
            role(a, ['FILE_REVIEWER']);
            return operation(a, key, { action: 'DECISION', id, revision, status, note }, async (w) => {
                const r = await w.request(id);
                if (!r)
                    throw new AppError('Không tìm thấy yêu cầu.', 404);
                if (r.view.assignedReviewerId !== a.id || r.view.revision !== revision || ['CLOSED', 'REJECTED'].includes(r.view.status))
                    throw new AppError('Không đúng người phụ trách/revision hoặc phiếu đã chuyển đơn.', 409);
                await w.decision(r, status, note, a.id);
                await w.audit('REQUEST_REVIEW_DECISION', id, a.id, { status, note });
                return { id };
            });
        },
        confirmManualAnalysis(a: RequestActor, key: string, id: string, revision: number, bbox: {
            w: number;
            d: number;
            h: number;
        }, evidenceCode: string) {
            role(a, ['FILE_REVIEWER']);
            return operation(a, key, { action: 'FILE_MANUAL_ANALYSIS', id, revision, bbox, evidenceCode }, async (w) => {
                const r = await w.request(id);
                if (!r)
                    throw new AppError('Không tìm thấy phiếu.', 404);
                if (r.view.revision !== revision || r.view.assignedReviewerId !== a.id || !r.view.file || ['CLOSED', 'REJECTED'].includes(r.view.status) || r.view.file.availability === 'PURGED')
                    throw new AppError('Không đúng người phụ trách hoặc revision.', 409);
                if (!await w.confirmManualAnalysis(r, a.id, bbox, evidenceCode))
                    throw new AppError('File chưa qua kiểm an toàn hoặc không ở bước kiểm thủ công.', 409);
                await w.audit('FILE_MANUALLY_INSPECTED', id, a.id, { bbox, evidenceCode });
                return { id };
            });
        },
        issue(a: RequestActor, key: string, input: PrintQuoteInput) {
            role(a, ['FILE_REVIEWER']);
            return operation(a, key, { action: 'ISSUE', input }, async (w) => {
                const r = await w.request(input.requestId);
                if (!r)
                    throw new AppError('Không tìm thấy yêu cầu.', 404);
                if (r.view.assignedReviewerId !== a.id || r.view.revision !== input.revision || ['CLOSED', 'REJECTED'].includes(r.view.status))
                    throw new AppError('Không đúng người phụ trách/revision hoặc đã chuyển đơn.', 409);
                if (!r.view.rightsAccepted || !r.view.file || r.view.file.availability === 'PURGED' || r.view.file.scanStatus !== 'CLEAN' || r.view.file.analysisStatus !== 'COMPLETE')
                    throw new AppError('File chưa hoàn tất kiểm an toàn/phân tích hoặc chưa có xác nhận quyền sử dụng.', 409);
                const problems = customQuoteProblems({ ...input, quantity: r.view.quantity }, d.now());
                if (problems.length)
                    throw new AppError(problems.join(' '), 409);
                if (!await w.material(input.materialId))
                    throw new AppError('Vật liệu không hoạt động.');
                const termsHash = d.hash({ input, quantity: r.view.quantity, fileHash: r.fileHash, contact: r.view.contact });
                const id = await w.issue(r, input, termsHash, a.id);
                await w.audit('QUOTE_ISSUED', id, a.id, { requestId: r.view.id, revision: input.revision, evidenceCode: input.evidenceCode });
                return { id };
            });
        },
        // Chấp thuận cả báo giá một lần để tệp, giá và điều khoản đi cùng đơn được tạo.
        accept(a: RequestActor, key: string, id: string, revision: number, quoteId: string, termsHash: string) {
            role(a, ['CUSTOMER']);
            return operation(a, key, { action: 'ACCEPT', id, revision, quoteId, termsHash }, async (w) => {
                const r = await w.request(id);
                if (!r)
                    throw new AppError('Không tìm thấy yêu cầu.', 404);
                own(a, r);
                const q = r.view.quotes.find(q => q.id === quoteId);
                if (!q || q.requestRevision !== revision || q.termsHash !== termsHash)
                    throw new AppError('Bản chốt/điều khoản không khớp.', 409);
                // Ownership and immutable acceptance first; an already-converted quote survives later expiry.
                const existing = await w.conversion(quoteId);
                if (existing)
                    return existing;
                if (r.view.revision !== revision || q.status !== 'SENT' || ['CLOSED', 'REJECTED'].includes(r.view.status) || r.view.file?.availability === 'PURGED' || Date.parse(q.validUntil) <= Date.parse(d.now()) || r.view.file?.scanStatus !== 'CLEAN' || r.view.file.analysisStatus !== 'COMPLETE')
                    throw new AppError('Báo giá đã đổi, hết hạn hoặc file không còn đủ điều kiện.', 409);
                return w.convert(r, q.id, a.id, { quantity: q.quantity, unitPrice: q.unitPrice, shipping: q.shipping, description: `In theo yêu cầu ${r.view.number}`, color: q.spec.color, material: q.spec.material });
            });
        },
    };
}

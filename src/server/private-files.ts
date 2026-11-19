import { createHash } from 'node:crypto';
import {
    privateFileConfig,
    readPrivateFile,
    removePrivateFile,
    scanPrivateFile,
    storePrivateStl,
} from '../integrations/private-files/local-store';
import { purgeJournalRoot, journalPurge } from '../integrations/private-files/purge-journal';
import { withTransaction } from '../lib/db';
import { AppError } from '../lib/errors';
import { analyzeStl, StlParseError } from '../lib/quote/stl/analyze';
import {
    cleanupCandidates,
    finishFilePurge,
    lockPrivateFileLifecycle,
} from '../repositories/print-requests/file-retention.repository';
import { privateFiles } from '../repositories/print-requests/private-file.repository';

export async function uploadPrivateFile(request: Request, ownerId: string) {
    const config = privateFileConfig();
    if (!config)
        throw new AppError('Đang chờ cấu hình kho private, giới hạn, thời gian lưu và công cụ kiểm an toàn file tại xưởng.', 503);
    const format = (request.headers.get('X-Model-Format') ?? 'STL').toLowerCase();
    let filename = `model.${format}`;
    try {
        filename = decodeURIComponent(request.headers.get('X-File-Name') ?? filename).normalize('NFC');
    } catch {
        throw new AppError('Tên file không hợp lệ.');
    }
    if (!filename.trim() || filename.length > 255 || /[/\\\u0000-\u001f\u007f]/.test(filename) || !filename.toLowerCase().endsWith(`.${format}`)) {
        throw new AppError('Tên file cần đúng định dạng, tối đa 255 ký tự và không chứa đường dẫn.');
    }
    return withTransaction(async (c) => {
        const used = await privateFiles.usage(c, ownerId);
        if (used + config.maxBytes > config.quotaBytes)
            throw new AppError('Không còn đủ quota nhận thêm file; liên hệ xưởng.', 409);
        const stored = await storePrivateStl(request, config);
        try {
            return { id: await privateFiles.save(c, ownerId, { ...stored, filename }) };
        }
        catch (error) {
            // Ghi metadata thất bại thì dọn tệp vừa lưu để tránh có tệp mồ côi.
            await removePrivateFile(config, stored.key).catch(() => {});
            throw error;
        }
    });
}

export async function downloadPrivateFile(id: string, userId: string, role: string) {
    return withTransaction(async client => {
        await lockPrivateFileLifecycle(client);
        const file = await privateFiles.authorized(client, id, userId, role);
        if (!file) throw new AppError('Không tìm thấy file hoặc không có quyền.', 404);
        if (file.upload_status === 'DELETED') throw new AppError('File đã hết thời hạn lưu. Vui lòng gửi lại nếu muốn đặt in tiếp.', 410);
        if (!['STORED', 'AVAILABLE'].includes(file.upload_status)) throw new AppError('File chưa đủ điều kiện tải.', 409);
        const config = privateFileConfig();
        if (!config) throw new AppError('Kho file private chưa được cấu hình.', 503);
        const extension = file.object_key.split('.').pop();
        if (!extension || !['stl', 'obj', 'step'].includes(extension)) throw new AppError('Định dạng file riêng tư không hợp lệ.', 409);
        if (Number(file.byte_size) > 100 * 1024 * 1024) throw new AppError('File vượt giới hạn tải.', 413);
        // Đọc xong tệp trong lúc còn giữ khóa để tác vụ dọn tệp không xen vào.
        try {
            const bytes = await readPrivateFile(config, file.object_key);
            return { body: new Uint8Array(bytes), bytes: String(bytes.byteLength), filename: `model.${extension}` };
        } catch (error) {
            if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') throw new AppError('File không còn trong kho; vui lòng gửi lại.', 410);
            throw error;
        }
    });
}

// Quét trước rồi mới kiểm nội dung. Mã băm giúp phát hiện tệp bị đổi sau khi tải.
export async function processPrivateFiles(limit = 5) {
    const config = privateFileConfig();
    if (!config)
        return { status: 'WAITING_CONFIGURATION', processed: 0 };
    let processed = 0;
    while (processed < limit) {
        const file = await privateFiles.claim();
        if (!file)
            break;
        try {
            const scan = await scanPrivateFile(config, file.object_key);
            if (scan === 'INFECTED') {
                await privateFiles.finish(file.id, file.token, scan, null, true);
                processed++;
                continue;
            }
            const bytes = await readPrivateFile(config, file.object_key);
            if (createHash('sha256').update(bytes).digest('hex') !== file.sha256) {
                await privateFiles.finish(file.id, file.token, 'FAILED', null, true);
                processed++;
                continue;
            }
            if (!file.object_key.endsWith('.stl')) {
                await privateFiles.finish(file.id, file.token, 'CLEAN', null);
                processed++;
                continue;
            }
            try {
                const a = analyzeStl(bytes, { topologyBudgetMs: 100, topologyMaxTriangles: 100000 });
                await privateFiles.finish(file.id, file.token, 'CLEAN', { bboxMm: a.bboxMm, triangleCount: a.triangleCount, flags: a.flags });
            }
            catch (error) {
                if (error instanceof StlParseError)
                    await privateFiles.finish(file.id, file.token, 'CLEAN', null, true);
                else
                    throw error;
            }
        }
        catch {
            await privateFiles.retry(file.id, file.token);
        }
        processed++;
    }
    return { status: 'DONE', processed };
}

// Mặc định chỉ xem danh sách. Khi xóa thật, ghi nhật ký bền vững trước khi đụng tới tệp.
export async function cleanupPrivateFiles(apply = false, retryFailed = false) {
    const config = privateFileConfig();
    if (!config) return { status: 'WAITING_CONFIGURATION', eligible: 0, removed: 0, failed: 0 };
    const journal = apply ? purgeJournalRoot() : null;
    const { rows, inspected, held, failedPurges, overdueHolds } = await cleanupCandidates(apply, retryFailed);
    let removed = 0, failed = 0;
    if (apply) for (const row of rows) {
        try {
            await journalPurge(journal!, row.id);
            try { await removePrivateFile(config, row.object_key); }
            catch (error) {
                if (!(typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT')) throw error;
            }
            await finishFilePurge(row.id, row.token!, true);
            removed++;
        } catch {
            failed++;
            await finishFilePurge(row.id, row.token!, false);
        }
    }
    return { status: apply ? 'APPLIED' : 'DRY_RUN', inspected, held, failedPurges, overdueHolds, eligible: rows.length,
        eligibleBytes: rows.reduce((sum, row) => sum + row.bytes, 0), removed, failed };
}

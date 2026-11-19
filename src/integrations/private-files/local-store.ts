import { mkdir, open, lstat, unlink, readFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { Readable } from 'node:stream';
import { randomUUID, createHash } from 'node:crypto';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { AppError } from '../../lib/errors';
export interface PrivateFileConfig {
    root: string;
    maxBytes: number;
    quotaBytes: number;
    retentionDays: number;
    scanner: string;
    formats: string[];
}
export function privateFileConfig(env: NodeJS.ProcessEnv = process.env): PrivateFileConfig | null {
    if (env.MINHLAB_PRIVATE_FILES_ENABLED !== 'true')
        return null;
    const formats = env.MINHLAB_PRIVATE_UPLOAD_FORMATS?.split(',').map(x => x.trim().toUpperCase());
    if (!formats?.length || formats.some(x => !['STL', 'OBJ', 'STEP'].includes(x)))
        return null;
    const root = env.MINHLAB_PRIVATE_FILES_ROOT;
    const scanner = env.MINHLAB_PRIVATE_FILES_SCANNER;
    const maxBytes = Number(env.MINHLAB_PRIVATE_UPLOAD_MAX_BYTES), quotaBytes = Number(env.MINHLAB_PRIVATE_UPLOAD_QUOTA_BYTES), retentionDays = Number(env.MINHLAB_PRIVATE_FILES_RETENTION_DAYS || 7);
    if (!root || !path.isAbsolute(root) || !scanner || !path.isAbsolute(scanner) || !Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > 100 * 1024 * 1024 || !Number.isSafeInteger(quotaBytes) || quotaBytes < maxBytes || !Number.isInteger(retentionDays) || retentionDays < 1)
        return null;
    const publicRoots = ['public', '.next', '.next-dev'].map(d => path.resolve(process.cwd(), d));
    const resolved = path.resolve(root);
    if (resolved === process.cwd() || publicRoots.some(p => resolved === p || resolved.startsWith(p + path.sep) || p.startsWith(resolved + path.sep)))
        return null;
    return { root: resolved, maxBytes, quotaBytes, retentionDays, scanner, formats };
}
function assetPath(config: PrivateFileConfig, key: string) {
    if (!/^[0-9a-f-]{36}\.(stl|obj|step|jpg|png|webp|3mf|gcode)$/i.test(key))
        throw new AppError('Định danh file không hợp lệ.', 404);
    return path.join(config.root, key);
}
export async function storePrivateStl(request: Request, config: PrivateFileConfig) {
    if (!request.body || !request.headers.get('content-type')?.startsWith('application/octet-stream'))
        throw new AppError('Gửi file STL bằng application/octet-stream.');
    await mkdir(config.root, { recursive: true, mode: 0o700 });
    if ((await lstat(config.root)).isSymbolicLink())
        throw new AppError('Kho private không được là symbolic link.', 503);
    const format = (request.headers.get('X-Model-Format') ?? 'STL').toUpperCase();
    if (!config.formats.includes(format))
        throw new AppError('Định dạng chưa được xưởng cho phép tiếp nhận.');
    const key = `${randomUUID()}.${format.toLowerCase()}`;
    const filename = assetPath(config, key);
    const file = await open(filename, 'wx', 0o600);
    const reader = request.body.getReader();
    const hash = createHash('sha256');
    let bytes = 0;
    try {
        while (true) {
            const chunk = await reader.read();
            if (chunk.done)
                break;
            bytes += chunk.value.length;
            if (bytes > config.maxBytes) {
                await reader.cancel();
                throw new AppError('File vượt giới hạn upload đã cấu hình.', 413);
            }
            hash.update(chunk.value);
            await file.writeFile(chunk.value);
        }
        if (bytes < 15)
            throw new AppError('File STL rỗng hoặc bị hỏng.');
        await file.sync();
        return { key, bytes, sha256: hash.digest('hex') };
    }
    catch (error) {
        await unlink(filename).catch(() => { });
        throw error;
    }
    finally {
        reader.releaseLock();
        await file.close();
    }
}
export async function storePrivateImage(bytes: Uint8Array, format: 'jpg' | 'png' | 'webp', config: PrivateFileConfig) {
    if (bytes.byteLength < 12 || bytes.byteLength > config.maxBytes)
        throw new AppError('Ảnh vượt giới hạn kho private đã cấu hình.', 413);
    await mkdir(config.root, { recursive: true, mode: 0o700 });
    if ((await lstat(config.root)).isSymbolicLink())
        throw new AppError('Kho private không được là symbolic link.', 503);
    const key = `${randomUUID()}.${format}`;
    const filename = assetPath(config, key);
    const file = await open(filename, 'wx', 0o600);
    try {
        await file.writeFile(bytes);
        await file.sync();
        return { key, bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') };
    }
    catch (error) {
        await unlink(filename).catch(() => { });
        throw error;
    }
    finally {
        await file.close();
    }
}
export const removePrivateFile = (config: PrivateFileConfig, key: string) => unlink(assetPath(config, key));
export const readPrivateFile = (config: PrivateFileConfig, key: string) => readFile(assetPath(config, key));
export function privateFileStream(config: PrivateFileConfig, key: string) { return Readable.toWeb(createReadStream(assetPath(config, key))) as ReadableStream<Uint8Array>; }
export function scanPrivateFile(config: PrivateFileConfig, key: string): Promise<'CLEAN' | 'INFECTED'> {
    return new Promise((resolve, reject) => execFile(config.scanner, ['--no-summary', `--max-filesize=${config.maxBytes}`, `--max-scansize=${config.maxBytes * 2}`, '--alert-exceeds-max=yes', '--', assetPath(config, key)], { timeout: 30000, maxBuffer: 65536 }, error => {
        if (!error)
            resolve('CLEAN');
        else if ('code' in error && error.code === 1)
            resolve('INFECTED');
        else
            reject(new AppError('Công cụ kiểm file chưa hoàn tất; cần kiểm tra cấu hình tại xưởng.', 503));
    }));
}

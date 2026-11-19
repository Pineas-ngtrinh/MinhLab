import { mkdir, open, lstat } from 'node:fs/promises';
import path from 'node:path';
import { AppError } from '../../lib/errors';

export function purgeJournalRoot(environment: NodeJS.ProcessEnv = process.env): string {
  const root = environment.MINHLAB_PRIVATE_PURGE_JOURNAL_ROOT;
  const privateRoot = environment.MINHLAB_PRIVATE_FILES_ROOT;
  if (!root || !path.isAbsolute(root)) throw new AppError('Cần cấu hình volume nhật ký xóa file trước khi bật cleanup apply.', 503);
  const resolved = path.resolve(root);
  const forbidden = ['public', '.next', '.next-dev'].map(p => path.resolve(p));
  if (privateRoot) forbidden.push(path.resolve(privateRoot));
  if (resolved === process.cwd() || forbidden.some(p => resolved === p || resolved.startsWith(p + path.sep) || p.startsWith(resolved + path.sep))) {
    throw new AppError('Nhật ký xóa phải nằm ngoài kho file và webroot.', 503);
  }
  return resolved;
}

/** Fsync the deletion intent before unlink, so restoring an older DB cannot resurrect its bytes. */
export async function journalPurge(root: string, id: string) {
  await mkdir(root, { recursive: true, mode: 0o700 });
  if ((await lstat(root)).isSymbolicLink()) throw new AppError('Kho nhật ký không được là symbolic link.', 503);
  const file = await open(path.join(root, 'model-purges.jsonl'), 'a', 0o600);
  try {
    await file.writeFile(JSON.stringify({ version: 1, assetId: id, claimedAt: new Date().toISOString() }) + '\n');
    await file.sync();
  } finally { await file.close(); }
}

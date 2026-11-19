require('../lib/database.cjs');require('../lib/register-typescript.cjs');
const {cleanupPrivateFiles}=require('../../src/server/private-files.ts');
cleanupPrivateFiles(process.argv.includes('--apply'),process.argv.includes('--retry-failed')).then(r=>{process.stdout.write(`${JSON.stringify(r)}\n`);if(r.failed||r.failedPurges)process.exitCode=1;}).catch(()=>{process.stderr.write('Không thể kiểm tra/dọn file hết hạn.\n');process.exitCode=1;}).finally(async()=>{if(globalThis.minhlabPgPool)await globalThis.minhlabPgPool.end();});

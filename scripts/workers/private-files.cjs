require('../lib/database.cjs');require('../lib/register-typescript.cjs');
const {processPrivateFiles}=require('../../src/server/private-files.ts');
processPrivateFiles().then(r=>process.stdout.write(`${JSON.stringify(r)}\n`)).catch(()=>{process.stderr.write('Không thể xử lý file private.\n');process.exitCode=1;}).finally(async()=>{if(globalThis.minhlabPgPool)await globalThis.minhlabPgPool.end();});

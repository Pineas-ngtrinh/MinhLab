require('../lib/database.cjs');
require('../lib/register-typescript.cjs');
const {expirePrintQuotes}=require('../../src/repositories/print-requests/file-retention.repository.ts');
expirePrintQuotes().then(result=>process.stdout.write(`${JSON.stringify(result)}\n`))
  .catch(()=>{process.stderr.write('Không thể xử lý báo giá hết hạn.\n');process.exitCode=1;})
  .finally(async()=>{if(globalThis.minhlabPgPool)await globalThis.minhlabPgPool.end();});

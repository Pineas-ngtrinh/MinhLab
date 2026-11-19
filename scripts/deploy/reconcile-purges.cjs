const fs=require('node:fs');
const path=require('node:path');
const {createPool}=require('../lib/database.cjs');
require('../lib/register-typescript.cjs');
const {privateFileConfig,removePrivateFile}=require('../../src/integrations/private-files/local-store.ts');
const {purgeJournalRoot}=require('../../src/integrations/private-files/purge-journal.ts');
async function main(){
  const config=privateFileConfig();
  if(!config)throw new Error('Private file configuration required.');
  const source=path.join(purgeJournalRoot(),'model-purges.jsonl');
  const ids=new Set();
  // Invalid or truncated records must be reviewed before traffic is reopened.
  for(const line of fs.readFileSync(source,'utf8').split('\n').filter(Boolean)) {
    const row=JSON.parse(line);
    if(row.version!==1 || !/^[0-9a-f-]{36}$/i.test(row.assetId))throw new Error('Invalid purge journal.');
    ids.add(row.assetId);
  }
  const pool=createPool();let removed=0;
  try{
    for(const id of ids){
      const row=(await pool.query("SELECT object_key FROM file_assets WHERE id=$1 AND storage_provider='LOCAL_PRIVATE'",[id])).rows[0];
      if(!row)continue;
      await removePrivateFile(config,row.object_key).catch(error=>{if(error.code!=='ENOENT')throw error;});
      await pool.query("UPDATE file_assets SET upload_status='DELETED',purged_at=now(),processing_lease_token=NULL,processing_lease_until=NULL,purge_token=NULL,purge_lease_until=NULL WHERE id=$1",[id]);
      removed++;
    }
    process.stdout.write(`${JSON.stringify({reconciled:removed})}\n`);
  } finally{await pool.end();}
}
if(!process.argv.includes('--offline')) {process.stderr.write('Stop web and all workers, then pass --offline before restoring access.\n');process.exitCode=1;}
else main().catch(()=>{process.stderr.write('Purge reconciliation failed; keep traffic closed and review journal/storage.\n');process.exitCode=1;});

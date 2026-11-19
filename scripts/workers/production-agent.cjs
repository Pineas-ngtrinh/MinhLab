const {randomUUID}=require('node:crypto');
const {createPool}=require('../lib/database.cjs');
require('../lib/register-typescript.cjs');
const {batchingDue}=require('../../src/domain/production/batch-trigger.ts');
const {runProductionAgent}=require('../../src/server/production-agent.ts');
const {ProductionService}=require('../../src/server/production.ts');
const {eligible,unmet}=require('../../src/domain/production/planning.ts');
async function claim(pool) {
 const token=randomUUID();
 await pool.query("UPDATE production_events SET status='FAILED',lease_token=NULL,lease_until=NULL WHERE status='PROCESSING' AND attempts>=5 AND lease_until<=now()");
 const r=await pool.query(`UPDATE production_events SET status='PROCESSING',attempts=attempts+1,lease_token=$1,lease_until=now()+interval '2 minutes'
 WHERE id=(SELECT id FROM production_events WHERE attempts<5 AND ((status='PENDING' AND retry_after<=now()) OR (status='PROCESSING' AND lease_until<=now())) ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1)
 RETURNING id,attempts`,[token]);return r.rows[0]?{...r.rows[0],token}:null;
}
async function deliver(pool,limit=10) {
 if(process.env.MINHLAB_PRODUCTION_WORKER_ENABLED!=='true') return {status:'DISABLED',processed:0};
 const min=Number(process.env.MINHLAB_BATCH_MIN_ORDERS??3),hours=Number(process.env.MINHLAB_BATCH_MAX_WAIT_HOURS??24);
 if(!Number.isSafeInteger(min)||min<1||min>100||!Number.isFinite(hours)||hours<=0) throw Error('Cấu hình ngưỡng gom mẻ không hợp lệ.');
 let processed=0;
 while(processed<limit) {
  const s=await ProductionService.workspace();
   const pending=s.items.filter(i=>eligible(i)&&!i.packedAt).filter(i=>{const needs=unmet(s,i);return needs===null||needs.some(n=>n.quantity>0);});
   if(pending.length&&!batchingDue(pending,Date.now(),min,hours))break;
   const event=await claim(pool);if(!event)break;
   try {
   const itemIds=pending.slice(0,100).map(i=>i.id);
   if(itemIds.length) await runProductionAgent({itemIds,key:event.id,eventId:event.id});
   await pool.query("UPDATE production_events SET status='SENT',processed_at=now(),lease_token=NULL,lease_until=NULL WHERE id=$1 AND lease_token=$2",[event.id,event.token]);
  } catch {
   await pool.query("UPDATE production_events SET status=CASE WHEN attempts>=5 THEN 'FAILED' ELSE 'PENDING' END,retry_after=now()+interval '5 minutes',lease_token=NULL,lease_until=NULL WHERE id=$1 AND lease_token=$2",[event.id,event.token]);
  }
  processed++;
 }
 return {status:'DONE',processed};
}
if(require.main===module) {
 const pool=createPool();deliver(pool).then(r=>process.stdout.write(`${JSON.stringify(r)}\n`)).catch(()=>{process.stderr.write('Không thể chạy production agent worker.\n');process.exitCode=1;}).finally(async()=>{await pool.end();if(globalThis.minhlabPgPool)await globalThis.minhlabPgPool.end();});
}
module.exports={claim,deliver};

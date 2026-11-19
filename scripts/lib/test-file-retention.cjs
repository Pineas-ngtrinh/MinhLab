const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const fs=require('node:fs/promises');
const path=require('node:path');
module.exports=async function({check,pool,owner,other,admin,workshop,operator,reviewer,cmd,ok,list,input,fileId,requestId,number,temp}) {
  const {NextRequest}=require('next/server');
  const upload=require('../../app/api/print-files/route.ts');
  const download=require('../../app/api/print-files/[id]/route.ts');
  const {cleanupPrivateFiles}=require('../../src/server/private-files.ts');
  const {readFileRetention,cleanupCandidates,finishFilePurge,expirePrintQuotes}=require('../../src/repositories/print-requests/file-retention.repository.ts');
  const uploadFile=async()=>{
    const r=await upload.POST(new NextRequest('http://localhost:3100/api/print-files',{method:'POST',headers:{Cookie:owner.cookie,'Content-Type':'application/octet-stream'},body:Buffer.alloc(200)}));
    assert.equal(r.status,201);return (await r.json()).data.id;
  };
  const get=async(id,actor=owner)=>download.GET(new NextRequest(`http://localhost:3100/api/print-files/${id}`,{headers:{Cookie:actor.cookie}}),{params:Promise.resolve({id})});
  const current=async(id)=>(await list()).find(r=>r.id===id);
  const state=async(id)=>(await pool.query('SELECT * FROM file_assets WHERE id=$1',[id])).rows[0];
  const past=async(id)=>pool.query("UPDATE file_assets SET created_at=now()-interval '3 days',processing_lease_until=NULL WHERE id=$1",[id]);
  let closedFile,closedRequest;

  await check('close/reopen distinguishes abandoned requests from conversion and enforces owner and roles',async()=>{
    closedFile=await uploadFile();await past(closedFile);
    closedRequest=(await ok({action:'SUBMIT',input:{...input,fileId:closedFile}})).id;
    assert.equal((await cmd({action:'CLOSE',id:closedRequest,revision:1,note:'Foreign'},other)).status,404);
    assert.equal((await cmd({action:'HOLD',id:closedRequest,revision:1,note:'Forbidden',reviewAt:new Date(Date.now()+86400000).toISOString()})).status,403);
    assert.equal((await cmd({action:'CLOSE',id:requestId,revision:2,note:'Cannot close converted'})).status,409);
    const key=randomUUID(),close={action:'CLOSE',id:closedRequest,revision:1,note:'Customer no longer needs this'};
    await ok(close,owner,key);await ok(close,owner,key);
    let r=await current(closedRequest);assert.equal(r.status,'CLOSED');assert.equal(r.closedReason,'CUSTOMER_CLOSED');
    assert(Date.parse(r.file.scheduledDeletionAt)>Date.now()+47*3600000);
    await ok({action:'REOPEN',id:r.id,revision:r.revision,note:'Customer returns before deletion'});
    r=await current(closedRequest);assert.equal(r.status,'NEEDS_REVISION');assert.equal(r.file.scheduledDeletionAt,null);
    assert.equal((await cmd(close)).status,409);
  });
  await check('active references override old upload age; completed orders get 7 days and holds delay purge',async()=>{
    assert.equal((await cleanupPrivateFiles()).eligible,0);
    await pool.query("UPDATE orders SET order_status='COMPLETED',completed_at=now()-interval '6 days' WHERE order_number=$1",[number]);
    let row=(await readFileRetention(pool,[fileId]))[0];assert(Date.parse(row.decision.deleteAfter)>Date.now());
    await pool.query("UPDATE orders SET completed_at=now()-interval '8 days' WHERE order_number=$1",[number]);
    const reviewAt=new Date(Date.now()+86400000).toISOString();
    await ok({action:'HOLD',id:requestId,revision:2,note:'REPRINT-FIXTURE',reviewAt},admin);
    row=(await readFileRetention(pool,[fileId]))[0];assert.equal(row.decision.reason,'HOLD');
    const adminRows=(await require('../../src/server/print-requests.ts').printWorkspace({id:admin.body.data.id,role:'ADMIN'})).requests;
    const hold=adminRows.find(r=>r.id===requestId).fileHolds[0];assert(hold.id);
    assert.equal((await current(requestId)).fileHolds,undefined);
    assert.equal((await cmd({action:'RELEASE_HOLD',id:requestId,revision:2,holdId:hold.id,note:'No role'},reviewer)).status,403);
    await ok({action:'RELEASE_HOLD',id:requestId,revision:2,holdId:hold.id,note:'Reprint completed'},admin);
    row=(await readFileRetention(pool,[fileId]))[0];assert(Date.parse(row.decision.deleteAfter)>Date.now()+6*86400000);
    await pool.query("UPDATE print_file_holds SET released_at=now()-interval '8 days' WHERE id=$1",[hold.id]);
  });
  await check('unresolved return and active jobs protect completed files; shared open requests also protect them',async()=>{
    const order=(await pool.query('SELECT id FROM orders WHERE order_number=$1',[number])).rows[0];
    const ret=(await pool.query("INSERT INTO order_return_requests(order_id,reason) VALUES($1,'Retention fixture') RETURNING id",[order.id])).rows[0];
    assert.equal((await readFileRetention(pool,[fileId]))[0].decision.reason,'HOLD');
    await pool.query(`UPDATE order_return_requests SET status='REFUNDED',received_by_user_id=$2,received_at=now(),refunded_by_user_id=$2,refunded_at=now() WHERE id=$1`,[ret.id,admin.body.data.id]);
    assert(Date.parse((await readFileRetention(pool,[fileId]))[0].decision.deleteAfter)>Date.now()+6*86400000);
    await pool.query("UPDATE order_return_requests SET refunded_at=now()-interval '8 days' WHERE id=$1",[ret.id]);
    const shared=(await ok({action:'SUBMIT',input:{...input,fileId}})).id;
    assert.equal((await readFileRetention(pool,[fileId]))[0].decision.reason,'ACTIVE_REQUEST');
    await ok({action:'CLOSE',id:shared,revision:1,note:'Shared request ended'});
    await pool.query("UPDATE print_requests SET closed_at=now()-interval '3 days' WHERE id=$1",[shared]);
  });
  await check('cleanup dry-run changes nothing; purge keeps metadata, returns 410 only to owners and blocks reopen',async()=>{
    let r=await current(closedRequest);await ok({action:'CLOSE',id:r.id,revision:r.revision,note:'Done'});
    await pool.query("UPDATE print_requests SET closed_at=now()-interval '3 days' WHERE id=$1",[closedRequest]);
    const before=await state(closedFile);const preview=await cleanupPrivateFiles();assert(preview.eligible>=1);assert.equal(preview.removed,0);
    const after=await state(closedFile);assert.equal(after.upload_status,before.upload_status);assert.equal(after.purge_attempts,0);
    const response=await get(closedFile);assert.equal(response.status,200);const body=response.arrayBuffer();
    const result=await cleanupPrivateFiles(true);assert(result.removed>=1);assert.equal(result.failed,0);
    assert.equal((await body).byteLength,200);
    assert.equal((await state(closedFile)).upload_status,'DELETED');assert((await state(closedFile)).purged_at);
    assert.equal((await get(closedFile)).status,410);assert.equal((await get(closedFile,other)).status,404);
    r=await current(closedRequest);assert.equal(r.file.availability,'PURGED');
    assert.equal((await cmd({action:'REOPEN',id:r.id,revision:r.revision,note:'Too late'})).status,409);
    const journal=await fs.readFile(path.join(temp+'-journal','model-purges.jsonl'),'utf8');assert(journal.includes(closedFile));
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM attachments WHERE file_asset_id=$1',[closedFile])).rows[0].n,1);
    assert.equal((await cleanupPrivateFiles(true)).removed,0);
  });
  await check('payment images and legacy assets are excluded; stale processing leases cannot resurrect tombstones',async()=>{
    const legacy=await uploadFile(),proof=await uploadFile(),leased=await uploadFile();
    for(const id of [legacy,proof,leased])await past(id);
    await pool.query("UPDATE file_assets SET asset_kind='LEGACY' WHERE id=$1",[legacy]);
    await pool.query("UPDATE file_assets SET asset_kind='PAYMENT_PROOF' WHERE id=$1",[proof]);
    const scanToken=randomUUID();await pool.query("UPDATE file_assets SET processing_lease_token=$2,processing_lease_until=now()+interval '2 minutes' WHERE id=$1",[leased,scanToken]);
    assert.equal((await cleanupPrivateFiles()).eligible,0);
    await pool.query("UPDATE file_assets SET processing_lease_until=now()-interval '1 minute' WHERE id=$1",[leased]);
    const claim=await cleanupCandidates(true);assert.equal(claim.rows.length,1);
    const {privateFiles}=require('../../src/repositories/print-requests/private-file.repository.ts');
    await privateFiles.finish(leased,scanToken,'CLEAN',{});assert.equal((await state(leased)).upload_status,'DELETED');
    // Simulate death after unlink and before recording success. The next owner reconciles ENOENT.
    await fs.unlink(path.join(temp,(await state(leased)).object_key));
    await pool.query("UPDATE file_assets SET purge_lease_until=now()-interval '1 minute' WHERE id=$1",[leased]);
    assert.equal((await cleanupPrivateFiles(true)).removed,1);
    assert.equal((await state(legacy)).purged_at,null);assert.equal((await state(proof)).purged_at,null);
  });
  await check('concurrent workers claim once; failures retain quota, require backoff and bounded retry',async()=>{
    const id=await uploadFile();await past(id);
    const claims=await Promise.all([cleanupCandidates(true),cleanupCandidates(true)]);
    const rows=claims.flatMap(r=>r.rows).filter(r=>r.id===id);assert.equal(rows.length,1);
    await finishFilePurge(id,rows[0].token,false);assert.equal((await state(id)).purged_at,null);
    assert.equal((await cleanupPrivateFiles()).eligible,0);
    await pool.query("UPDATE file_assets SET purge_retry_at=now()-interval '1 minute',purge_attempts=5 WHERE id=$1",[id]);
    assert.equal((await cleanupPrivateFiles(true)).removed,0);
    assert.equal((await cleanupPrivateFiles(true,true)).removed,1);
  });
  await check('expired quotes close only unconverted current requests; converted orders survive expiry',async()=>{
    const id=(await ok({action:'SUBMIT',input:{...input,fileId:null}})).id;
    await pool.query("UPDATE print_requests SET status='READY_FOR_QUOTE' WHERE id=$1",[id]);
    await pool.query(`INSERT INTO quotes(quote_number,print_request_id,created_by,status,valid_until,revision_number,subtotal,grand_total,request_revision)
      VALUES($1,$2,$3,'SENT',now()-interval '1 minute',1,1000,1000,1)`,['EXP-'+randomUUID(),id,reviewer.body.data.id]);
    const result=await expirePrintQuotes();assert(result.closed>=1);
    const r=await current(id);assert.equal(r.closedReason,'QUOTE_EXPIRED');
    assert.equal((await current(requestId)).closedReason,'CONVERTED');
  });
};

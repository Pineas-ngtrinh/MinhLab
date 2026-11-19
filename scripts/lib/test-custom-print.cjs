const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');
module.exports=async function({check,call,pool,owner,other,reviewer,admin,workshop,operator}) {
 const cmd=(body,account=owner,key=randomUUID())=>call('printRequests','POST',body,account.cookie,undefined,undefined,{'Idempotency-Key':key});
 const ok=async(body,account=owner,key)=>{const r=await cmd(body,account,key);assert.equal(r.status,200,JSON.stringify(r.body));return r.body.data;};
 const list=async(account=owner)=>{const r=await call('printRequests','GET',undefined,account.cookie);assert.equal(r.status,200,JSON.stringify(r.body));return r.body.data.requests;};
 const {NextRequest}=require('next/server');const uploadRoute=require('../../app/api/print-files/route.ts');const fileRoute=require('../../app/api/print-files/[id]/route.ts');
 const temp=await fs.mkdtemp(path.join(os.tmpdir(),'minhlab-private-fixture-'));const before={};
 for(const k of ['MINHLAB_PRIVATE_PURGE_JOURNAL_ROOT','MINHLAB_PRIVATE_FILES_ENABLED','MINHLAB_PRIVATE_FILES_ROOT','MINHLAB_PRIVATE_FILES_SCANNER','MINHLAB_PRIVATE_UPLOAD_MAX_BYTES','MINHLAB_PRIVATE_UPLOAD_QUOTA_BYTES','MINHLAB_PRIVATE_FILES_RETENTION_DAYS','MINHLAB_PRIVATE_UPLOAD_FORMATS'])before[k]=process.env[k];
 let fileId,requestId,quoteId,quote,material;
 const input={fileId:null,quantity:3,material:'Fixture requested material',color:'Fixture black',purpose:'Fixture test only',note:'Synthetic request',rightsAccepted:true,contact:{name:'Synthetic owner',phone:'0901234567',address:'Isolated fixture address'}};
 try {
 await check('private custom intake waits for configuration and never exposes another owner file',async()=>{
  process.env.MINHLAB_PRIVATE_FILES_ENABLED='false';
  let response=await uploadRoute.POST(new NextRequest('http://localhost:3100/api/print-files',{method:'POST',headers:{Cookie:owner.cookie,'Content-Type':'application/octet-stream'},body:Buffer.alloc(200)}));assert.equal(response.status,503);
  const scanner=path.join(temp,'synthetic-scanner.sh');await fs.writeFile(scanner,'#!/bin/sh\nexit 0\n',{mode:0o700});
  Object.assign(process.env,{MINHLAB_PRIVATE_FILES_ENABLED:'true',MINHLAB_PRIVATE_FILES_ROOT:temp,MINHLAB_PRIVATE_PURGE_JOURNAL_ROOT:temp+'-journal',MINHLAB_PRIVATE_FILES_SCANNER:scanner,MINHLAB_PRIVATE_UPLOAD_MAX_BYTES:'10000',MINHLAB_PRIVATE_UPLOAD_QUOTA_BYTES:'100000',MINHLAB_PRIVATE_FILES_RETENTION_DAYS:'1',MINHLAB_PRIVATE_UPLOAD_FORMATS:'STL,OBJ,STEP'});
  const triangles=[[[0,0,0],[0,10,0],[10,0,0]],[[0,0,0],[10,0,0],[0,0,10]],[[0,0,0],[0,0,10],[0,10,0]],[[10,0,0],[0,10,0],[0,0,10]]];
  const bytes=Buffer.alloc(84+50*triangles.length);bytes.writeUInt32LE(triangles.length,80);triangles.forEach((t,i)=>t.forEach((p,j)=>p.forEach((n,k)=>bytes.writeFloatLE(n,84+50*i+12+j*12+k*4))));
  response=await uploadRoute.POST(new NextRequest('http://localhost:3100/api/print-files',{method:'POST',headers:{Cookie:owner.cookie,'Content-Type':'application/octet-stream'},body:bytes}));assert.equal(response.status,201,JSON.stringify(await response.clone().json()));fileId=(await response.json()).data.id;
  const denied=await fileRoute.GET(new NextRequest(`http://localhost:3100/api/print-files/${fileId}`,{headers:{Cookie:other.cookie}}),{params:Promise.resolve({id:fileId})});assert.equal(denied.status,404);
  const own=await fileRoute.GET(new NextRequest(`http://localhost:3100/api/print-files/${fileId}`,{headers:{Cookie:owner.cookie}}),{params:Promise.resolve({id:fileId})});assert.equal(own.status,200);assert.deepEqual(Buffer.from(await own.arrayBuffer()),bytes);
 });
 await check('custom request retries save one owned revision; reviewers claim atomically and cannot invent scan approval',async()=>{
  input.fileId=fileId;const key=randomUUID();requestId=(await ok({action:'SUBMIT',input},owner,key)).id;await ok({action:'SUBMIT',input},owner,key);
  assert.equal((await list()).filter(r=>r.id===requestId).length,1);
  assert.equal((await list(other)).some(r=>r.id===requestId),false);
  const foreign=await cmd({action:'SUBMIT',input},other);assert.equal(foreign.status,404);
  assert.equal((await cmd({action:'CLAIM',id:requestId,revision:1},admin)).status,403);
  const rival=await call('register','POST',{email:'rival-reviewer@example.test',fullName:'Synthetic rival reviewer',password:'Isolated-test-password-2026'});assert.equal(rival.status,201);
  await pool.query("UPDATE user_roles SET role_id=(SELECT id FROM roles WHERE code='FILE_REVIEWER') WHERE user_id=$1",[rival.body.data.id]);
  const unclaimed=(await list(reviewer)).find(r=>r.id===requestId);assert.equal(unclaimed.contact.phone,'');
  const claims=await Promise.all([cmd({action:'CLAIM',id:requestId,revision:1},reviewer),cmd({action:'CLAIM',id:requestId,revision:1},rival)]);assert.deepEqual(claims.map(r=>r.status).sort(),[200,409]);
  reviewer=claims[0].status===200?reviewer:rival;
  await ok({action:'ASSIGN',id:requestId,revision:1,reviewerId:reviewer.body.data.id,note:'Synthetic explicit assignment'},admin);
  material=(await pool.query('SELECT id FROM materials WHERE status=$1 ORDER BY id LIMIT 1',['ACTIVE'])).rows[0]?.id;
  if(!material)material=(await pool.query("INSERT INTO materials(material_code,technology,material_type,color_name,inventory_unit,unit_cost) VALUES('CUSTOM_FIXTURE','FDM','PLA','Fixture','GRAM',0) RETURNING id")).rows[0].id;
  const b={action:'ISSUE',id:requestId,revision:1,input:{materialId:material,color:'Fixture',length:10,width:10,height:10,scale:100,unitPrice:1000,shipping:5000,validUntil:new Date(Date.now()+3600000).toISOString(),promisedFinishAt:new Date(Date.now()+7200000).toISOString(),terms:'Synthetic full quote terms',evidenceCode:'SYNTHETIC_ONLY',checksConfirmed:true}};
  assert.equal((await cmd(b,reviewer)).status,409);
  const {processPrivateFiles}=require('../../src/server/private-files.ts');assert.equal((await processPrivateFiles()).processed,1);
  // Scanner above is an explicit test executable, not evidence of real malware screening.
  quoteId=(await ok(b,reviewer)).id;quote=(await list()).find(r=>r.id===requestId).quotes.find(q=>q.id===quoteId);
  assert.equal(quote.quantity,3);assert.equal(quote.total,8000);
  assert.equal((await cmd({action:'ACCEPT',id:requestId,revision:1,quoteId,termsHash:quote.termsHash},other)).status,404);
  assert.equal((await cmd({action:'ACCEPT',id:requestId,revision:1,quoteId,termsHash:'x'.repeat(64)})).status,409);
 });
 await check('changing the request supersedes old quotes and acceptance rejects stale revisions',async()=>{
  await ok({action:'SUBMIT',id:requestId,revision:1,input:{...input,quantity:4}});
  assert.equal((await cmd({action:'ACCEPT',id:requestId,revision:1,quoteId,termsHash:quote.termsHash})).status,409);
  await ok({action:'CLAIM',id:requestId,revision:2},reviewer);
  quoteId=(await ok({action:'ISSUE',id:requestId,revision:2,input:{materialId:material,color:'Fixture',length:10,width:10,height:10,scale:100,unitPrice:2000,shipping:5000,validUntil:new Date(Date.now()+3600000).toISOString(),promisedFinishAt:new Date(Date.now()+7200000).toISOString(),terms:'Revised synthetic quote',evidenceCode:'SYNTHETIC_ONLY',checksConfirmed:true}},reviewer)).id;
  quote=(await list()).find(r=>r.id===requestId).quotes.find(q=>q.id===quoteId);assert.equal(quote.quantity,4);assert.equal(quote.total,13000);
 });
 let number;
 await check('custom acceptance atomically converts the whole quote once and replays successfully after expiry',async()=>{
  const body={action:'ACCEPT',id:requestId,revision:2,quoteId,termsHash:quote.termsHash};
  const results=await Promise.all([cmd(body),cmd(body)]);assert(results.every(r=>r.status===200),JSON.stringify(results));assert.equal(results[0].body.data.number,results[1].body.data.number);number=results[0].body.data.number;
  assert.equal(Number((await pool.query('SELECT count(*) FROM orders WHERE accepted_quote_id=$1',[quoteId])).rows[0].count),1);
  const stored=(await pool.query('SELECT i.quantity,i.unit_price,o.shipping_fee,o.grand_total FROM orders o JOIN order_items i ON i.order_id=o.id WHERE o.order_number=$1',[number])).rows[0];assert.equal(stored.quantity,4);assert.equal(Number(stored.unit_price),2000);assert.equal(Number(stored.grand_total),13000);
  await assert.rejects(pool.query('UPDATE quotes SET grand_total=1 WHERE id=$1',[quoteId]),/immutable/i);
  // Owner-only fixture time travel; the runtime API cannot rewrite the issued expiry.
  await pool.query('ALTER TABLE quotes DISABLE TRIGGER custom_quote_immutable');
  try {await pool.query("UPDATE quotes SET valid_until=now()-interval '1 minute' WHERE id=$1",[quoteId]);}finally{await pool.query('ALTER TABLE quotes ENABLE TRIGGER custom_quote_immutable');}
  assert.equal((await cmd(body)).body.data.number,number);
  assert.equal((await cmd({action:'SUBMIT',id:requestId,revision:2,input})).status,409);
  assert.equal((await cmd({action:'ACCEPT',...body},workshop)).status,403);
  assert.equal((await call('printRequests','GET',undefined,operator.cookie)).status,403);
 });

 await check('paid custom production requires technical batch approval, real start, partial QC and full packing',async()=>{
  const pcmd=(body,actor=operator,key=randomUUID())=>call('production','POST',body,actor.cookie,undefined,undefined,{'Idempotency-Key':key});
  const pok=async(body,actor=operator,key)=>{const r=await pcmd(body,actor,key);assert.equal(r.status,200,JSON.stringify(r.body));return r.body.data;};
  const pub=async input=>{const id=(await pok({action:'SAVE_REVISION',input},admin)).id;await pok({action:'VERIFY',id});await pok({action:'PUBLISH',id},admin);return id;};
  assert.equal((await call('verify','POST',{orderNumber:number},admin.cookie)).status,200);
  assert.equal((await call('admin','PATCH',{orderNumber:number,newStatus:'IN_PRODUCTION'},admin.cookie)).status,409);
  const item=(await pool.query('SELECT i.id FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.order_number=$1',[number])).rows[0];
  const mat=(await pool.query('SELECT material_code,technology FROM materials WHERE id=$1',[material])).rows[0];
  const printer=(await pok({action:'SAVE_PRINTER',input:{code:'CUSTOM_MACHINE',name:'Custom synthetic machine',technology:mat.technology,status:'AVAILABLE'}},admin)).id;
  const profile=await pub({kind:'PROFILE',code:'CUSTOM_RUNTIME_PROFILE',printerId:printer,body:{name:'Custom synthetic verified profile',technology:mat.technology,material:mat.material_code,color:'Fixture',appearance:'OPAQUE',processCode:'CUSTOM_PROCESS'}});
  await pok({action:'INVENTORY',stockKey:`material:${mat.material_code}:Fixture:OPAQUE`,quantity:10,revision:0},admin);
  const inputBatch={itemId:item.id,profileId:profile,quantity:4,durationMinutes:1,materialQuantity:1,startAt:new Date().toISOString(),evidenceCode:'CUSTOM_BATCH_FIXTURE',confirmed:true};
  assert.equal((await pcmd({action:'CUSTOM_APPROVE',input:inputBatch},admin)).status,403);
  const approved=(await pok({action:'CUSTOM_APPROVE',input:inputBatch},reviewer)).id;
  assert.equal((await pcmd({action:'CUSTOM_APPROVE',input:inputBatch},reviewer)).status,409);
  const source=await fileRoute.GET(new NextRequest(`http://localhost:3100/api/print-files/${fileId}`,{headers:{Cookie:operator.cookie}}),{params:Promise.resolve({id:fileId})});assert.equal(source.status,200);await source.arrayBuffer();
  const order=await pool.query('SELECT order_status FROM orders WHERE order_number=$1',[number]);assert.equal(order.rows[0].order_status,'CONFIRMED');
  await pok({action:'CUSTOM_START',id:approved});await pok({action:'CUSTOM_FINISH',id:approved});
  assert.equal((await pcmd({action:'CUSTOM_PACK',id:item.id})).status,409);
  await pok({action:'CUSTOM_QC_READY',id:approved});await pok({action:'CUSTOM_QC',id:approved,good:3,failed:1});
  assert.equal((await pcmd({action:'CUSTOM_PACK',id:item.id})).status,409);
  const reprint=(await pok({action:'CUSTOM_APPROVE',input:{...inputBatch,quantity:1,startAt:new Date().toISOString()}},reviewer)).id;
  await pok({action:'CUSTOM_START',id:reprint});await pok({action:'CUSTOM_FINISH',id:reprint});await pok({action:'CUSTOM_QC_READY',id:reprint});await pok({action:'CUSTOM_QC',id:reprint,good:1,failed:0});
  assert.equal(Number((await pool.query('SELECT count(*) FROM production_holds WHERE custom_order_item_id=$1 AND released_at IS NULL',[item.id])).rows[0].count),1);
  const packKey=randomUUID();await pok({action:'CUSTOM_PACK',id:item.id},operator,packKey);await pok({action:'CUSTOM_PACK',id:item.id},operator,packKey);
  assert.equal(Number((await pool.query('SELECT count(*) FROM production_holds WHERE custom_order_item_id=$1 AND released_at IS NULL',[item.id])).rows[0].count),0);
  await pok({action:'CUSTOM_READY',id:item.id});assert.equal((await pool.query('SELECT order_status FROM orders WHERE order_number=$1',[number])).rows[0].order_status,'READY_TO_SHIP');
 });

 await check('OBJ intake requires assigned human inspection after scanning; declining a quote creates no order',async()=>{
  const response=await uploadRoute.POST(new NextRequest('http://localhost:3100/api/print-files',{method:'POST',headers:{Cookie:owner.cookie,'Content-Type':'application/octet-stream','X-Model-Format':'OBJ'},body:'# synthetic OBJ fixture\nv 0 0 0\nv 10 0 0\nv 0 10 0\nf 1 2 3\n'}));assert.equal(response.status,201);const objId=(await response.json()).data.id;
  await require('../../src/server/private-files.ts').processPrivateFiles();
  const downloaded=await fileRoute.GET(new NextRequest(`http://localhost:3100/api/print-files/${objId}`,{headers:{Cookie:owner.cookie}}),{params:Promise.resolve({id:objId})});
  assert.equal(downloaded.status,200);assert.equal(downloaded.headers.get('content-disposition'),'attachment; filename="model.obj"');await downloaded.arrayBuffer();
  const id=(await ok({action:'SUBMIT',input:{...input,fileId:objId,quantity:1}})).id;
  await ok({action:'CLAIM',id,revision:1},reviewer);
  let r=(await list()).find(r=>r.id===id);assert.equal(r.file.analysisStatus,'MANUAL_REVIEW');
  const analysis={action:'FILE_MANUAL_ANALYSIS',id,revision:1,input:{w:10,d:10,h:1,evidenceCode:'MANUAL_FIXTURE'}};
  assert.equal((await cmd(analysis)).status,403);await ok(analysis,reviewer);
  r=(await list()).find(r=>r.id===id);assert.equal(r.file.analysisStatus,'COMPLETE');assert(r.file.analysis.flags.includes('MANUAL_REVIEW'));
  const qid=(await ok({action:'ISSUE',id,revision:1,input:{materialId:material,color:'Fixture',length:10,width:10,height:1,scale:100,unitPrice:2000,shipping:5000,validUntil:new Date(Date.now()+3600000).toISOString(),promisedFinishAt:new Date(Date.now()+7200000).toISOString(),terms:'Manual synthetic OBJ quote',evidenceCode:'SYNTHETIC_ONLY',checksConfirmed:true}},reviewer)).id;
  const before=Number((await pool.query('SELECT count(*) FROM orders')).rows[0].count);
  await ok({action:'DECLINE',id,revision:1,quoteId:qid,note:'Synthetic customer requests a different finish'});
  assert.equal(Number((await pool.query('SELECT count(*) FROM orders')).rows[0].count),before);
  r=(await list()).find(r=>r.id===id);assert.equal(r.quotes[0].status,'DECLINED');assert.equal(r.status,'NEEDS_REVISION');
 });

 await check('custom request queues paginate and filter on the server without crossing owner scope',async()=>{
  for(let i=0;i<7;i++)await ok({action:'SUBMIT',input:{...input,fileId:null,rightsAccepted:false,note:`Pagination fixture ${i}`}});
  const first=await call('printRequests','GET',undefined,owner.cookie,'http://localhost:3100/api/print-requests?page=1&pageSize=3');const second=await call('printRequests','GET',undefined,owner.cookie,'http://localhost:3100/api/print-requests?page=2&pageSize=3');
  assert.equal(first.status,200);assert.equal(second.status,200);assert.equal(first.body.data.requests.length,3);assert(first.body.data.pagination.total>=9);assert(second.body.data.requests.every(r=>!first.body.data.requests.some(x=>x.id===r.id)));
  const filtered=await call('printRequests','GET',undefined,owner.cookie,'http://localhost:3100/api/print-requests?status=NEEDS_REVISION');assert(filtered.body.data.requests.every(r=>r.status==='NEEDS_REVISION'));
  const none=await call('printRequests','GET',undefined,other.cookie,'http://localhost:3100/api/print-requests?page=2&pageSize=3');assert.equal(none.body.data.requests.length,0);
 });

 await check('private file retention defaults to preview and never deletes referenced request/order assets',async()=>{
  const response=await uploadRoute.POST(new NextRequest('http://localhost:3100/api/print-files',{method:'POST',headers:{Cookie:owner.cookie,'Content-Type':'application/octet-stream'},body:Buffer.alloc(200)}));assert.equal(response.status,201);const orphan=(await response.json()).data.id;
  await pool.query("UPDATE file_assets SET created_at=now()-interval '3 days' WHERE id=ANY($1::uuid[])",[[orphan,fileId]]);
  const {cleanupPrivateFiles}=require('../../src/server/private-files.ts');const preview=await cleanupPrivateFiles();assert.equal(preview.status,'DRY_RUN');assert.equal(preview.eligible,1);assert.equal(preview.removed,0);
  const result=await cleanupPrivateFiles(true);assert.equal(result.removed,1);
  assert.equal((await pool.query('SELECT upload_status FROM file_assets WHERE id=$1',[fileId])).rows[0].upload_status,'AVAILABLE');
  const removed=await fileRoute.GET(new NextRequest(`http://localhost:3100/api/print-files/${orphan}`,{headers:{Cookie:owner.cookie}}),{params:Promise.resolve({id:orphan})});assert.equal(removed.status,410);
 });
  await require('./test-file-retention.cjs')({check,call,pool,owner,other,admin,workshop,operator,reviewer,cmd,ok,list,input,fileId,requestId,number,temp});
  if(process.env.MINHLAB_QA_ENV_PATH)globalThis.minhlabQaPrivateConfig=Object.fromEntries(Object.keys(before).map(k=>[k,process.env[k]]));
 }finally{for(const [k,v]of Object.entries(before)){if(v===undefined)delete process.env[k];else process.env[k]=v;}if(!globalThis.minhlabQaPrivateConfig){await fs.rm(temp,{recursive:true,force:true});await fs.rm(temp+'-journal',{recursive:true,force:true});}}
};

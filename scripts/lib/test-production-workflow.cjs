const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
module.exports=async function({check,call,pool,admin,workshop,operator,reviewer,owner,orderInput,product}) {
 const command=(body,account=admin,key=randomUUID())=>call('production','POST',body,account.cookie,undefined,undefined,{'Idempotency-Key':key});
 const workspace=async()=>(await call('production','GET',undefined,operator.cookie)).body.data;
 const ok=async(body,account=admin,key)=>{const r=await command(body,account,key);assert.equal(r.status,200,JSON.stringify(r.body));return r.body.data;};
 const publish=async input=>{const {id}=await ok({action:'SAVE_REVISION',input});await ok({action:'VERIFY',id},operator);await ok({action:'PUBLISH',id});return id;};
 const inventory=async(stockKey,quantity)=>{const s=await workspace();await ok({action:'INVENTORY',stockKey,quantity,revision:s.inventory.find(i=>i.key===stockKey)?.revision??0});};
 const spec={name:'Synthetic group fixture',unit:'group',envelope:{width:10,depth:10,height:10},routing:'PRINTED',objectsPerUnit:2,mirrorRequired:true,technology:'FDM',material:'FIXTURE_PLA',color:'FIXTURE_BLACK',appearance:'OPAQUE'};
 let component,accessory,bom,profile,printer,variant,checkId,itemIds,planId,secondPlan;
 await check('production metadata APIs enforce roles and do not expose PII, prices or file paths',async()=>{
  for(const a of [owner]) assert.equal((await call('production','GET',undefined,a.cookie)).status,403);
  assert.equal((await call('production')).status,401);
  const s=await workspace();assert.equal(s.agent.status,'WAITING_CONFIGURATION');
  assert(!JSON.stringify(s).includes('customerEmail'));assert(!JSON.stringify(s).includes('shippingAddress'));
  const workshopDraft=(await ok({action:'SAVE_REVISION',input:{kind:'COMPONENT',code:'WORKSHOP_FIXTURE_DRAFT',body:spec}},workshop)).id;
  assert.equal((await command({action:'PUBLISH',id:workshopDraft},workshop)).status,403);
  await ok({action:'VERIFY',id:workshopDraft},operator);
  await ok({action:'PUBLISH',id:workshopDraft},admin);
  assert.equal((await command({action:'SAVE_REVISION',input:{kind:'COMPONENT',code:'fixture',body:spec}},operator)).status,403);
  assert.equal((await command({action:'SAVE_REVISION',input:{kind:'COMPONENT',code:'private/file.stl',body:spec}})).status,400);
 });
 await check('dynamic manufacturing drafts require distinct technical verification and publication; published bodies stay immutable',async()=>{
  component=(await ok({action:'SAVE_REVISION',input:{kind:'COMPONENT',code:'FIXTURE_GROUP',body:spec}})).id;
  assert.equal((await command({action:'PUBLISH',id:component})).status,409);
  assert.equal((await command({action:'VERIFY',id:component})).status,403);
  await ok({action:'VERIFY',id:component},operator);await ok({action:'PUBLISH',id:component});
  await assert.rejects(pool.query("UPDATE manufacturing_revisions SET body='{}' WHERE id=$1",[component]),/new manufacturing revision/i);
  accessory=await publish({kind:'COMPONENT',code:'FIXTURE_DECAL',body:{...spec,name:'Synthetic finishing',routing:'FINISHING',technology:'',material:'',color:'',appearance:'',objectsPerUnit:1,mirrorRequired:false}});
  printer=(await ok({action:'SAVE_PRINTER',input:{code:'FIXTURE_MACHINE',name:'Isolated synthetic machine',technology:'FDM',status:'AVAILABLE'}})).id;
  profile=await publish({kind:'PROFILE',code:'FIXTURE_PROFILE',printerId:printer,body:{name:'Synthetic verified process',technology:'FDM',material:spec.material,color:spec.color,appearance:spec.appearance,processCode:'FIXTURE_PROCESS',plate:{width:100,depth:100,height:50,margin:2,spacing:2}}});
  variant=(await pool.query(`INSERT INTO product_variants(product_id,sku,variant_name,color_name,sale_price,status)
   SELECT id,'WORKFLOW-FIXTURE','Fixture','Fixture',9000,'ACTIVE' FROM products WHERE slug=$1 RETURNING id`,[product.slug])).rows[0].id;
  bom=await publish({kind:'BOM',code:'FIXTURE_BOM',variantId:variant,body:{lines:[{componentRevisionId:component,quantity:1},{componentRevisionId:accessory,quantity:1}]}});
  assert((await pool.query("SELECT 1 FROM production_events WHERE event_type='ManufacturingRevisionPublished' AND entity_id=$1",[bom])).rowCount);
 });
 const newOrder=async(quantity)=>{
  const order=await call('orders','POST',{...orderInput,items:[{...orderInput.items[0],productVariantId:variant,quantity}]},owner.cookie);
  assert.equal(order.status,201,JSON.stringify(order.body));
  const number=order.body.data.orderNumber;
  assert.equal((await call('verify','POST',{orderNumber:number},admin.cookie)).status,200);
  const row=(await pool.query('SELECT i.id,i.manufacturing_revision_id FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.order_number=$1',[number])).rows[0];
  assert.equal(row.manufacturing_revision_id,bom);return row.id;
 };
 const propose=async(ids,checks)=>ok({action:'PROPOSE',itemIds:ids,checkIds:checks,startAt:new Date(Date.now()+3000).toISOString()});
 const checkInput=(quantity)=>({code:`FIXTURE_BATCH_${quantity}`,profileRevisionId:profile,members:[{componentRevisionId:component,quantity}],durationMinutes:1,preparationMinutes:0,finishingMinutes:1,materialQuantity:1,evidenceCode:'FIXTURE_METADATA_ONLY',resourcesConfirmed:true});
 await check('unconfirmed inventory and required accessories are explicit waiting states, never implicit zero',async()=>{
  itemIds=[await newOrder(2),await newOrder(1)];
  // Make the FIFO fixture independent of earlier checkout scenarios sharing this disposable DB.
  for (const [index,id] of itemIds.entries()) await pool.query("UPDATE orders SET placed_at=timestamptz '2001-01-01' + $2::int * interval '1 day' WHERE id=(SELECT order_id FROM order_items WHERE id=$1)",[id,index]);
  let id=(await propose(itemIds,[])).id;
  assert.equal(Number((await pool.query("SELECT count(*) FROM telegram_outbox WHERE production_plan_id=$1 AND notification_type='PRODUCTION_PLAN_DRAFTED'",[id])).rows[0].count),1);
  let p=(await workspace()).plans.find(p=>p.id===id);assert.equal(p.status,'WAITING_DATA');assert(p.body.blockers.some(x=>x.startsWith('INVENTORY_UNKNOWN')));
  assert.equal((await command({action:'APPROVE',id,revision:1,note:'Fixture'})).status,409);
  await inventory(`finished:${variant}:${bom}`,0);await inventory(`component:${component}`,0);await inventory(`component:${accessory}`,0);await inventory(`material:${spec.material}:${spec.color}:${spec.appearance}`,10);
  id=(await propose(itemIds,[])).id;p=(await workspace()).plans.find(p=>p.id===id);assert(p.body.blockers.some(x=>x.startsWith('ACCESSORY_WAITING')));
  await inventory(`component:${accessory}`,3);
  assert.equal((await command({action:'SAVE_CHECK',input:{...checkInput(3),resourcesConfirmed:false}},operator)).status,400);
  checkId=(await ok({action:'SAVE_CHECK',input:checkInput(3)},operator)).id;
  planId=(await propose(itemIds,[checkId])).id;
  assert.equal((await workspace()).plans.find(p=>p.id===planId).status,'PENDING_APPROVAL');
  const rejected=await command({action:'REJECT',id:planId,revision:1,note:'Operator requests a safer batch.'},operator);
  assert.equal(rejected.status,200,JSON.stringify(rejected.body));
  assert.equal(rejected.body.data.status,'REJECTED');
  assert.equal(Number((await pool.query('SELECT count(*) FROM production_holds')).rows[0].count),0);
  planId=(await propose(itemIds,[checkId])).id;
  secondPlan=(await propose(itemIds,[checkId])).id;
 });
 await check('admin deletes only unapproved plans, preserves rows and rejects stale/replayed misuse',async()=>{
  const id=(await propose(itemIds,[checkId])).id;
  const remove={action:'DELETE_PLAN',id,revision:1};
  assert.equal((await command(remove,workshop)).status,403);
  assert.equal((await command(remove,operator)).status,403);
  assert.equal((await command({...remove,revision:2})).status,409);
  await pool.query(`CREATE FUNCTION reject_delete_plan_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='PLAN_DELETED' THEN RAISE EXCEPTION 'fixture rollback'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER reject_delete_plan_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_delete_plan_audit()`);
  try {assert.equal((await command(remove)).status,500);assert.equal((await pool.query('SELECT deleted_at FROM production_plans WHERE id=$1',[id])).rows[0].deleted_at,null);}
  finally {await pool.query('DROP TRIGGER reject_delete_plan_audit ON audit_logs; DROP FUNCTION reject_delete_plan_audit()');}
  const key=randomUUID();await ok(remove,admin,key);await ok(remove,admin,key);
  assert((await pool.query('SELECT deleted_at,deleted_by FROM production_plans WHERE id=$1',[id])).rows[0].deleted_at);
  assert(!(await workspace()).plans.some(p=>p.id===id));
  assert.equal((await command({...remove,action:'APPROVE',note:'Fixture'})).status,404);
  assert.equal((await command(remove)).status,404);
  assert.equal(Number((await pool.query("SELECT count(*) FROM audit_logs WHERE action='PLAN_DELETED' AND entity_id=$1",[id])).rows[0].count),1);
 });
 await check('approval rolls back jobs, holds, stock and decision when audit persistence fails',async()=>{
  await pool.query(`CREATE FUNCTION reject_plan_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='PLAN_APPROVED' THEN RAISE EXCEPTION 'fixture rollback'; END IF; RETURN NEW; END $$;
   CREATE TRIGGER reject_plan_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION reject_plan_audit()`);
  try {
   const r=await command({action:'APPROVE',id:planId,revision:1,note:'Fixture'});assert.equal(r.status,500);
   assert.equal(Number((await pool.query('SELECT count(*) FROM production_jobs WHERE plan_id IS NOT NULL')).rows[0].count),0);
   assert.equal(Number((await pool.query('SELECT count(*) FROM production_holds')).rows[0].count),0);
   assert.equal((await workspace()).inventory.find(i=>i.key===`component:${accessory}`).available,3);
  } finally {await pool.query('DROP TRIGGER reject_plan_audit ON audit_logs; DROP FUNCTION reject_plan_audit()');}
 });
 let approvedKey,job;
 await check('concurrent approvals commit one shared batch, and replay cannot duplicate resources or start commerce early',async()=>{
  // Refresh the timestamps after slow assertion/DB environments; both use the same committed input snapshot.
  planId=(await propose(itemIds,[checkId])).id;secondPlan=(await propose(itemIds,[checkId])).id;
  approvedKey=randomUUID();
  const body={action:'APPROVE',id:planId,revision:1,note:'Synthetic approval'};
  const responses=await Promise.all([command(body,operator,approvedKey),command({action:'APPROVE',id:secondPlan,revision:1,note:'Competing fixture'})]);
  assert.equal(responses[0].status,200,JSON.stringify(responses));assert.deepEqual(responses.map(r=>r.body.data.status).sort(),['APPROVED','STALE']);
  assert.equal((await command(body,operator,approvedKey)).status,200);
  const frozenJob=(await workspace()).jobs[0];await assert.rejects(pool.query("UPDATE production_jobs SET metadata_snapshot='{}'::jsonb WHERE id=$1",[frozenJob.id]),/immutable/i);await assert.rejects(pool.query('UPDATE production_supplies SET quantity=quantity+1 WHERE job_id=$1',[frozenJob.id]),/immutable/i);
  assert.equal((await command({...body,note:'Changed payload'},operator,approvedKey)).status,409);
  const s=await workspace();assert.equal(s.jobs.length,1);assert.equal(s.jobs[0].supplies.length,2);assert.equal(s.holds.length,1);job=s.jobs[0];
  assert(s.items.filter(i=>itemIds.includes(i.id)).every(i=>i.orderStatus==='CONFIRMED'));
  const publicOrder=s.items.find(i=>i.id===itemIds[0]);const tracked=await call('detail','GET',undefined,owner.cookie,undefined,Promise.resolve({orderNumber:publicOrder.orderNumber}));assert.equal(tracked.status,200,JSON.stringify(tracked.body));assert.equal(tracked.body.data.production[0].status,'SCHEDULED');assert(!JSON.stringify(tracked.body.data.production).includes('fileId'));assert(!JSON.stringify(tracked.body.data.production).includes('componentRevisionId'));
  const item=s.items.find(i=>i.id===itemIds[0]);
  assert.equal((await call('admin','PATCH',{orderNumber:item.orderNumber,newStatus:'IN_PRODUCTION'},admin.cookie)).status,409);
  assert.equal((await command({action:'START',id:job.id},operator)).status,409);
  const delay=Math.max(0,Date.parse(job.startAt)-Date.now()+30);await new Promise(r=>setTimeout(r,delay));
  await ok({action:'START',id:job.id},operator);
  assert((await workspace()).items.filter(i=>itemIds.includes(i.id)).every(i=>i.orderStatus==='IN_PRODUCTION'));
  assert.equal((await command({action:'PACK',id:itemIds[0]},operator)).status,409);
 });
 await check('approved production plans cannot be deleted',async()=>{
  const plan=(await workspace()).plans.find(p=>p.status==='APPROVED');
  assert(plan);
  assert.equal((await command({action:'DELETE_PLAN',id:plan.id,revision:plan.revision})).status,409);
  assert.equal((await pool.query('SELECT deleted_at FROM production_plans WHERE id=$1',[plan.id])).rows[0].deleted_at,null);
 });
 await check('partial QC failures generate only the missing quantity; shared machine holds survive the first order packing',async()=>{
  await ok({action:'FINISH',id:job.id},operator);assert.equal((await workspace()).holds.length,1);
  await ok({action:'QC_READY',id:job.id},operator);
  const results=job.supplies.map(a=>({supplyId:a.id,good:a.itemId===itemIds[0]?a.quantity:0,failed:a.itemId===itemIds[0]?0:a.quantity}));
  assert.equal((await command({action:'QC',id:job.id,results:results.map(r=>({...r,good:r.good+1}))},operator)).status,409);
  await ok({action:'QC',id:job.id,results},operator);
  await ok({action:'PACK',id:itemIds[0]},operator);await ok({action:'READY',id:itemIds[0]},operator);
  let s=await workspace();assert.equal(s.holds.length,1);
  assert.equal(s.items.find(i=>i.id===itemIds[0]).orderStatus,'READY_TO_SHIP');assert.equal(s.items.find(i=>i.id===itemIds[1]).orderStatus,'IN_PRODUCTION');
  assert.equal((await command({action:'PACK',id:itemIds[1]},operator)).status,409);
  const one=(await ok({action:'SAVE_CHECK',input:checkInput(1)},operator)).id;
  const replan=(await propose([itemIds[1]],[one])).id;
  s=await workspace();const p=s.plans.find(p=>p.id===replan);assert.equal(p.status,'PENDING_APPROVAL');assert.equal(p.body.jobs[0].allocations.reduce((n,a)=>n+a.quantity,0),1);
  assert.equal(p.body.stocks.length,0);
  await ok({action:'APPROVE',id:replan,revision:1,note:'Reprint only failed group'});
  s=await workspace();const next=s.jobs.find(j=>j.id!==job.id);
  await new Promise(r=>setTimeout(r,Math.max(0,Date.parse(next.startAt)-Date.now()+30)));
  await ok({action:'START',id:next.id},operator);await ok({action:'FINISH',id:next.id},operator);await ok({action:'QC_READY',id:next.id},operator);
  await ok({action:'QC',id:next.id,results:next.supplies.map(a=>({supplyId:a.id,good:a.quantity,failed:0}))},operator);
  await ok({action:'SAVE_PRINTER',id:printer,input:{code:'FIXTURE_MACHINE',name:'Isolated synthetic machine',technology:'FDM',status:'MAINTENANCE'}});
  const packKey=randomUUID();await ok({action:'PACK',id:itemIds[1]},operator,packKey);
  s=await workspace();assert.equal(s.holds.length,0);assert.equal(s.printers.find(p=>p.id===printer).status,'MAINTENANCE');
  await ok({action:'PACK',id:itemIds[1]},operator,packKey);assert.equal((await workspace()).holds.length,0);
 });
 await check('missing manufacturing attributes persist as drafts and cannot be technically verified or published',async()=>{
  const id=(await ok({action:'SAVE_REVISION',input:{kind:'COMPONENT',code:'WAITING_COMPONENT',body:{name:'Unconfirmed synthetic component',unit:'',routing:'PRINTED',objectsPerUnit:null,mirrorRequired:false,technology:'',material:'',color:'',appearance:''}}})).id;
  assert.equal((await command({action:'VERIFY',id},operator)).status,409);
  assert.equal((await command({action:'PUBLISH',id})).status,409);
  const draft=(await workspace()).revisions.find(r=>r.id===id);assert.equal(draft.status,'DRAFT');assert.equal(draft.body.objectsPerUnit,null);
 });
 await check('AI runtime fixture bounds metadata/tools and concurrent retries reuse one committed draft',async()=>{
  const envKeys=['MINHLAB_PRODUCTION_AGENT_ENABLED','MINHLAB_PRODUCTION_AGENT_METADATA_AUTHORIZED','MINHLAB_PRODUCTION_AGENT_PROVIDER','MINHLAB_PRODUCTION_AGENT_MODEL','MINHLAB_PRODUCTION_AGENT_API_KEY'];
  const before=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));const originalFetch=global.fetch;let fetchCalls=0;
  try {
   Object.assign(process.env,{MINHLAB_PRODUCTION_AGENT_ENABLED:'true',MINHLAB_PRODUCTION_AGENT_METADATA_AUTHORIZED:'true',MINHLAB_PRODUCTION_AGENT_PROVIDER:'openai',MINHLAB_PRODUCTION_AGENT_MODEL:'synthetic-fixture-model',MINHLAB_PRODUCTION_AGENT_API_KEY:'synthetic-key-never-sent'});
   const chosen=(await workspace()).items.find(i=>i.orderStatus==='CONFIRMED');assert(chosen);
   global.fetch=async(_url,options)=>{
    fetchCalls++;const b=JSON.parse(options.body);assert.equal(b.tools,undefined);assert.equal(b.messages.length,2);
    assert(!JSON.stringify(b).includes(chosen.id));throw new Error('fixture timeout');
   };
   const body={action:'RUN_AGENT',itemIds:[chosen.id],startAt:new Date(Date.now()+3600000).toISOString()};const key=randomUUID();
   const concurrent=await Promise.all([command(body,admin,key),command(body,admin,key)]);
   assert(concurrent.some(r=>r.status===200),JSON.stringify(concurrent));assert(concurrent.every(r=>[200,409].includes(r.status)),JSON.stringify(concurrent));
   const success=concurrent.find(r=>r.status===200);assert(concurrent.some(r=>typeof r.body?.data?.explanation==='string'));const replay=await command(body,admin,key);assert.equal(replay.status,200,JSON.stringify(replay.body));assert.equal(replay.body.data.id,success.body.data.id);assert.equal(fetchCalls,1);
   const changed=await command({...body,startAt:new Date(Date.now()+7200000).toISOString()},admin,key);assert.equal(changed.status,409);assert.equal(fetchCalls,1);
   const rows=(await pool.query('SELECT status,plan_id FROM production_agent_runs WHERE plan_id=$1',[success.body.data.id])).rows;assert.equal(rows.length,1);assert.equal(rows[0].status,'SUCCEEDED');
   const plan=(await workspace()).plans.find(p=>p.id===success.body.data.id);assert.notEqual(plan.status,'APPROVED');
  } finally {global.fetch=originalFetch;for(const [k,v]of Object.entries(before)){if(v===undefined)delete process.env[k];else process.env[k]=v;}}
 });
 await check('new manufacturing publication is data driven and does not rewrite old order or job revisions',async()=>{
  const old=(await workspace()).items.find(i=>i.id===itemIds[1]).bomRevisionId;
  const newBom=await publish({kind:'BOM',code:'FIXTURE_BOM',variantId:variant,body:{lines:[{componentRevisionId:component,quantity:2},{componentRevisionId:accessory,quantity:1}]}});
  assert.notEqual(newBom,old);assert.equal((await workspace()).items.find(i=>i.id===itemIds[1]).bomRevisionId,old);
  const newInput={...orderInput,items:[{...orderInput.items[0],productVariantId:variant,quantity:1}]};
  const r=await call('orders','POST',newInput);assert.equal(r.status,201);
  const pinned=(await pool.query('SELECT i.manufacturing_revision_id FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.order_number=$1',[r.body.data.orderNumber])).rows[0];assert.equal(pinned.manufacturing_revision_id,newBom);
 });
};

const assert=require('node:assert/strict');
module.exports=async function({check,call,pool,admin,workshop,operator,reviewer}) {
  const create=async email=>{
    const result=await call('register','POST',{email,fullName:'Role management fixture',password:'Role-fixture-password-2026'});
    assert.equal(result.status,201,JSON.stringify(result.body));return result;
  };
  const assign=(target,role,expectedRoles,actor=admin)=>call('teamAccounts','PATCH',{
    userId:target.body.data.id,role,expectedRoles,reason:'Role management fixture',
  },actor.cookie);
  const roles=async target=>(await pool.query(`SELECT r.code FROM user_roles ur JOIN roles r ON r.id=ur.role_id
    WHERE ur.user_id=$1 ORDER BY r.code`,[target.body.data.id])).rows.map(row=>row.code);
  let target;
  await check('retired STAFF assignments cannot grant order or Telegram permissions and cannot be assigned again',async()=>{
    const legacy=await create('retired-staff@example.test');
    await pool.query("INSERT INTO roles(code,name,is_active) VALUES('STAFF','Retired fixture',false) ON CONFLICT(code) DO NOTHING");
    await pool.query("INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='STAFF'",[legacy.body.data.id]);
    assert.equal((await call('session','GET',undefined,legacy.cookie)).body.data.role,'CUSTOMER');
    for(const route of ['admin','payments']) assert.equal((await call(route,'GET',undefined,legacy.cookie)).status,403);
    assert.equal((await assign(legacy,'STAFF',['CUSTOMER'])).status,400);
    assert.equal((await pool.query("SELECT is_active FROM roles WHERE code='STAFF'")).rows[0].is_active,false);
  });
  await check('only ADMIN can list or assign accounts, including direct requests and self-edit attempts',async()=>{
    target=await create('role-managed@example.test');
    assert.equal((await call('teamAccounts')).status,401);
    for(const actor of [target,workshop,operator,reviewer]){
      assert.equal((await call('teamAccounts','GET',undefined,actor.cookie)).status,403);
      assert.equal((await assign(target,'ADMIN',['CUSTOMER'],actor)).status,403);
    }
    assert.equal((await assign(admin,'CUSTOMER',['ADMIN'])).status,403);
    const invalid=await call('teamAccounts','PATCH',{userId:target.body.data.id,role:'SUPERUSER',expectedRoles:['CUSTOMER'],reason:'Invalid fixture'},admin.cookie);
    assert.equal(invalid.status,400);
  });
  await check('account search is paginated, literal and never returns authentication records',async()=>{
    const response=await call('teamAccounts','GET',undefined,admin.cookie,'http://localhost:3100/api/admin/team/accounts?q=role-managed%40example.test&pageSize=1');
    assert.equal(response.status,200,JSON.stringify(response.body));
    assert.equal(response.body.data.pagination.total,1);
    assert.equal(response.body.data.data[0].id,target.body.data.id);
    const serialized=JSON.stringify(response.body.data);
    for(const field of ['password_hash','passwordHash','refresh_token_hash','token_hash'])assert(!serialized.includes(field));
    const injection=await call('teamAccounts','GET',undefined,admin.cookie,"http://localhost:3100/api/admin/team/accounts?q=%27%20OR%201%3D1--");
    assert.equal(injection.status,200);assert.equal(injection.body.data.data.length,0);
  });
  await check('role changes replace personnel permissions, apply to existing sessions and replay without extra audits',async()=>{
    let expected=['CUSTOMER'];
    for(const role of ['WORKSHOP_OPERATOR','FILE_REVIEWER','PRINT_OPERATOR','ADMIN','CUSTOMER']){
      const result=await assign(target,role,expected);assert.equal(result.status,200,JSON.stringify(result.body));
      const before=Number((await pool.query("SELECT count(*) FROM audit_logs WHERE action='ACCOUNT_ROLE_CHANGED' AND entity_id=$1",[target.body.data.id])).rows[0].count);
      const replay=await assign(target,role,expected);assert.equal(replay.status,200);assert.equal(replay.body.data.unchanged,true);
      assert.equal(Number((await pool.query("SELECT count(*) FROM audit_logs WHERE action='ACCOUNT_ROLE_CHANGED' AND entity_id=$1",[target.body.data.id])).rows[0].count),before);
      assert.equal((await call('session','GET',undefined,target.cookie)).body.data.role,role);
      expected=role==='CUSTOMER'?['CUSTOMER']:['CUSTOMER',role].sort();
      assert.deepEqual(await roles(target),expected);
    }
    const audit=(await pool.query("SELECT actor_user_id,old_values,new_values FROM audit_logs WHERE action='ACCOUNT_ROLE_CHANGED' AND entity_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1",[target.body.data.id])).rows[0];
    assert.equal(audit.actor_user_id,admin.body.data.id);assert.equal(audit.new_values.reason,'Role management fixture');assert.deepEqual(audit.new_values.roles,['CUSTOMER']);assert(audit.old_values.roles.includes('ADMIN'));
  });
  await check('stale role edits conflict and locked accounts can be stripped of privileges',async()=>{
    assert.equal((await assign(target,'WORKSHOP_OPERATOR',['CUSTOMER'])).status,200);
    assert.equal((await assign(target,'ADMIN',['CUSTOMER'])).status,409);
    await pool.query("UPDATE users SET status='LOCKED' WHERE id=$1",[target.body.data.id]);
    assert.equal((await assign(target,'ADMIN',['CUSTOMER','WORKSHOP_OPERATOR'])).status,409);
    assert.equal((await assign(target,'CUSTOMER',['CUSTOMER','WORKSHOP_OPERATOR'])).status,200);
    assert.deepEqual(await roles(target),['CUSTOMER']);
    await pool.query("UPDATE users SET status='ACTIVE' WHERE id=$1",[target.body.data.id]);
  });
  await check('role replacement rolls back when its audit cannot be written',async()=>{
    await pool.query(`CREATE FUNCTION fixture_reject_account_role_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture audit failure'; END $$;
      CREATE TRIGGER fixture_reject_account_role_audit BEFORE INSERT ON audit_logs FOR EACH ROW WHEN(NEW.action='ACCOUNT_ROLE_CHANGED') EXECUTE FUNCTION fixture_reject_account_role_audit();`);
    try{assert.equal((await assign(target,'WORKSHOP_OPERATOR',['CUSTOMER'])).status,500);assert.deepEqual(await roles(target),['CUSTOMER']);}
    finally{await pool.query('DROP TRIGGER fixture_reject_account_role_audit ON audit_logs; DROP FUNCTION fixture_reject_account_role_audit();');}
  });
  await check('concurrent administrators cannot use a stale session to remove one another',async()=>{
    const first=await create('role-admin-first@example.test'),second=await create('role-admin-second@example.test');
    for(const actor of [first,second])assert.equal((await assign(actor,'ADMIN',['CUSTOMER'])).status,200);
    const results=await Promise.all([
      assign(second,'CUSTOMER',['ADMIN','CUSTOMER'],first),assign(first,'CUSTOMER',['ADMIN','CUSTOMER'],second),
    ]);
    assert.deepEqual(results.map(r=>r.status).sort(),[200,403]);
    for(const actor of [first,second]){
      const current=await roles(actor);
      if(current.includes('ADMIN'))assert.equal((await assign(actor,'CUSTOMER',current)).status,200);
    }
    assert.equal((await call('session','GET',undefined,admin.cookie)).body.data.role,'ADMIN');
  });
};

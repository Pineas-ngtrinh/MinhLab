const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {createHash}=require('node:crypto');const {spawnSync}=require('node:child_process');const {Pool}=require('pg');
module.exports=async function({check,control,databaseName,root}) {
 await check('upgrade from schema 008 preserves existing orders and adds no invented manufacturing approvals',async()=>{
  const name=`${databaseName}_upgrade`;const url=new URL(process.env.MIGRATION_DATABASE_URL);url.pathname=`/${name}`;let pool;
  await control.query(`CREATE DATABASE "${name}"`);
  try {
   pool=new Pool({connectionString:url.toString()});
   await pool.query('CREATE TABLE schema_migrations(filename text PRIMARY KEY,checksum char(64) NOT NULL,applied_at timestamptz NOT NULL DEFAULT now())');
   const files=fs.readdirSync(path.join(root,'database/migrations')).filter(f=>/^00[1-8]_.*\.sql$/.test(f)).sort();assert.equal(files.length,8);
   for(const filename of files){const sql=fs.readFileSync(path.join(root,'database/migrations',filename),'utf8');await pool.query('BEGIN');try{await pool.query(sql);await pool.query('INSERT INTO schema_migrations(filename,checksum) VALUES($1,$2)',[filename,createHash('sha256').update(sql).digest('hex')]);await pool.query('COMMIT');}catch(e){await pool.query('ROLLBACK');throw e;}}
   const env={...process.env,DATABASE_URL:url.toString(),MIGRATION_DATABASE_URL:url.toString()};
   const seed=spawnSync(process.execPath,['scripts/database/db-seed-catalog.cjs'],{cwd:root,env,encoding:'utf8'});assert.equal(seed.status,0,seed.stderr);
   const variant=(await pool.query('SELECT id FROM product_variants ORDER BY id LIMIT 1')).rows[0].id;
   const order=(await pool.query(`INSERT INTO orders(order_number,customer_name_snapshot,customer_email_snapshot,customer_phone_snapshot,shipping_recipient_name,shipping_recipient_phone,shipping_address_line,shipping_province_name,subtotal,grand_total,required_deposit_amount)
    VALUES('UPGRADE-FIXTURE','Synthetic legacy','legacy@example.test','0901234567','Synthetic legacy','0901234567','Fixture address','Fixture province',1000,1000,1000) RETURNING id`)).rows[0];
   await pool.query("INSERT INTO order_items(order_id,product_variant_id,item_type,item_name_snapshot,quantity,unit_price,line_total) VALUES($1,$2,'READY_PRODUCT','Legacy immutable snapshot',1,1000,1000)",[order.id,variant]);
   const before=(await pool.query('SELECT id,order_number,order_status,grand_total FROM orders WHERE id=$1',[order.id])).rows[0];
   await pool.query("INSERT INTO roles(code,name) VALUES('STAFF','Legacy order staff') ON CONFLICT(code) DO NOTHING");
   const legacy=(await pool.query("INSERT INTO users(email,email_normalized,password_hash,full_name,status) VALUES('legacy-staff@example.test','legacy-staff@example.test','fixture-only','Legacy staff','ACTIVE') RETURNING id")).rows[0];
   await pool.query("INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='STAFF'",[legacy.id]);
   for(let i=0;i<2;i++){const migrated=spawnSync(process.execPath,['scripts/database/db-migrate.cjs'],{cwd:root,env,encoding:'utf8'});assert.equal(migrated.status,0,migrated.stderr);}
   assert.deepEqual((await pool.query('SELECT id,order_number,order_status,grand_total FROM orders WHERE id=$1',[order.id])).rows[0],before);
   const grants=(await pool.query('SELECT r.code,r.is_active FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1 ORDER BY r.code',[legacy.id])).rows;
   assert.deepEqual(grants,[{code:'CUSTOMER',is_active:true},{code:'STAFF',is_active:false}]);
   const item=(await pool.query('SELECT manufacturing_revision_id,item_name_snapshot,quantity,unit_price FROM order_items WHERE order_id=$1',[order.id])).rows[0];assert.equal(item.manufacturing_revision_id,null);assert.equal(item.item_name_snapshot,'Legacy immutable snapshot');assert.equal(Number(item.unit_price),1000);
   assert.equal(Number((await pool.query('SELECT count(*) FROM manufacturing_revisions')).rows[0].count),0);assert.equal(Number((await pool.query('SELECT count(*) FROM production_jobs')).rows[0].count),0);
   assert.equal(Number((await pool.query('SELECT count(*) FROM schema_migrations')).rows[0].count),fs.readdirSync(path.join(root,'database/migrations')).filter(f=>f.endsWith('.sql')).length);
  }finally{if(pool)await pool.end();await control.query(`DROP DATABASE "${name}" WITH(FORCE)`);}
 });
};

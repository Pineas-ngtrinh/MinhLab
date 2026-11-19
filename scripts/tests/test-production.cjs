const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { Pool } = require('pg');
const root = path.resolve(__dirname, '../..');
if (process.env.MINHLAB_ENV_FROM_PROCESS !== 'true') require('@next/env').loadEnvConfig(root);
const { resolveProductionTestTarget } = require('../lib/production-test-target.cjs');

async function main() {
  const { sourceUrl, appUrl } = resolveProductionTestTarget(process.env);
  let runtimePrivilegesTested = false;
  const databaseName = `minhlab_audit_test_${Date.now()}`;
  sourceUrl.pathname = '/postgres';
  const control = new Pool({ connectionString: sourceUrl.toString() });
  let created = false;
  let pool;
  const results = [];
  async function check(name, action) {
    const started = Date.now();
    try { await action(); results.push({ name, passed: true, durationMs: Date.now()-started }); process.stdout.write(`PASS ${name}\n`); }
    catch (error) { results.push({ name, passed: false, error: error.message }); throw error; }
  }
  try {
    await control.query(`CREATE DATABASE "${databaseName}"`); created = true;
    sourceUrl.pathname = `/${databaseName}`;
    appUrl.pathname = `/${databaseName}`;
    process.env.DATABASE_URL = appUrl.toString();
    process.env.MIGRATION_DATABASE_URL = sourceUrl.toString();
    process.env.NODE_ENV = 'production';
    process.env.MINHLAB_MANUAL_VIETQR_ENABLED='true';
    process.env.MINHLAB_VIETQR_BANK_BIN='970422';process.env.MINHLAB_VIETQR_BANK_NAME='Fixture bank';
    process.env.MINHLAB_VIETQR_ACCOUNT_NUMBER='0000000000';process.env.MINHLAB_VIETQR_ACCOUNT_NAME='ISOLATED TEST ONLY';
    process.env.MINHLAB_ADMIN_EMAIL = '';
    process.env.MINHLAB_ADMIN_PASSWORD = '';
    process.env.RESEND_API_KEY = '';
    process.env.MINHLAB_REQUIRE_EMAIL_VERIFICATION = 'false';
    process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3100';
    for (const script of ['scripts/database/db-migrate.cjs','scripts/database/db-seed-catalog.cjs']) {
      const result = spawnSync(process.execPath,[script],{cwd:root,env:process.env,encoding:'utf8'});
      assert.equal(result.status,0,result.stderr);
    }
    pool = new Pool({ connectionString: sourceUrl.toString() });
    await check('migrations are idempotent and tracked by checksum',async()=>{
      const replay=spawnSync(process.execPath,['scripts/database/db-migrate.cjs'],{cwd:root,env:process.env,encoding:'utf8'});
      assert.equal(replay.status,0,replay.stderr);assert.equal(Number((await pool.query('SELECT count(*) FROM schema_migrations')).rows[0].count),fs.readdirSync(path.join(root,'database/migrations')).filter(file=>file.endsWith('.sql')).length);
    });
    await require('../lib/test-migration-upgrade.cjs')({check,control,databaseName,root});
    await check('Telegram worker recovers expired leases without a sixth delivery attempt',async()=>{
      const recovery=spawnSync(process.execPath,['--test','scripts/tests/test-telegram-deliver.test.cjs'],{
        cwd:root,env:{...process.env,MINHLAB_TEST_DATABASE_URL:sourceUrl.toString()},encoding:'utf8',
      });
      assert.equal(recovery.status,0,`${recovery.stdout}\n${recovery.stderr}`);
    });
    if(appUrl.username === 'minhlab_app') {
      // Exercise the same privilege policy used by db:grant-runtime during deployment.
      await require('../lib/grant-runtime.cjs').grantRuntimePrivileges(pool);
      runtimePrivilegesTested=true;
      await check('runtime DB role has narrow attachment pointer permission and cannot delete orders',async()=>{
        const privileges=(await pool.query("SELECT r.rolsuper,has_table_privilege('minhlab_app','orders','DELETE') AS can_delete,has_table_privilege('minhlab_app','attachments','UPDATE') AS can_update_attachments,has_column_privilege('minhlab_app','attachments','is_current','UPDATE') AS can_update_current FROM pg_roles r WHERE r.rolname='minhlab_app'")).rows[0];assert.equal(privileges.rolsuper,false);assert.equal(privileges.can_delete,false);assert.equal(privileges.can_update_attachments,false);assert.equal(privileges.can_update_current,true);
      });
    }
    await check('runtime role can create, confirm and remove Telegram linking challenges using deployment grants',async()=>{
      const rights=(await pool.query(`SELECT
        has_table_privilege('minhlab_app','telegram_link_requests','SELECT') AS can_read,
        has_table_privilege('minhlab_app','telegram_link_requests','INSERT') AS can_insert,
        has_table_privilege('minhlab_app','telegram_link_requests','UPDATE') AS can_update,
        has_table_privilege('minhlab_app','telegram_link_requests','DELETE') AS can_delete`)).rows[0];
      assert.deepEqual(rights,{can_read:true,can_insert:true,can_update:true,can_delete:true});
    });
    require('../lib/register-typescript.cjs');
    const { NextRequest } = require('next/server');
    const routes = {
      catalog: require('../../app/api/catalog/route.ts'),
      workshop: require('../../app/api/workshop/orders/route.ts'),
      production: require('../../app/api/workshop/production/route.ts'),
      printRequests: require('../../app/api/print-requests/route.ts'),
      paymentOptions: require('../../app/api/payments/options/route.ts'),
      products: require('../../app/api/admin/products/route.ts'), product: require('../../app/api/admin/products/[id]/route.ts'),
      catalogCategories: require('../../app/api/admin/catalog/categories/route.ts'),
      team: require('../../app/api/admin/team/workshop-operators/route.ts'),
      teamAccounts: require('../../app/api/admin/team/accounts/route.ts'),
      overview: require('../../app/api/admin/overview/route.ts'),
      returnRequest: require('../../app/api/orders/[orderNumber]/return-request/route.ts'),
      returnAction: require('../../app/api/admin/orders/[orderNumber]/return-request/route.ts'),
      register: require('../../app/api/auth/register/route.ts'), login: require('../../app/api/auth/login/route.ts'),
      logout: require('../../app/api/auth/logout/route.ts'), session: require('../../app/api/auth/session/route.ts'),
      orders: require('../../app/api/orders/route.ts'), detail: require('../../app/api/orders/[orderNumber]/route.ts'),
      customer: require('../../app/api/customer/orders/route.ts'), admin: require('../../app/api/admin/orders/route.ts'), payments: require('../../app/api/admin/payments/route.ts'),
      verify: require('../../app/api/admin/payments/verify/route.ts'), reject: require('../../app/api/admin/payments/reject/route.ts'),
      verifyEmail: require('../../app/api/auth/verify-email/route.ts'),
      verificationRequest: require('../../app/api/auth/verification/route.ts'),
      resetRequest: require('../../app/api/auth/password-reset/route.ts'), resetConfirm: require('../../app/api/auth/password-reset/confirm/route.ts'),
      declare: require('../../app/api/payments/declare/route.ts'),
      paymentProofUpload: require('../../app/api/orders/[orderNumber]/payment-proof/route.ts'),
      paymentProofDownload: require('../../app/api/admin/payments/[paymentId]/proof/[assetId]/route.ts'),
    };
    async function call(route, method='GET', body, cookie='', url='http://localhost:3100/api/test', params, headers={}) {
      const request = new NextRequest(url, { method, headers:{ 'Content-Type':'application/json',Cookie:cookie,...headers }, ...(body===undefined?{}:{body:JSON.stringify(body)}) });
      const response = await routes[route][method](request, params && {params});
      return { status:response.status, body:await response.json(), cookie:response.headers.get('set-cookie')?.split(';')[0] };
    }
    const account = (email) => ({ email, fullName:'Tài khoản kiểm thử cô lập', password:'Isolated-test-password-2026' });
    let owner, other, admin, operator, workshop, reviewer;
    await check('admin bootstrap cannot promote a pre-existing customer identity',async()=>{
      await pool.query("INSERT INTO users(email,email_normalized,password_hash,full_name,status) VALUES ('claimed@example.test','claimed@example.test','not-a-real-hash','Fixture identity','ACTIVE')");
      process.env.MINHLAB_ADMIN_EMAIL='claimed@example.test';process.env.MINHLAB_ADMIN_PASSWORD='Configured-admin-password-2026';
      try {
        assert.equal((await call('register','POST',account('bootstrap-probe@example.test'))).status,500);
        const roles=await pool.query("SELECT r.code FROM user_roles ur JOIN users u ON u.id=ur.user_id JOIN roles r ON r.id=ur.role_id WHERE u.email_normalized='claimed@example.test'");
        assert.equal(roles.rowCount,0);
      } finally {process.env.MINHLAB_ADMIN_EMAIL='';process.env.MINHLAB_ADMIN_PASSWORD='';}
    });
    await check('register defaults to CUSTOMER and stores a password hash', async()=>{
      owner=await call('register','POST',account('owner@example.test'));
      assert.equal(owner.status,201);assert.equal(owner.body.data.role,'CUSTOMER');
      const row=(await pool.query('SELECT password_hash FROM users WHERE id=$1',[owner.body.data.id])).rows[0];
      assert.match(row.password_hash,/^scrypt\$/);assert.notEqual(row.password_hash,account('').password);
    });
    await check('registration validates email, password length and duplicate identities',async()=>{
      assert.equal((await call('register','POST',{...account('wrong-email'),password:'short'})).status,400);
      assert.equal((await call('register','POST',account('owner@example.test'))).status,400);
    });
    other=await call('register','POST',account('other@example.test'));
    admin=await call('register','POST',account('admin@example.test'));
    operator=await call('register','POST',account('operator@example.test'));
    workshop=await call('register','POST',account('workshop@example.test'));
    reviewer=await call('register','POST',account('reviewer@example.test'));
    async function assign(id,role){await pool.query('UPDATE user_roles SET role_id=(SELECT id FROM roles WHERE code=$2) WHERE user_id=$1',[id,role]);}
    await assign(admin.body.data.id,'ADMIN');await assign(operator.body.data.id,'PRINT_OPERATOR');
    await assign(workshop.body.data.id,'WORKSHOP_OPERATOR');await assign(reviewer.body.data.id,'FILE_REVIEWER');
    await check('active sessions use database roles, not a role embedded in the cookie',async()=>{
      assert.equal((await call('session','GET',undefined,admin.cookie)).body.data.role,'ADMIN');
      assert.equal((await call('admin','GET',undefined,owner.cookie)).status,403);
      assert.equal((await call('admin')).status,401);
    });
    await check('login and session use the same highest-priority role for multi-role accounts',async()=>{
      await pool.query("INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='CUSTOMER'",[admin.body.data.id]);
      const login=await call('login','POST',account('admin@example.test'));
      assert.equal(login.body.data.role,'ADMIN');
      assert.equal((await call('session','GET',undefined,login.cookie)).body.data.role,'ADMIN');
      await pool.query("DELETE FROM user_roles WHERE user_id=$1 AND role_id=(SELECT id FROM roles WHERE code='CUSTOMER')",[admin.body.data.id]);
    });
    await check('a deleted or disabled account immediately loses session access',async()=>{
      await pool.query("UPDATE users SET status='LOCKED' WHERE id=$1",[other.body.data.id]);
      assert.equal((await call('session','GET',undefined,other.cookie)).body.data,null);
      await pool.query("UPDATE users SET status='ACTIVE',deleted_at=now() WHERE id=$1",[other.body.data.id]);
      assert.equal((await call('session','GET',undefined,other.cookie)).body.data,null);
      await pool.query('UPDATE users SET deleted_at=NULL WHERE id=$1',[other.body.data.id]);
    });
    await check('ADMIN grants and revokes workshop access using the restricted runtime role',async()=>{
      const input={email:'other@example.test'};
      assert.equal((await call('team','POST',input,workshop.cookie)).status,403);
      const granted=await call('team','POST',input,admin.cookie);
      assert.equal(granted.status,200,JSON.stringify(granted.body));
      assert.equal((await call('session','GET',undefined,other.cookie)).body.data.role,'WORKSHOP_OPERATOR');
      const removed=await call('team','DELETE',input,admin.cookie);
      assert.equal(removed.status,200,JSON.stringify(removed.body));
      assert.equal((await call('session','GET',undefined,other.cookie)).body.data.role,'CUSTOMER');
    });
    await require('../lib/test-team-roles.cjs')({check,call,pool,admin,workshop,operator,reviewer});
    await check('production catalogue hides draft and unapproved content',async()=>{
      const catalog=await call('catalog');assert.equal(catalog.status,200);
      assert.deepEqual(catalog.body.data.products,[]);
      assert.deepEqual(catalog.body.data.categories,[]);
    });
    await check('display backfill preserves database descriptions, prices, identities and approval',async()=>{
      const legacy=(await pool.query('SELECT id FROM products ORDER BY id LIMIT 1')).rows[0];
      await pool.query('DELETE FROM product_images WHERE product_id=$1',[legacy.id]);
      await pool.query("UPDATE products SET description='Database maintained description',material_description=NULL WHERE id=$1",[legacy.id]);
      const before=(await pool.query('SELECT id,name,description,publication_status,compliance_status FROM products ORDER BY id')).rows;
      const prices=(await pool.query('SELECT id,sale_price FROM product_variants ORDER BY id')).rows;
      const replay=spawnSync(process.execPath,['scripts/database/db-seed-catalog.cjs','--backfill-display'],{cwd:root,env:process.env,encoding:'utf8'});
      assert.equal(replay.status,0,replay.stderr);
      assert.deepEqual((await pool.query('SELECT id,name,description,publication_status,compliance_status FROM products ORDER BY id')).rows,before);
      assert.deepEqual((await pool.query('SELECT id,sale_price FROM product_variants ORDER BY id')).rows,prices);
      assert((await pool.query('SELECT 1 FROM product_images WHERE product_id=$1',[legacy.id])).rowCount>0);
    });
    const product=(await pool.query('SELECT p.slug,v.sale_price FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.status=$1 ORDER BY v.created_at LIMIT 1',['ACTIVE'])).rows[0];
    const orderInput={customerName:'Người thử cô lập',customerEmail:'owner@example.test',customerPhone:'0901234567',shippingAddress:'Địa chỉ kiểm thử',paymentMethod:'VIETQR',items:[{productId:product.slug,itemType:'READY_PRODUCT',itemName:'Untrusted title',quantity:1,unitPrice:1}]};
    await check('unpublished/unapproved products cannot be purchased in production',async()=>assert.equal((await call('orders','POST',orderInput)).status,400));
    await pool.query("UPDATE products SET compliance_status='APPROVED',publication_status='PUBLISHED'");
    await check('order input rejects malformed types, negative quantities and unapproved custom prints',async()=>{
      assert.equal((await call('orders','POST',{...orderInput,customerNote:'x'.repeat(70000)})).status,400);
      assert.equal((await call('orders','POST',{customerName:4})).status,400);
      assert.equal((await call('orders','POST',{...orderInput,items:[{...orderInput.items[0],quantity:-1}]})).status,400);
      assert.equal((await call('orders','POST',{...orderInput,items:[{...orderInput.items[0],printSpecificationId:randomUUID()}]})).status,400);
      assert.equal((await call('orders','POST',{...orderInput,items:[{...orderInput.items[0],itemType:'CUSTOM_PRINT'}]})).status,400);
    });
    await check('catalogue reads database edits and new products without a build or config change',async()=>{
      const initial=await call('catalog');assert.equal(initial.status,200);
      assert.equal(initial.body.data.products.length,require('../../database/seeds/catalog.json').products.length);
      const before=initial.body.data.products.find(p=>p.id===product.slug);
      assert.equal(before.price,Number(product.sale_price));assert(before.gallery.length>0);
      await pool.query("UPDATE products SET short_description='Description edited in DB' WHERE slug=$1",[product.slug]);
      assert.equal((await call('catalog')).body.data.products.find(p=>p.id===product.slug).description,'Description edited in DB');
      const inserted=(await pool.query(`INSERT INTO products(category_id,product_code,name,slug,short_description,
        product_source_type,production_mode,compliance_status,publication_status)
        SELECT category_id,'TEST-NEW','New database product','test-new-database-product','New description',
        product_source_type,production_mode,'APPROVED','PUBLISHED' FROM products WHERE slug=$1 RETURNING id`,[product.slug])).rows[0];
      await pool.query("INSERT INTO product_variants(product_id,sku,variant_name,color_name,sale_price,status) VALUES ($1,'TEST-NEW-001','Xám','Xám',99000,'ACTIVE')",[inserted.id]);
      const added=(await call('catalog')).body.data.products.find(p=>p.id==='test-new-database-product');
      assert.equal(added.title,'New database product');assert.equal(added.price,99000);
      assert.equal(added.image,'/images/product-placeholder.svg');
      await pool.query("UPDATE products SET publication_status='HIDDEN' WHERE id=$1",[inserted.id]);
      assert.equal((await call('catalog')).body.data.products.some(p=>p.id===added.id),false);
      assert.equal((await call('orders','POST',{...orderInput,items:[{...orderInput.items[0],productId:added.id}]})).status,400);
    });
    await check('explicit SKU selection uses its database price and rejects SKUs from another product',async()=>{
      const catalog=(await call('catalog')).body.data.products;
      const source=catalog.find(p=>p.id===product.slug);
      const added=(await pool.query(`INSERT INTO product_variants(product_id,sku,variant_name,color_name,sale_price,status)
        SELECT id,'TEST-VARIANT-EXTRA','Màu thử','Màu thử',81000,'ACTIVE' FROM products WHERE slug=$1 RETURNING id`,[product.slug])).rows[0];
      const body={...orderInput,items:[{...orderInput.items[0],productVariantId:added.id,color:'Forged colour',material:'Forged material'}]};
      const result=await call('orders','POST',body);assert.equal(result.status,201,JSON.stringify(result.body));
      assert.equal(result.body.data.grandTotal,111000);
      const snapshot=(await pool.query(`SELECT i.product_variant_id,i.unit_price,i.color_snapshot,i.material_snapshot
        FROM order_items i JOIN orders o ON o.id=i.order_id WHERE o.order_number=$1`,[result.body.data.orderNumber])).rows[0];
      assert.equal(snapshot.product_variant_id,added.id);assert.equal(Number(snapshot.unit_price),81000);
      assert.equal(snapshot.color_snapshot,'Màu thử');assert.equal(snapshot.material_snapshot,source.material);
      const otherProduct=catalog.find(p=>p.id!==product.slug);
      assert.equal((await call('orders','POST',{...body,items:[{...body.items[0],productVariantId:otherProduct.variants[0].id}]})).status,400);
      assert.equal((await call('orders','POST',{...body,items:[{...body.items[0],productVariantId:'invalid'}]})).status,400);
      await pool.query("UPDATE product_variants SET status='OUT_OF_STOCK' WHERE id=$1",[added.id]);
      assert.equal((await call('orders','POST',body)).status,400);
      const changed=(await call('catalog')).body.data.products.find(p=>p.id===product.slug);
      assert.equal(changed.variants.find(v=>v.id===added.id).available,false);
    });
    await require('../lib/test-catalogue-management.cjs')({check,call,pool,admin,owner,operator,workshop,reviewer});
    let qr;
    await check('server recalculates price and associates an order with the authenticated ID',async()=>{
      qr=await call('orders','POST',orderInput,owner.cookie);assert.equal(qr.status,201);
      assert.equal(Number(qr.body.data.grandTotal),Number(product.sale_price)+(Number(product.sale_price)>=500000?0:30000));
      const row=(await pool.query('SELECT customer_id FROM orders WHERE order_number=$1',[qr.body.data.orderNumber])).rows[0];
      assert.equal(row.customer_id,owner.body.data.id);
      assert.equal(Number((await pool.query("SELECT count(*) FROM telegram_outbox WHERE order_number=$1 AND notification_type='STORE_ORDER_CREATED'",[qr.body.data.orderNumber])).rows[0].count),1);
    });
    await check('checkout only accepts personal VietQR and requires its receiving configuration',async()=>{
      process.env.MINHLAB_MANUAL_VIETQR_ENABLED='false';
      try {
        assert.equal((await call('paymentOptions')).body.data.vietQr,false);
        assert.equal((await call('orders','POST',orderInput)).status,503);
        assert.equal((await call('orders','POST',{...orderInput,paymentMethod:'COD'})).status,400);
      } finally {process.env.MINHLAB_MANUAL_VIETQR_ENABLED='true';}
    });
    await require('../lib/test-payment-proof-postgres.cjs')({check,call,routes,pool,owner,admin,orderInput});
    await check('payment destination is snapshotted and is not silently changed by configuration rotation',async()=>{
      assert.equal(qr.body.data.payment.receivingBank.accountNumber,'0000000000');
      process.env.MINHLAB_VIETQR_ACCOUNT_NUMBER='0000000001';
      try {
        const previous=await call('detail','GET',undefined,owner.cookie,`http://localhost:3100/api/orders/${qr.body.data.orderNumber}`,{orderNumber:qr.body.data.orderNumber});
        assert.equal(previous.body.data.payment.receivingBank.accountNumber,'0000000000');
        const next=await call('orders','POST',{...orderInput,receivingBank:{accountNumber:'FORGED'}});
        assert.equal(next.body.data.payment.receivingBank.accountNumber,'0000000001');
      } finally {process.env.MINHLAB_VIETQR_ACCOUNT_NUMBER='0000000000';}
    });
    let guest;
    await check('typing another account email does not claim or expose guest orders',async()=>{
      const ownBefore=(await call('customer','GET',undefined,owner.cookie)).body.pagination.total;
      guest=await call('orders','POST',orderInput);assert.equal(guest.status,201);
      const row=(await pool.query('SELECT customer_id FROM orders WHERE order_number=$1',[guest.body.data.orderNumber])).rows[0];assert.equal(row.customer_id,null);
      const list=await call('customer','GET',undefined,owner.cookie);assert.equal(list.body.pagination.total,ownBefore);assert(!list.body.data.some((item)=>item.orderNumber===guest.body.data.orderNumber));
    });
    await check('customer history uses bounded owner-only pages and full-history summary counts',async()=>{
      const before=(await call('customer','GET',undefined,owner.cookie)).body.pagination.total;
      for(let index=0;index<27;index++) assert.equal((await call('orders','POST',orderInput,owner.cookie)).status,201);
      const list=await call('customer','GET',undefined,owner.cookie,'http://localhost:3100/api/customer/orders?pageSize=10');
      assert.equal(list.status,200);assert.equal(list.body.data.length,10);assert.equal(list.body.pagination.total,before+27);
      assert.equal(list.body.summary.total,before+27);assert(list.body.summary.pendingPayment>=27);
      const next=await call('customer','GET',undefined,owner.cookie,'http://localhost:3100/api/customer/orders?pageSize=10&page=2');
      const firstNumbers=new Set(list.body.data.map(item=>item.orderNumber));
      assert(next.body.data.every(item=>!firstNumbers.has(item.orderNumber)));
      const otherAccount=await call('register','POST',account('page-owner-other@example.test'));
      const otherList=await call('customer','GET',undefined,otherAccount.cookie,`http://localhost:3100/api/customer/orders?customerId=${owner.body.data.id}`);
      assert.deepEqual(otherList.body.data,[]);assert.equal(otherList.body.summary.total,0);
      assert.equal((await call('customer','GET',undefined,owner.cookie,'http://localhost:3100/api/customer/orders?pageSize=101')).status,400);
      assert.equal((await call('customer','GET',undefined,admin.cookie)).status,403);
    });
    await check('checkout uses the shared shipping boundary and rejects numeric overflow before persistence',async()=>{
      const before=(await pool.query('SELECT id,sale_price,compare_at_price FROM product_variants WHERE product_id=(SELECT id FROM products WHERE slug=$1) ORDER BY created_at,id LIMIT 1',[product.slug])).rows[0];
      try {
        for(const [price,total] of [[499999,529999],[500000,500000]]) {
          await pool.query('UPDATE product_variants SET sale_price=$2,compare_at_price=NULL WHERE id=$1',[before.id,price]);
          const result=await call('orders','POST',orderInput);assert.equal(result.status,201);assert.equal(result.body.data.grandTotal,total);
        }
        await pool.query('UPDATE product_variants SET sale_price=9999999999,compare_at_price=NULL WHERE id=$1',[before.id]);
        const count=(await pool.query('SELECT count(*)::int AS total FROM orders')).rows[0].total;
        const huge={...orderInput,items:[{...orderInput.items[0],quantity:100},{...orderInput.items[0],quantity:100}]};
        assert.equal((await call('orders','POST',huge)).status,400);
        assert.equal((await pool.query('SELECT count(*)::int AS total FROM orders')).rows[0].total,count);
      } finally {await pool.query('UPDATE product_variants SET sale_price=$2,compare_at_price=$3 WHERE id=$1',[before.id,before.sale_price,before.compare_at_price]);}
    });
    const number=qr.body.data.orderNumber;
    const detail=(cookie='',token='')=>call('detail','GET',undefined,cookie,`http://localhost:3100/api/orders/${number}${token?`?token=${token}`:''}`,{orderNumber:number});
    await check('order tracking requires the owner or an unexpired secret token',async()=>{
      assert.equal((await detail()).status,404);assert.equal((await detail(other.cookie)).status,404);
      assert.equal((await detail('', 'wrong-token')).status,404);assert.equal((await detail(owner.cookie)).status,200);
      assert.equal((await detail('',qr.body.data.trackingToken)).status,200);
    });
    const declaration={orderNumber:number,transactionReference:'TEST-ISOLATED-ONLY',bankName:'Test bank',senderAccountName:'Test owner'};
    await check('a guessed order number cannot be used to mutate payment details',async()=>{
      assert.equal((await call('declare','POST',declaration,other.cookie)).status,400);
      assert.equal((await call('declare','POST',{...declaration,trackingToken:'wrong'})).status,400);
      assert.equal((await call('declare','POST',{...declaration,trackingToken:qr.body.data.trackingToken})).status,200);
      const alert=(await pool.query("SELECT body_text FROM telegram_outbox WHERE order_number=$1 AND notification_type='STORE_PAYMENT_DECLARED'",[number])).rows[0];
      assert.match(alert.body_text,/Chưa xác nhận tiền đã vào/);
      assert.match(alert.body_text,/Đối soát ngân hàng trước khi bấm xác nhận/);
      assert(alert.body_text.includes(orderInput.customerName));
      assert(alert.body_text.includes(orderInput.customerEmail));
      assert(alert.body_text.includes(orderInput.customerPhone));
      assert(alert.body_text.includes(orderInput.shippingAddress));
      assert.doesNotMatch(alert.body_text,/TEST-ISOLATED-ONLY|Test bank|Test owner/);
      const pending=(await pool.query(`SELECT o.order_status,o.payment_status,p.verification_status
        FROM orders o JOIN payments p ON p.order_id=o.id WHERE o.order_number=$1`,[number])).rows[0];
      assert.equal(pending.order_status,'PENDING_PAYMENT');
      assert.equal(pending.payment_status,'UNPAID');
      assert.equal(pending.verification_status,'PENDING');
    });
    await check('payment declaration rejects public receipt URLs with the private-proof response',async()=>{
      for(const url of ['http://127.0.0.1/private','not-a-url','https://res.cloudinary.com:444/proof.jpg','https://res.cloudinary.com/fixture/%ZZ.jpg']) assert.equal((await call('declare','POST',{...declaration,paymentProofUrl:url},owner.cookie)).status,409);
    });
    await check('concurrent workshop verification commits once and queues one confirmation',async()=>{
      const responses=await Promise.all([call('verify','POST',{orderNumber:number},admin.cookie),call('verify','POST',{orderNumber:number},admin.cookie)]);
      assert(responses.every(r=>r.status===200));assert.equal(responses.filter(r=>r.body.data.alreadyVerified).length,1);
      assert.equal(Number((await pool.query("SELECT count(*) FROM email_outbox WHERE order_number=$1 AND notification_type='CUSTOMER_PAYMENT_VERIFIED'",[number])).rows[0].count),1);
      assert.equal(Number((await pool.query("SELECT count(*) FROM telegram_outbox WHERE order_number=$1 AND notification_type='STORE_PAYMENT_VERIFIED'",[number])).rows[0].count),0);
    });
    await check('verified payments cannot be downgraded by declaration or rejection',async()=>{
      assert.equal((await call('declare','POST',declaration,owner.cookie)).status,400);
      assert.equal((await call('reject','POST',{orderNumber:number},admin.cookie)).status,400);
      const row=(await pool.query('SELECT payment_status FROM orders WHERE order_number=$1',[number])).rows[0];assert.equal(row.payment_status,'PAID');
    });
    await check('paid orders cannot be cancelled without a refund workflow',async()=>assert.notEqual((await call('admin','PATCH',{orderNumber:number,newStatus:'CANCELLED'},admin.cookie)).status,200));
    await check('cancelled orders cannot be confirmed as paid',async()=>{
      const n=guest.body.data.orderNumber;const cancelled=await call('admin','PATCH',{orderNumber:n,newStatus:'CANCELLED'},admin.cookie);assert.equal(cancelled.status,200,JSON.stringify(cancelled.body));
      assert.equal((await call('verify','POST',{orderNumber:n},admin.cookie)).status,400);
    });
    await check('legacy COD orders retain production and collection history',async()=>{
      const orderNumber=`ML-LEGACY-${randomUUID().slice(0,8).toUpperCase()}`;
      const subtotal=Number(product.sale_price);const shippingFee=subtotal>=500000?0:30000;
      const legacy=(await pool.query(`INSERT INTO orders (
        order_number,customer_id,customer_name_snapshot,customer_email_snapshot,customer_phone_snapshot,
        shipping_recipient_name,shipping_recipient_phone,shipping_address_line,shipping_province_name,
        order_status,payment_status,payment_timing,currency,subtotal,shipping_fee,grand_total,required_deposit_amount
      ) VALUES ($1,$2,'Legacy fixture','legacy@example.test','0901234567','Legacy fixture','0901234567',
        'Fixture only','Việt Nam','CONFIRMED','UNPAID','COD','VND',$3,$4,$5,0) RETURNING id`,
      [orderNumber,owner.body.data.id,subtotal,shippingFee,subtotal+shippingFee])).rows[0];
      await pool.query(`INSERT INTO order_items (
        order_id,product_variant_id,item_type,item_name_snapshot,sku_snapshot,quantity,unit_price,line_total
      ) SELECT $1,v.id,'READY_PRODUCT',v.variant_name,v.sku,1,v.sale_price,v.sale_price
        FROM product_variants v JOIN products p ON p.id=v.product_id WHERE p.slug=$2 AND v.status='ACTIVE' LIMIT 1`,[legacy.id,product.slug]);
      const n=orderNumber;
      assert.notEqual((await call('admin','PATCH',{orderNumber:n,newStatus:'COMPLETED'},admin.cookie)).status,200);
      assert.equal((await call('admin','PATCH',{orderNumber:n,newStatus:'IN_PRODUCTION'},admin.cookie)).status,200);
      assert.equal((await call('admin','PATCH',{orderNumber:n,newStatus:'READY_TO_SHIP'},operator.cookie)).status,200);
      assert.equal((await call('admin','PATCH',{orderNumber:n,newStatus:'SHIPPED'},admin.cookie)).status,200);
      assert.equal((await call('admin','PATCH',{orderNumber:n,newStatus:'COMPLETED'},admin.cookie)).status,200);
      const row=(await pool.query('SELECT o.payment_status,p.payment_method,o.completed_at FROM orders o JOIN payments p ON p.order_id=o.id WHERE order_number=$1',[n])).rows[0];
      assert.equal(row.payment_status,'PAID');assert.equal(row.payment_method,'COD');assert(row.completed_at);
    });
    await check('operators have an actionable production queue without customer or payment data',async()=>{
      const created=await call('orders','POST',orderInput);
      assert.equal(created.status,201);const n=created.body.data.orderNumber;
      assert.equal((await call('verify','POST',{orderNumber:n},admin.cookie)).status,200);
      assert.equal((await call('admin','PATCH',{orderNumber:n,newStatus:'IN_PRODUCTION'},admin.cookie)).status,200);
      assert.equal((await call('workshop')).status,401);
      for(const cookie of [owner.cookie,reviewer.cookie]) assert.equal((await call('workshop','GET',undefined,cookie)).status,403);
      assert.equal((await call('workshop','GET',undefined,workshop.cookie)).status,200);
      const list=await call('workshop','GET',undefined,operator.cookie);
      assert.equal(list.status,200);assert(list.body.data.some(order=>order.orderNumber===n));
      assert(list.body.data.every(order=>!('customerEmail' in order)&&!('grandTotal' in order)&&!('shippingAddress' in order)));
      assert.equal((await call('admin','GET',undefined,operator.cookie)).status,403);
      assert.equal((await call('workshop','GET',undefined,operator.cookie,'http://localhost:3100/api/workshop/orders?status=COMPLETED')).status,400);
      const ready=()=>call('admin','PATCH',{orderNumber:n,newStatus:'READY_TO_SHIP'},operator.cookie);
      const both=await Promise.all([ready(),ready()]);assert(both.every(response=>response.status===200));
      assert.equal((await pool.query("SELECT count(*)::int AS count FROM status_history WHERE entity_id=(SELECT id FROM orders WHERE order_number=$1) AND to_status='READY_TO_SHIP'",[n])).rows[0].count,1);
      assert.equal((await call('admin','PATCH',{orderNumber:n,newStatus:'SHIPPED'},operator.cookie)).status,403);
    });
    await check('Telegram outbox failure rolls back a customer payment declaration',async()=>{
      const created=await call('orders','POST',orderInput,owner.cookie);
      const payload={orderNumber:created.body.data.orderNumber,trackingToken:created.body.data.trackingToken,transactionReference:'ROLLBACK-TEST',bankName:'Fixture bank',senderAccountName:'Fixture sender'};
      await pool.query("CREATE FUNCTION test_fail_telegram_outbox() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'isolated test failure'; END $$; CREATE TRIGGER test_fail_telegram_outbox BEFORE INSERT ON telegram_outbox FOR EACH ROW WHEN (NEW.notification_type='STORE_PAYMENT_DECLARED') EXECUTE FUNCTION test_fail_telegram_outbox();");
      try {
        assert.equal((await call('declare','POST',payload)).status,500);
      } finally {
        await pool.query('DROP TRIGGER test_fail_telegram_outbox ON telegram_outbox; DROP FUNCTION test_fail_telegram_outbox();');
      }
      assert.equal(Number((await pool.query("SELECT count(*) FROM telegram_outbox WHERE order_number=$1 AND notification_type='STORE_PAYMENT_DECLARED'",[payload.orderNumber])).rows[0].count),0);
      const payment=(await pool.query("SELECT verification_status FROM payments p JOIN orders o ON o.id=p.order_id WHERE o.order_number=$1",[payload.orderNumber])).rows[0];
      assert.equal(payment.verification_status,'PENDING');
    });
    await check('database constraints reject negative prices and invalid statuses',async()=>{
      await assert.rejects(()=>pool.query('UPDATE product_variants SET sale_price=-1'),e=>e.code==='23514');
      await assert.rejects(()=>pool.query("UPDATE orders SET order_status='UNKNOWN'"),e=>e.code==='23514');
    });
    await check('checkout retries commit one order and one Telegram order alert across concurrent requests', async()=>{
      const key=randomUUID();
      const input={...orderInput,paymentMethod:'VIETQR'};
      const before=Number((await pool.query('SELECT count(*) FROM orders')).rows[0].count);
      const create=(body=input,cookie=owner.cookie)=>call('orders','POST',body,cookie,undefined,undefined,{'Idempotency-Key':key});
      const responses=await Promise.all([create(),create(),create()]);
      assert(responses.every(response=>response.status===201),JSON.stringify(responses));
      const number=responses[0].body.data.orderNumber;
      assert(responses.every(response=>response.body.data.orderNumber===number));
      assert.equal(Number((await pool.query('SELECT count(*) FROM orders')).rows[0].count),before+1);
      assert.equal(Number((await pool.query("SELECT count(*) FROM telegram_outbox WHERE order_number=$1 AND notification_type='STORE_ORDER_CREATED'",[number])).rows[0].count),1);
      const row=(await pool.query('SELECT checkout_key_hash,checkout_request_hash FROM orders WHERE order_number=$1',[number])).rows[0];
      assert.match(row.checkout_key_hash,/^[a-f0-9]{64}$/);assert.notEqual(row.checkout_key_hash,key);
      for(const response of responses) {
        const detail=await call('detail','GET',undefined,'',`http://localhost:3100/api/orders/${number}?token=${response.body.data.trackingToken}`,{orderNumber:number});
        assert.equal(detail.status,200);
      }
      assert.equal((await create({...input,customerName:'Different request'})).status,409);
      assert.equal((await create(input,other.cookie)).status,409);
      assert.equal((await create(input,'')).status,409);
      // Replaying an existing checkout does not depend on current catalogue availability.
      await pool.query("UPDATE products SET publication_status='HIDDEN' WHERE slug=$1",[product.slug]);
      assert.equal((await create()).body.data.orderNumber,number);
      await pool.query("UPDATE products SET publication_status='PUBLISHED' WHERE slug=$1",[product.slug]);
      assert.equal((await call('orders','POST',input,owner.cookie,undefined,undefined,{'Idempotency-Key':'invalid'})).status,400);
      const guestKey=randomUUID();
      const guestCreate=()=>call('orders','POST',input,'',undefined,undefined,{'Idempotency-Key':guestKey});
      assert.equal((await guestCreate()).body.data.orderNumber,(await guestCreate()).body.data.orderNumber);
    });
    await check('admin lists have bounded pages, stable ordering and server filters',async()=>{
      const list=await call('admin','GET',undefined,admin.cookie,'http://localhost:3100/api/admin/orders?pageSize=2');
      assert.equal(list.status,200);assert.equal(list.body.data.length,2);assert(list.body.pagination.total>2);
      const next=await call('admin','GET',undefined,admin.cookie,'http://localhost:3100/api/admin/orders?pageSize=2&page=2');
      assert(!next.body.data.some(order=>list.body.data.some(first=>first.orderNumber===order.orderNumber)));
      const filtered=await call('admin','GET',undefined,admin.cookie,'http://localhost:3100/api/admin/orders?status=CANCELLED');
      assert(filtered.body.data.length>0);assert(filtered.body.data.every(order=>order.orderStatus==='CANCELLED'));
      const payments=await call('payments','GET',undefined,admin.cookie,'http://localhost:3100/api/admin/payments?status=VERIFIED&pageSize=1');
      assert.equal(payments.body.data.length,1);assert.equal(payments.body.data[0].verificationStatus,'VERIFIED');
      for(const query of ['page=0','page=-1','pageSize=101','page=NaN','status=UNKNOWN']) {
        assert.equal((await call('admin','GET',undefined,admin.cookie,`http://localhost:3100/api/admin/orders?${query}`)).status,400);
      }
    });
    await check('JSON validation and internal failures have safe, consistent API responses',async()=>{
      const invalid=await routes.orders.POST(new NextRequest('http://localhost:3100/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:'{broken'}));
      assert.equal(invalid.status,400);assert.match((await invalid.json()).error,/JSON/);
      const response=(error)=>require('../../src/lib/api-response.ts').apiErrorResponse(error,'Không thể xử lý.');
      const hidden=response(new Error('private database credential'));
      assert.equal(hidden.status,500);assert.equal((await hidden.json()).error,'Không thể xử lý.');
      const db=globalThis.minhlabPgPool;
      const original=db.query;
      db.query=async()=>{throw new Error('private database detail');};
      try {
        for(const name of ['admin','payments','customer','session','detail','catalog']) {
          const result=await call(name,'GET',undefined,owner.cookie,undefined,{orderNumber:number});
          assert.equal(result.status,500,name);assert.equal(result.body.success,false);assert(!JSON.stringify(result.body).includes('private'));
        }
        assert.equal((await call('login','POST',account('owner@example.test'))).status,500);
      } finally {db.query=original;}
    });
    await require('../lib/test-production-workflow.cjs')({check,call,pool,admin,workshop,operator,reviewer,owner,orderInput,product});
    await require('../lib/test-order-returns.cjs')({check,call,pool,admin,workshop,owner,other,orderInput});
    await check('payment review metric counts declarations only and excludes archived orders',async()=>{
      const baseline=(await call('overview','GET',undefined,admin.cookie)).body.data.metrics.pendingPaymentReviews;
      const created=await call('orders','POST',orderInput,owner.cookie);
      assert.equal(created.status,201,JSON.stringify(created.body));
      const number=created.body.data.orderNumber;
      const count=async()=>(await call('overview','GET',undefined,admin.cookie)).body.data.metrics.pendingPaymentReviews;
      assert.equal(await count(),baseline);
      const declared=await call('declare','POST',{orderNumber:number,transactionReference:'ISOLATED-REVIEW-COUNT'},owner.cookie);
      assert.equal(declared.status,200,JSON.stringify(declared.body));
      assert.equal(await count(),baseline+1);
      assert.equal((await call('admin','DELETE',{orderNumber:number},admin.cookie)).status,200);
      assert.equal(await count(),baseline);
    });
    await require('../lib/test-custom-print.cjs')({check,call,pool,owner,other,reviewer,admin,workshop,operator});
    await check('logout revokes the stored session even if the old cookie is replayed',async()=>{
      await call('logout','POST',undefined,other.cookie);
      assert.equal((await call('session','GET',undefined,other.cookie)).body.data,null);
    });
    await check('role changes take effect on existing sessions immediately',async()=>{
      try {
        await assign(admin.body.data.id,'CUSTOMER');
        assert.equal((await call('admin','GET',undefined,admin.cookie)).status,403);
      } finally {
        await assign(admin.body.data.id,'ADMIN');
      }
      assert.equal((await call('session','GET',undefined,admin.cookie)).body.data.role,'ADMIN');
    });
    await check('login attempts are limited per account',async()=>{
      for(let i=0;i<10;i++) await call('login','POST',{email:'unknown@example.test',password:'wrong-password'});
      const limited=await call('login','POST',{email:'unknown@example.test',password:'wrong-password'});
      assert.equal(limited.status,429);assert.match(limited.body.error,/15 phút/);
    });
    await check('cross-origin mutations are rejected',async()=>{
      const {proxy}=require('../../proxy.ts');
      assert.equal(proxy(new NextRequest('http://localhost:3100/api/orders',{method:'POST',headers:{Origin:'https://untrusted.example'}})).status,403);
    });
    await check('email verification queues a single-use token and prevents login until verified',async()=>{
      process.env.MINHLAB_REQUIRE_EMAIL_VERIFICATION='true';
      process.env.RESEND_API_KEY='isolated-test-key-never-sent';process.env.EMAIL_FROM='test@example.test';
      const originalFetch=global.fetch;
      const sent=[];
      global.fetch=async (_url,options)=>{sent.push(JSON.parse(options.body));return new Response(JSON.stringify({id:`test-mail-${sent.length}`}),{status:200});};
      try {
      const pending=await call('register','POST',account('pending@example.test'));
      assert.equal(pending.status,201);assert.equal(pending.body.requiresEmailVerification,true);assert.equal(pending.cookie,undefined);
      assert.equal(sent.length,1);assert.deepEqual(sent[0].to,['pending@example.test']);
      assert.equal((await call('login','POST',account('pending@example.test'))).status,401);
      const mail=(await pool.query("SELECT body_text,status,attempts FROM email_outbox WHERE recipient='pending@example.test' AND notification_type='EMAIL_VERIFICATION'")).rows[0];
      assert.equal(mail.status,'SENT');assert.equal(mail.attempts,1);
      const token=mail.body_text.match(/Mã xác minh: ([0-9]{8})/)[1];
      assert.equal((await call('verifyEmail','POST',{code:token,email:'pending@example.test'})).status,200);
      assert.equal((await call('verifyEmail','POST',{code:token,email:'pending@example.test'})).status,400);
      assert.equal((await call('login','POST',account('pending@example.test'))).status,200);
      const expired=await call('register','POST',account('expired@example.test'));
      const expiredMail=(await pool.query("SELECT body_text FROM email_outbox WHERE recipient='expired@example.test'")).rows[0];
      const expiredToken=expiredMail.body_text.match(/Mã xác minh: ([0-9]{8})/)[1];
      await pool.query("UPDATE account_tokens SET created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' WHERE user_id=$1",[expired.body.data.id]);
      assert.equal((await call('verifyEmail','POST',{code:expiredToken,email:'expired@example.test'})).status,400);
      const resend=await call('register','POST',account('resend@example.test'));
      assert.equal(resend.status,201);
      assert.equal((await call('verificationRequest','POST',{email:'resend@example.test'})).status,200);
      assert.equal(sent.length,4);
      } finally {global.fetch=originalFetch;}
      process.env.MINHLAB_REQUIRE_EMAIL_VERIFICATION='false';
    });
    await check('password reset does not enumerate accounts, consumes tokens once, and revokes old sessions',async()=>{
      const originalFetch=global.fetch;
      let sendCount=0;
      global.fetch=async ()=>{sendCount++;return new Response(JSON.stringify({id:`test-reset-${sendCount}`}),{status:200});};
      try {
      const logged=await call('login','POST',account('owner@example.test'));
      const known=await call('resetRequest','POST',{email:'owner@example.test'});
      const unknown=await call('resetRequest','POST',{email:'absent@example.test'});
      assert.deepEqual(known.body,unknown.body);
      assert.equal(sendCount,1);
      const mail=(await pool.query("SELECT body_text FROM email_outbox WHERE recipient='owner@example.test' AND notification_type='PASSWORD_RESET'")).rows[0];
      const token=new URL(mail.body_text.match(/http[^\s]+/)[0]).searchParams.get('token');
      assert.equal((await call('resetConfirm','POST',{token,password:'New-isolated-password-2026'})).status,200);
      assert.equal((await call('resetConfirm','POST',{token,password:'New-isolated-password-2026'})).status,400);
      assert.equal((await call('session','GET',undefined,logged.cookie)).body.data,null);
      assert.equal((await call('login','POST',account('owner@example.test'))).status,401);
      assert.equal((await call('login','POST',{email:'owner@example.test',password:'New-isolated-password-2026'})).status,200);
      } finally {global.fetch=originalFetch;}
    });
    await require('../lib/test-auth-reset-postgres.cjs')({
      check,
      pool,
      authService: require('../../src/server/auth.ts').AuthService,
    });
    await check('mail provider failure leaves registration valid and retries the same outbox row',async()=>{
      process.env.MINHLAB_REQUIRE_EMAIL_VERIFICATION='true';
      const originalFetch=global.fetch;
      global.fetch=async()=>new Response('{}',{status:503});
      try {
        const pending=await call('register','POST',account('retry@example.test'));
        assert.equal(pending.status,201);assert.equal(pending.body.requiresEmailVerification,true);
        const failed=(await pool.query("SELECT id,status,attempts FROM email_outbox WHERE recipient='retry@example.test'")).rows[0];
        assert.equal(failed.status,'FAILED');assert.equal(failed.attempts,1);
        await pool.query("UPDATE email_outbox SET retry_after=now()-interval '1 second' WHERE id=$1",[failed.id]);
        global.fetch=async()=>new Response(JSON.stringify({id:'test-retry-ok'}),{status:200});
        const {deliverQueuedMail}=require('../../src/integrations/notifications/mail-delivery.ts');
        assert.equal(await deliverQueuedMail(pool,failed.id),'sent');
        assert.equal(await deliverQueuedMail(pool,failed.id),'empty');
        const recovered=(await pool.query('SELECT status,attempts,provider_message_id FROM email_outbox WHERE id=$1',[failed.id])).rows[0];
        assert.equal(recovered.status,'SENT');assert.equal(recovered.attempts,2);assert.equal(recovered.provider_message_id,'test-retry-ok');
      } finally {global.fetch=originalFetch;process.env.MINHLAB_REQUIRE_EMAIL_VERIFICATION='false';}
    });
    await require('../lib/test-master-audit.cjs')({check,call,pool,orderInput,product,admin,workshop,operator});
    await check('persisted carts reject corrupt data and refresh stale prices from the catalogue',async()=>{
      const {restoreCart,matchesCartItem}=require('../../src/lib/cart.ts');
      const products=(await call('catalog')).body.data.products;
      assert.deepEqual(restoreCart({bad:'input'},products),[]);
      const product=products[0];const restored=restoreCart([{product:{id:product.id,price:1},quantity:3}],products);assert.equal(restored[0].product.price,product.price);
      assert.equal(matchesCartItem({...restored[0],selectedColor:'Red'},product.id,'Blue'),false);
    });
    if(process.env.MINHLAB_QA_ENV_PATH) {
      const qaPath=path.resolve(process.env.MINHLAB_QA_ENV_PATH);
      if(!qaPath.startsWith(path.join(root,'.local')+path.sep))throw new Error('QA environment artifact must stay in .local.');
      await assign(admin.body.data.id,'ADMIN');
      const qaEnv={DATABASE_URL:process.env.DATABASE_URL,MIGRATION_DATABASE_URL:'',NEXT_PUBLIC_SITE_URL:'http://localhost:3191',RESEND_API_KEY:'',EMAIL_FROM:'',TELEGRAM_BOT_TOKEN:'',TELEGRAM_CHAT_ID:'',MINHLAB_ADMIN_EMAIL:'',MINHLAB_ADMIN_PASSWORD:'',MINHLAB_REQUIRE_EMAIL_VERIFICATION:'false',MINHLAB_PRODUCTION_AGENT_ENABLED:'false',MINHLAB_PRODUCTION_AGENT_API_KEY:'',MINHLAB_MANUAL_VIETQR_ENABLED:'true',MINHLAB_VIETQR_BANK_BIN:'970422',MINHLAB_VIETQR_BANK_NAME:'Fixture bank',MINHLAB_VIETQR_ACCOUNT_NUMBER:'0000000000',MINHLAB_VIETQR_ACCOUNT_NAME:'ISOLATED TEST ONLY',...globalThis.minhlabQaPrivateConfig};
      fs.mkdirSync(path.dirname(qaPath),{recursive:true,mode:0o700});fs.writeFileSync(qaPath,JSON.stringify({databaseName,env:qaEnv,privateRoot:globalThis.minhlabQaPrivateConfig?.MINHLAB_PRIVATE_FILES_ROOT}),{mode:0o600});
    }
  } finally {
    if(globalThis.minhlabPgPool) await globalThis.minhlabPgPool.end();
    if(pool) await pool.end();
    // The VPS preflight runs against a PostgreSQL container created solely for this
    // check and removes that whole container after the test process exits. Avoid
    // FORCE-dropping its database while pg pools are closing: PostgreSQL can emit
    // 57P01 on a still-draining pool and turn an otherwise-passing run into a crash.
    const externalDisposableLifecycle = process.env.MINHLAB_EXTERNAL_TEST_DATABASE_LIFECYCLE === 'true';
    if(created && !externalDisposableLifecycle && !(process.env.MINHLAB_QA_ENV_PATH && results.every(r=>r.passed))) await control.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    await control.end();
    const report={generatedAt:new Date().toISOString(),isolation:'Disposable local database; no mail delivery',runtimePrivilegesTested,passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results};
    const reportDirectory = path.join(root,'.local','test-results');
    fs.mkdirSync(reportDirectory,{recursive:true});fs.writeFileSync(path.join(reportDirectory,'production.json'),JSON.stringify(report,null,2)+'\n');
  }
}
main().catch(error=>{process.stderr.write(`${error.stack}\n`);process.exitCode=1;});

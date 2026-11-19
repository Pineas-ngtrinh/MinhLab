const assert = require('node:assert/strict');

/** Regression fixtures run only inside test-production's disposable local database. */
module.exports = async function testMasterAudit({ check, call, pool, orderInput, product, admin, workshop, operator }) {
  await check('checkout rejects fractional VND unit snapshots even when the line total is whole', async () => {
    const variant = (await pool.query(`SELECT v.id,v.sale_price,v.compare_at_price FROM product_variants v
      JOIN products p ON p.id=v.product_id WHERE p.slug=$1 AND v.status='ACTIVE'
      ORDER BY v.created_at,v.id LIMIT 1`, [product.slug])).rows[0];
    const before = (await pool.query('SELECT count(*)::int AS count FROM orders')).rows[0].count;
    try {
      await pool.query('UPDATE product_variants SET sale_price=0.5,compare_at_price=NULL WHERE id=$1', [variant.id]);
      const input = { ...orderInput, items: [{ ...orderInput.items[0], productVariantId: variant.id, quantity: 2 }] };
      assert.equal((await call('orders', 'POST', input)).status, 400);
      assert.equal((await pool.query('SELECT count(*)::int AS count FROM orders')).rows[0].count, before);
    } finally {
      await pool.query('UPDATE product_variants SET sale_price=$2,compare_at_price=$3 WHERE id=$1',
        [variant.id, variant.sale_price, variant.compare_at_price]);
    }
  });

  await check('external proof URLs cannot create or overwrite order attachments', async () => {
    const proofs = [];
    for (const receipt of ['one', 'two']) {
      const created = await call('orders', 'POST', orderInput);
      assert.equal(created.status, 201);
      const paymentProofUrl = `https://res.cloudinary.com/audit-fixture/image/upload/proof.jpg?receipt=${receipt}`;
      const declared = await call('declare', 'POST', {
        orderNumber: created.body.data.orderNumber, trackingToken: created.body.data.trackingToken,
        transactionReference: `AUDIT-${receipt}`, bankName: 'Fixture bank', senderAccountName: 'Fixture sender',
        paymentProofUrl,
      });
      assert.equal(declared.status, 409);
      proofs.push({ orderNumber: created.body.data.orderNumber, paymentProofUrl });
    }
    const records = (await pool.query(`SELECT o.order_number,f.id,f.secure_url FROM attachments a
      JOIN file_assets f ON f.id=a.file_asset_id JOIN payments p ON p.id=a.entity_id
      JOIN orders o ON o.id=p.order_id WHERE a.entity_type='PAYMENT' AND o.order_number=ANY($1::varchar[])`,
      [proofs.map(proof => proof.orderNumber)])).rows;
    assert.equal(records.length, 0);
  });

  await check('workshop operators cannot bypass transition RBAC by retrying a workshop status', async () => {
    const created = await call('orders', 'POST', orderInput);
    assert.equal(created.status, 201);
    const orderNumber = created.body.data.orderNumber;
    assert.equal((await call('verify', 'POST', { orderNumber }, admin.cookie)).status, 200);
    const before = (await pool.query(`SELECT count(*)::int AS count FROM status_history
      WHERE entity_type='ORDER' AND entity_id=(SELECT id FROM orders WHERE order_number=$1)`, [orderNumber])).rows[0].count;
    const responses = await Promise.all(Array.from({ length: 2 }, () =>
      call('admin', 'PATCH', { orderNumber, newStatus: 'CONFIRMED' }, operator.cookie)));
    assert(responses.every(response => response.status === 403));
    assert.equal((await pool.query(`SELECT count(*)::int AS count FROM status_history
      WHERE entity_type='ORDER' AND entity_id=(SELECT id FROM orders WHERE order_number=$1)`, [orderNumber])).rows[0].count, before);
  });

  await check('concurrent external proof declarations leave no public evidence pointer', async () => {
    const orders = await Promise.all(Array.from({ length: 2 }, () => call('orders', 'POST', orderInput)));
    const responses = await Promise.all(orders.map((created, index) => call('declare', 'POST', {
      orderNumber: created.body.data.orderNumber, trackingToken: created.body.data.trackingToken,
      transactionReference: `AUDIT-CONCURRENT-${index}`, bankName: 'Fixture bank', senderAccountName: 'Fixture sender',
      paymentProofUrl: 'https://res.cloudinary.com/audit-fixture/image/upload/concurrent.jpg',
    })));
    assert(responses.every(response => response.status === 409));
    const assets = (await pool.query(`SELECT a.file_asset_id FROM attachments a JOIN payments p ON p.id=a.entity_id
      JOIN orders o ON o.id=p.order_id WHERE a.entity_type='PAYMENT' AND o.order_number=ANY($1::varchar[])`,
      [orders.map(created => created.body.data.orderNumber)])).rows;
    assert.equal(assets.length, 0);
  });

  await check('payment declaration rolls back state and audit when its Telegram outbox insert fails', async () => {
    const created = await call('orders', 'POST', orderInput);
    const orderNumber = created.body.data.orderNumber;
    await pool.query(`CREATE FUNCTION audit_test_fail_declared_alert() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'isolated audit regression'; END $$;
      CREATE TRIGGER audit_test_fail_declared_alert BEFORE INSERT ON telegram_outbox
      FOR EACH ROW WHEN (NEW.notification_type='STORE_PAYMENT_DECLARED') EXECUTE FUNCTION audit_test_fail_declared_alert();`);
    try {
      assert.equal((await call('declare', 'POST', {
        orderNumber, trackingToken: created.body.data.trackingToken,
        transactionReference: 'AUDIT-ROLLBACK', bankName: 'Fixture bank', senderAccountName: 'Fixture sender',
      })).status, 500);
      const row = (await pool.query(`SELECT o.order_status,o.payment_status,p.verification_status,
        (SELECT count(*)::int FROM audit_logs a WHERE a.entity_id=p.id AND a.action='PAYMENT_DECLARED') AS decisions
        FROM orders o JOIN payments p ON p.order_id=o.id WHERE o.order_number=$1`, [orderNumber])).rows[0];
      assert.equal(row.order_status, 'PENDING_PAYMENT');
      assert.equal(row.payment_status, 'UNPAID');
      assert.equal(row.verification_status, 'PENDING');
      assert.equal(row.decisions, 0);
    } finally {
      await pool.query('DROP TRIGGER audit_test_fail_declared_alert ON telegram_outbox; DROP FUNCTION audit_test_fail_declared_alert();');
    }
    assert.equal((await call('declare', 'POST', {
      orderNumber, trackingToken: created.body.data.trackingToken,
      transactionReference: 'AUDIT-ROLLBACK', bankName: 'Fixture bank', senderAccountName: 'Fixture sender',
    })).status, 200);
  });
  await check('Telegram payment rejection preserves the order, permits redeclaration and rejects stale or unauthorized callbacks', async () => {
    const {handleTelegramPaymentCallback}=require('../../src/server/telegram-payment-approval.ts');
    const actor=await call('register','POST',{email:'telegram-reviewer@example.test',fullName:'Telegram test reviewer',password:'Telegram-fixture-password-2026'});
    assert.equal(actor.status,201);
    const actorId=actor.body.data.id;
    await pool.query("INSERT INTO user_roles(user_id,role_id) SELECT $1,id FROM roles WHERE code='ADMIN'",[actorId]);
    const created=await call('orders','POST',orderInput);
    const orderNumber=created.body.data.orderNumber;
    const declaration={orderNumber,trackingToken:created.body.data.trackingToken,transactionReference:'TG-FIRST'};
    assert.equal((await call('declare','POST',declaration)).status,200);
    const notification=(await pool.query("UPDATE telegram_outbox SET status='SENT',provider_message_id='71' WHERE order_number=$1 AND notification_type='STORE_PAYMENT_DECLARED' RETURNING id",[orderNumber])).rows[0];
    const previous={chat:process.env.TELEGRAM_CHAT_ID,token:process.env.TELEGRAM_BOT_TOKEN,fetch:global.fetch};
    await pool.query("UPDATE users SET telegram_user_id='99' WHERE id=$1",[actorId]);
    process.env.TELEGRAM_CHAT_ID='-100123';process.env.TELEGRAM_BOT_TOKEN='fixture-token-not-real';
    const responses=[];
    global.fetch=async(_url,options)=>{responses.push(JSON.parse(options.body));return {ok:true,status:200,json:async()=>({ok:true,result:true})};};
    const cb={callbackQueryId:'fixture',telegramUserId:'99',chatId:'-100123',messageId:'71',data:`reject-payment:short:${notification.id}`};
    try {
      await handleTelegramPaymentCallback(cb,'http://localhost:3100');
      const state=async()=>(await pool.query("SELECT o.order_status,o.payment_status,p.verification_status,p.rejection_reason FROM orders o JOIN payments p ON p.order_id=o.id WHERE o.order_number=$1",[orderNumber])).rows[0];
      assert.equal((await state()).verification_status,'REJECTED');assert.equal((await state()).order_status,'PENDING_PAYMENT');assert.equal((await state()).payment_status,'UNPAID');assert.match((await state()).rejection_reason,/thiếu/);
      await handleTelegramPaymentCallback(cb,'http://localhost:3100');
      assert.equal(Number((await pool.query("SELECT count(*) FROM audit_logs a JOIN payments p ON a.entity_id=p.id JOIN orders o ON o.id=p.order_id WHERE o.order_number=$1 AND a.action='PAYMENT_REJECTED'",[orderNumber])).rows[0].count),1);
      assert.equal((await call('declare','POST',{...declaration,transactionReference:'TG-SECOND'})).status,200);
      await handleTelegramPaymentCallback(cb,'http://localhost:3100');
      assert.equal((await state()).verification_status,'PENDING');
      const newest=(await pool.query("UPDATE telegram_outbox SET status='SENT',provider_message_id='72' WHERE order_number=$1 AND notification_type='STORE_PAYMENT_DECLARED' AND id<>$2 RETURNING id",[orderNumber,notification.id])).rows[0];
      await pool.query("DELETE FROM user_roles WHERE user_id=$1 AND role_id=(SELECT id FROM roles WHERE code='ADMIN')",[actorId]);
      await handleTelegramPaymentCallback({...cb,messageId:'72',data:`reject-payment:short:${newest.id}`},'http://localhost:3100');
      assert.equal((await state()).verification_status,'PENDING');assert(responses.some(r=>r.show_alert===true));
    } finally {
      for(const [key,value] of [['TELEGRAM_CHAT_ID',previous.chat],['TELEGRAM_BOT_TOKEN',previous.token]])if(value===undefined)delete process.env[key];else process.env[key]=value;
      global.fetch=previous.fetch;
    }
  });

  await check('Telegram self-link requires website confirmation, expires, cannot replay, steal identities or restore revoked challenges', async () => {
    const {PostgresTelegramLinkRepository}=require('../../src/repositories/auth/telegram-link.repository.ts');
    const {withTransaction}=require('../../src/lib/db.ts');
    const {randomUUID,createHash}=require('node:crypto');
    const repo=new PostgresTelegramLinkRepository(withTransaction,()=>false);
    const register=async email=>{const r=await call('register','POST',{email,fullName:'Telegram self-link fixture',password:'Synthetic-link-password-2026'});assert.equal(r.status,201);return r.body.data.id;};
    const user=await register('telegram-self-one@example.test');
    const other=await register('telegram-self-two@example.test');
    const digest=value=>createHash('sha256').update(value).digest('hex');
    const rid=randomUUID(),hash=digest('link-test-one');
    const identity={token:'unused',telegramId:'1234567890',name:'Fixture Telegram'};
    await repo.start(user,rid,hash);
    assert.equal(await repo.propose(hash,identity),true);
    assert.equal((await repo.status(user)).linkedId,null);
    assert.equal(await repo.propose(hash,{...identity,telegramId:'1234567891'}),false);
    await assert.rejects(repo.confirm(other,rid),/hết hạn/);
    await repo.confirm(user,rid);
    assert.equal((await repo.status(user)).linkedId,identity.telegramId);
    assert.equal(await repo.propose(hash,identity),false);
    await assert.rejects(repo.confirm(user,rid),/hết hạn/);
    const second=randomUUID(),secondHash=digest('second');
    await repo.start(other,second,secondHash);
    await repo.propose(secondHash,identity);
    await assert.rejects(repo.confirm(other,second),/tài khoản website khác/);
    assert.equal((await repo.status(other)).linkedId,null);
    const expired=randomUUID(),expiredHash=digest('expired');
    await repo.start(user,expired,expiredHash);
    await repo.propose(expiredHash,identity);
    await pool.query("UPDATE telegram_link_requests SET expires_at=now()-interval '1 second' WHERE user_id=$1",[user]);
    assert.equal(await repo.propose(expiredHash,identity),false);
    await assert.rejects(repo.confirm(user,expired),/hết hạn/);
    const stale=randomUUID();await repo.start(user,stale,digest('stale'));
    await repo.propose(digest('stale'),identity);
    await repo.start(user,randomUUID(),digest('fresh'));
    await assert.rejects(repo.confirm(user,stale),/hết hạn/);
    await repo.unlink(user);
    assert.equal((await repo.status(user)).linkedId,null);
    assert.equal(await repo.propose(digest('fresh'),identity),false);
    const locked=randomUUID();await repo.start(user,locked,digest('locked'));
    await repo.propose(digest('locked'),identity);
    await pool.query("UPDATE users SET status='LOCKED' WHERE id=$1",[user]);
    await assert.rejects(repo.confirm(user,locked),/không còn hoạt động/);
  });

};

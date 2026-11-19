const assert = require('node:assert/strict');

module.exports = async function ({ check, call, pool, admin, workshop, owner, other, orderInput }) {
  await check('return and manual refund enforce delivery, ownership, ADMIN permission and one refund', async () => {
    const created = await call('orders', 'POST', orderInput, owner.cookie);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    const number = created.body.data.orderNumber;
    assert.equal((await call('verify', 'POST', { orderNumber: number }, admin.cookie)).status, 200);
    const params = { orderNumber: number };
    const request = (cookie = owner.cookie) => call('returnRequest', 'POST', { reason: 'Không phù hợp nhu cầu' }, cookie, undefined, params);
    const action = (body, cookie = admin.cookie) => call('returnAction', 'PATCH', body, cookie, undefined, params);
    await pool.query("UPDATE orders SET order_status='SHIPPED' WHERE order_number=$1", [number]);
    assert.equal((await request()).status, 409);
    assert.equal((await call('admin', 'PATCH', { orderNumber: number, newStatus: 'CANCELLED' }, admin.cookie)).status, 409);
    assert.equal((await call('admin', 'PATCH', { orderNumber: number, newStatus: 'COMPLETED' }, admin.cookie)).status, 200);
    assert.equal((await request(other.cookie)).status, 404);
    assert.equal((await request()).status, 201);
    assert.equal((await request()).status, 201);
    const amount = Number((await pool.query('SELECT grand_total FROM orders WHERE order_number=$1', [number])).rows[0].grand_total);
    const refund = { action: 'REFUND', amount, transactionReference: 'ISOLATED-REFUND-1' };
    assert.equal((await action(refund)).status, 409);
    assert.equal((await action({ action: 'RECEIVE' }, workshop.cookie)).status, 403);
    assert.equal((await action({ action: 'RECEIVE' })).status, 200);
    assert.equal((await action({ ...refund, amount: amount + 1 })).status, 409);
    assert.equal((await action(refund)).status, 200);
    assert.equal((await action(refund)).status, 200);
    assert.equal((await action({ ...refund, transactionReference: 'SECOND-TRANSFER' })).status, 409);
    const row = (await pool.query(`SELECT o.payment_status,r.status,
      (SELECT count(*) FROM refunds f WHERE f.return_request_id=r.id) AS refunds
      FROM orders o JOIN order_return_requests r ON r.order_id=o.id WHERE o.order_number=$1`, [number])).rows[0];
    assert.equal(row.payment_status, 'REFUNDED');
    assert.equal(row.status, 'REFUNDED');
    assert.equal(Number(row.refunds), 1);
  });
};

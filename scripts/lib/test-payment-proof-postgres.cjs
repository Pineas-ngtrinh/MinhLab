const assert = require('node:assert/strict');
const { mkdtemp, writeFile, chmod, rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { NextRequest } = require('next/server');
const { processPrivateFiles } = require('../../src/server/private-files.ts');

const pngFixture = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
]);

module.exports = async function testPaymentProofPostgres({ check, call, routes, pool, owner, admin, orderInput }) {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), 'minhlab-payment-proof-'));
  const privateRoot = path.join(temporaryRoot, 'private-files');
  const cleanScanner = path.join(temporaryRoot, 'scanner-clean.sh');
  const infectedScanner = path.join(temporaryRoot, 'scanner-infected.sh');
  const envKeys = [
    'MINHLAB_PRIVATE_FILES_ENABLED',
    'MINHLAB_PRIVATE_FILES_ROOT',
    'MINHLAB_PRIVATE_FILES_SCANNER',
    'MINHLAB_PRIVATE_UPLOAD_FORMATS',
    'MINHLAB_PRIVATE_UPLOAD_MAX_BYTES',
    'MINHLAB_PRIVATE_UPLOAD_QUOTA_BYTES',
    'MINHLAB_PRIVATE_FILES_RETENTION_DAYS',
  ];
  const previousEnv = new Map(envKeys.map((key) => [key, process.env[key]]));
  try {
    await writeFile(cleanScanner, '#!/bin/sh\nexit 0\n', { mode: 0o700 });
    await writeFile(infectedScanner, '#!/bin/sh\nexit 1\n', { mode: 0o700 });
    await chmod(cleanScanner, 0o700);
    await chmod(infectedScanner, 0o700);
    Object.assign(process.env, {
      MINHLAB_PRIVATE_FILES_ENABLED: 'true',
      MINHLAB_PRIVATE_FILES_ROOT: privateRoot,
      MINHLAB_PRIVATE_FILES_SCANNER: cleanScanner,
      MINHLAB_PRIVATE_UPLOAD_FORMATS: 'STL,OBJ,STEP',
      MINHLAB_PRIVATE_UPLOAD_MAX_BYTES: String(5 * 1024 * 1024),
      MINHLAB_PRIVATE_UPLOAD_QUOTA_BYTES: String(10 * 1024 * 1024),
      MINHLAB_PRIVATE_FILES_RETENTION_DAYS: '7',
    });

    async function upload(orderNumber) {
      const request = new NextRequest(`http://localhost:3100/api/orders/${orderNumber}/payment-proof`, {
        method: 'POST',
        headers: { Cookie: owner.cookie, 'Content-Type': 'image/png' },
        body: pngFixture,
      });
      return routes.paymentProofUpload.POST(request, { params: Promise.resolve({ orderNumber }) });
    }

    async function readProof(paymentId, assetId, cookie) {
      const request = new NextRequest(`http://localhost:3100/api/admin/payments/${paymentId}/proof/${assetId}`, {
        method: 'GET',
        headers: cookie ? { Cookie: cookie } : {},
      });
      return routes.paymentProofDownload.GET(request, { params: Promise.resolve({ paymentId, assetId }) });
    }

    async function newOrder() {
      const created = await call('orders', 'POST', orderInput, owner.cookie);
      assert.equal(created.status, 201, JSON.stringify(created.body));
      const payment = (await pool.query(`SELECT p.id FROM payments p JOIN orders o ON o.id=p.order_id
        WHERE o.order_number=$1 ORDER BY p.created_at DESC,p.id DESC LIMIT 1`, [created.body.data.orderNumber])).rows[0];
      assert(payment?.id, 'Payment fixture was not created');
      return { orderNumber: created.body.data.orderNumber, paymentId: payment.id };
    }

    async function processUntil(assetId, expectedStatus) {
      for (let attempt = 0; attempt < 12; attempt++) {
        const row = (await pool.query('SELECT upload_status,malware_scan_status FROM file_assets WHERE id=$1', [assetId])).rows[0];
        if (row?.upload_status === expectedStatus) return row;
        await processPrivateFiles(1);
      }
      return (await pool.query('SELECT upload_status,malware_scan_status FROM file_assets WHERE id=$1', [assetId])).rows[0];
    }

    let uploadedProof;
    await check('private payment proof stays hidden until scan succeeds and only workshop can retrieve it', async () => {
      const order = await newOrder();
      const unauthenticated = await routes.paymentProofUpload.POST(
        new NextRequest(`http://localhost:3100/api/orders/${order.orderNumber}/payment-proof`, {
          method: 'POST', headers: { 'Content-Type': 'image/png' }, body: pngFixture,
        }),
        { params: Promise.resolve({ orderNumber: order.orderNumber }) },
      );
      assert.equal(unauthenticated.status, 404);

      const response = await upload(order.orderNumber);
      assert.equal(response.status, 201);
      uploadedProof = (await response.json()).data;
      assert.equal(uploadedProof.scanStatus, 'PENDING');

      const metadata = (await pool.query(`SELECT f.storage_provider,f.access_level,f.upload_status,
          f.malware_scan_status,f.secure_url,a.entity_type,a.entity_id,a.purpose,a.is_current
        FROM file_assets f JOIN attachments a ON a.file_asset_id=f.id WHERE f.id=$1`, [uploadedProof.id])).rows[0];
      assert.deepEqual(metadata, {
        storage_provider: 'LOCAL_PRIVATE', access_level: 'PRIVATE', upload_status: 'STORED',
        malware_scan_status: 'PENDING', secure_url: null, entity_type: 'PAYMENT',
        entity_id: order.paymentId, purpose: 'PAYMENT_PROOF', is_current: true,
      });

      assert.equal((await readProof(order.paymentId, uploadedProof.id, owner.cookie)).status, 403);
      assert.equal((await readProof(order.paymentId, uploadedProof.id, admin.cookie)).status, 409);

      const clean = await processUntil(uploadedProof.id, 'AVAILABLE');
      assert.equal(clean.upload_status, 'AVAILABLE');
      assert.equal(clean.malware_scan_status, 'CLEAN');
      const readable = await readProof(order.paymentId, uploadedProof.id, admin.cookie);
      assert.equal(readable.status, 200);
      assert.equal(readable.headers.get('content-type'), 'image/png');
      assert.match(readable.headers.get('cache-control') || '', /no-store/);
      assert.deepEqual(Buffer.from(await readable.arrayBuffer()), pngFixture);
    });

    await check('infected private payment proof is rejected and cannot be retrieved', async () => {
      const order = await newOrder();
      const response = await upload(order.orderNumber);
      assert.equal(response.status, 201);
      const proof = (await response.json()).data;
      process.env.MINHLAB_PRIVATE_FILES_SCANNER = infectedScanner;
      const rejected = await processUntil(proof.id, 'REJECTED');
      assert.equal(rejected.upload_status, 'REJECTED');
      assert.equal(rejected.malware_scan_status, 'INFECTED');
      assert.equal((await readProof(order.paymentId, proof.id, admin.cookie)).status, 409);
    });
  } finally {
    for (const [key, value] of previousEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await rm(temporaryRoot, { recursive: true, force: true });
  }
};

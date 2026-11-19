import assert from 'node:assert/strict';
import test from 'node:test';
import type { PoolClient } from 'pg';
import { PostgresCatalogImageRepository } from '../catalog-image.repository';

function fixture(imageCount = 1, publication = 'DRAFT') {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const client = {
    async query(sql: string, values: unknown[] = []) {
      calls.push({ sql, values });
      if (sql.startsWith('SELECT name,publication_status FROM products')) return { rows: [{ name: 'MinhLab Toy', publication_status: publication }] };
      if (sql.startsWith('SELECT count(*)')) return { rows: [{ total: imageCount }] };
      if (sql.startsWith('INSERT INTO file_assets')) return { rows: [{ id: 'asset-id' }] };
      return { rows: [], rowCount: 1 };
    },
  } as unknown as PoolClient;
  return { calls, client };
}

const input = {
  productId: 'product-id',
  actorId: 'admin-id',
  actorRole: 'ADMIN' as const,
  filename: 'front.png',
  mimeType: 'image/png',
  cloudName: 'example-cloud',
  asset: {
    publicId: 'minhlab/products/product-id/image-id',
    secureUrl: 'https://res.cloudinary.com/example-cloud/image/upload/front.png',
    width: 320,
    height: 240,
    format: 'png' as const,
    bytes: 128,
    sha256: 'a'.repeat(64),
  },
};

test('catalog image repository persists public asset, product reference and audit event in the transaction client', async () => {
  const { calls, client } = fixture();
  await new PostgresCatalogImageRepository(client).saveProductImage(input);

  assert.equal(calls.length, 5);
  assert.match(calls[0].sql, /FOR UPDATE/);
  assert.match(calls[2].sql, /image_width,image_height/);
  assert.equal(calls[2].values[0], input.actorId);
  assert.equal(calls[2].values[1], input.cloudName);
  assert.match(calls[3].sql, /INSERT INTO product_images\(product_id,file_asset_id,url/);
  assert.deepEqual(calls[3].values, [input.productId, 'asset-id', input.asset.secureUrl, 'MinhLab Toy', 1]);
  assert.match(calls[4].sql, /PRODUCT_IMAGE_UPLOADED/);
  assert.equal(calls[4].values[0], input.actorId);
});

test('catalog image repository enforces the 20-image product limit before inserting metadata', async () => {
  const { calls, client } = fixture(20);
  await assert.rejects(
    new PostgresCatalogImageRepository(client).saveProductImage(input),
    /tối đa 20 ảnh/,
  );
  assert.equal(calls.length, 2);
  assert.equal(calls.some((call) => call.sql.startsWith('INSERT INTO file_assets')), false);
});

test('catalog image repository prevents staff from changing a live product gallery', async () => {
  const { calls, client } = fixture(1, 'PUBLISHED');
  await assert.rejects(
    new PostgresCatalogImageRepository(client).saveProductImage({ ...input, actorRole: 'WORKSHOP_OPERATOR' }),
    (error: unknown) => error instanceof Error && 'status' in error && error.status === 403,
  );
  assert.equal(calls.length, 1);
  assert.equal(calls.some((call) => call.sql.startsWith('INSERT INTO file_assets')), false);
});

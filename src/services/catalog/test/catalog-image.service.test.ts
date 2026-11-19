import assert from 'node:assert/strict';
import test from 'node:test';
import { AppError } from '../../../lib/errors';
import { createCatalogImageService } from '../catalog-image.service';

const bytes = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
]);
const asset = {
  publicId: 'MinhLab_Product/minhlab-toy__001/image-id',
  secureUrl: 'https://res.cloudinary.com/example/image/upload/image.png',
  width: 100,
  height: 80,
  format: 'png' as const,
  bytes: bytes.byteLength,
  sha256: 'f'.repeat(64),
};
const input = {
  productId: 'product-uuid',
  actorId: 'admin-uuid',
  actorRole: 'ADMIN' as const,
  bytes,
  declaredMimeType: 'image/png',
  filename: '../front.png',
};

test('catalog image service validates, uploads and persists the public product image', async () => {
  const calls: string[] = [];
  const service = createCatalogImageService({
    storage: {
      async upload(value) { calls.push(`upload:${value.productName}:${value.productCode}:${value.filename}:${value.format}`); return asset; },
      async delete() { calls.push('delete'); },
    },
    repository: {
      async resolveProductFolder() { return { name: 'MinhLab Toy', code: 'ML-P-001' }; },
      async saveProductImage(value) { calls.push(`save:${value.filename}:${value.asset.publicId}`); },
      async hasPersistedProductImage() { return false; },
    },
  });

  const result = await service.uploadProductImage(input);
  assert.deepEqual(calls, ['upload:MinhLab Toy:ML-P-001:.._front.png:png', `save:.._front.png:${asset.publicId}`]);
  assert.deepEqual(result, { url: asset.secureUrl, width: 100, height: 80, format: 'png', bytes: bytes.byteLength });
});

test('catalog image service does not upload invalid files', async () => {
  let uploaded = false;
  const service = createCatalogImageService({
    storage: {
      async upload() { uploaded = true; return asset; },
      async delete() {},
    },
    repository: { async resolveProductFolder() { return { name: 'MinhLab Toy', code: 'ML-P-001' }; }, async saveProductImage() {}, async hasPersistedProductImage() { return false; } },
  });
  await assert.rejects(service.uploadProductImage({ ...input, declaredMimeType: 'image/jpeg' }), /không khớp định dạng/);
  assert.equal(uploaded, false);
});

test('catalog image service removes the external asset when database persistence fails', async () => {
  const calls: string[] = [];
  const persistenceError = new Error('db unavailable');
  const service = createCatalogImageService({
    storage: {
      async upload() { calls.push('upload'); return asset; },
      async delete(publicId) { calls.push(`delete:${publicId}`); },
    },
    repository: {
      async resolveProductFolder() { return { name: 'MinhLab Toy', code: 'ML-P-001' }; },
      async saveProductImage() { throw persistenceError; },
      async hasPersistedProductImage() { return false; },
    },
  });
  await assert.rejects(service.uploadProductImage(input), (error) => error === persistenceError);
  assert.deepEqual(calls, ['upload', `delete:${asset.publicId}`]);
});

test('catalog image service reports when external compensation also fails', async () => {
  const service = createCatalogImageService({
    storage: {
      async upload() { return asset; },
      async delete() { throw new Error('provider detail'); },
    },
    repository: {
      async resolveProductFolder() { return { name: 'MinhLab Toy', code: 'ML-P-001' }; },
      async saveProductImage() { throw new Error('database failure'); },
      async hasPersistedProductImage() { return false; },
    },
  });
  await assert.rejects(service.uploadProductImage(input), (error) => error instanceof AppError && error.status === 502);
});

test('catalog image service does not delete a Cloudinary asset when a failed commit actually persisted it', async () => {
  let deleted = false;
  const service = createCatalogImageService({
    storage: {
      async upload() { return asset; },
      async delete() { deleted = true; },
    },
    repository: {
      async resolveProductFolder() { return { name: 'MinhLab Toy', code: 'ML-P-001' }; },
      async saveProductImage() { throw new Error('commit acknowledgement lost'); },
      async hasPersistedProductImage() { return true; },
    },
  });
  assert.deepEqual(await service.uploadProductImage(input), {
    url: asset.secureUrl,
    width: asset.width,
    height: asset.height,
    format: asset.format,
    bytes: asset.bytes,
  });
  assert.equal(deleted, false);
});

test('catalog image service keeps the Cloudinary asset when persistence outcome cannot be verified', async () => {
  let deleted = false;
  const service = createCatalogImageService({
    storage: {
      async upload() { return asset; },
      async delete() { deleted = true; },
    },
    repository: {
      async resolveProductFolder() { return { name: 'MinhLab Toy', code: 'ML-P-001' }; },
      async saveProductImage() { throw new Error('commit acknowledgement lost'); },
      async hasPersistedProductImage() { throw new Error('database unavailable'); },
    },
  });
  await assert.rejects(service.uploadProductImage(input), (error) => error instanceof AppError && error.status === 503);
  assert.equal(deleted, false);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { CATALOG_IMAGE_MAX_BYTES } from '../../contracts/catalog-admin';
import { validateCatalogImage } from '../../services/catalog/catalog-image-validation';

const png = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
]);

test('catalog image validation matches JPEG, PNG and WebP signatures to declared MIME types', () => {
  assert.equal(validateCatalogImage(Uint8Array.from([0xff, 0xd8, 0xff, ...new Array(9).fill(0)]), 'image/jpeg', 'a.jpg').format, 'jpg');
  assert.equal(validateCatalogImage(png, 'image/png', 'a.png').format, 'png');
  assert.equal(validateCatalogImage(Uint8Array.from([
    0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
  ]), 'image/webp', 'a.webp').format, 'webp');
});

test('catalog image validation rejects mismatched content, unsupported MIME and oversized input', () => {
  assert.throws(() => validateCatalogImage(png, 'image/jpeg', 'a.jpg'), /không khớp định dạng/);
  assert.throws(() => validateCatalogImage(png, 'image/svg+xml', 'a.svg'), /Chỉ nhận ảnh/);
  assert.throws(() => validateCatalogImage(new Uint8Array(CATALOG_IMAGE_MAX_BYTES + 1), 'image/png', 'a.png'), /vượt quá 5 MB/);
});

test('catalog image validation removes path separators and control characters from filenames', () => {
  assert.equal(validateCatalogImage(png, 'image/png', '../folder/\u0000image.png').originalFilename, '.._folder_image.png');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiErrorResponse } from '../api-response';
import { AppError } from '../errors';
import { parseProductInput, parsePublicationInput } from '../catalog-validation';
import {
  catalogSlug,
  isCatalogImage,
  publicationProblems,
} from '../../domain/catalog/catalog-policy';
import {
  catalogShippingFee,
  validOrderAmount,
  MAX_ORDER_TOTAL,
  validUnitPrice,
  MAX_UNIT_PRICE,
} from '../../domain/orders/checkout-pricing';
import { editableVariants } from '../../components/admin/catalog/product-form';

const product = () =>
  parseProductInput({
    categoryId: '12345678-1234-4123-8123-123456789abc',
    name: 'Mô hình Ếch & Đỏ',
    shortDescription: 'Mô tả',
    description: 'Chi tiết',
    material: 'PETG',
    leadTime: '',
    layerHeight: '',
    source: 'ORIGINAL',
    productionMode: 'IN_STOCK',
    featured: false,
    badge: null,
    sortOrder: 0,
    images: ['/images/product-placeholder.svg'],
    variants: [
      {
        name: 'Đỏ',
        color: 'Đỏ',
        hex: '#EB4037',
        price: 120000,
        originalPrice: null,
        status: 'ACTIVE',
      },
    ],
  });

test('catalogue shipping has the same 500,000 VND boundary in drawer, checkout and server', () => {
  assert.equal(catalogShippingFee(499999), 30000);
  assert.equal(catalogShippingFee(500000), 0);
  assert.equal(catalogShippingFee(500001), 0);
});
test('checkout rejects non-whole, unsafe and database-overflow totals', () => {
  for (const amount of [-1, NaN, Infinity, 1.5, MAX_ORDER_TOTAL + 1])
    assert.equal(validOrderAmount(amount), false);
  assert.equal(validOrderAmount(MAX_ORDER_TOTAL), true);
});
test('each persisted unit price is whole VND and fits numeric(12,2)', () => {
  for (const value of [-1, 0.5, NaN, Infinity, MAX_UNIT_PRICE + 1]) {
    assert.equal(validUnitPrice(value), false);
  }
  assert.equal(validUnitPrice(0), true);
  assert.equal(validUnitPrice(MAX_UNIT_PRICE), true);
});
test('product slugs remain ASCII and include an immutable database-issued code', () => {
  assert.equal(catalogSlug('Mô hình Ếch & Đỏ', 'ML-P-123'), 'mo-hinh-ech-do-ml-p-123');
  assert.equal(catalogSlug('日本', 'ML-P-124'), 'san-pham-ml-p-124');
});
test('public product images reject local traversal, credentials, custom ports and private hosts', () => {
  for (const value of [
    '/images/../env',
    '/images/%2e%2e/env',
    'https://user:pass@res.cloudinary.com/image',
    'https://res.cloudinary.com:444/image',
    'https://localhost/image',
    'data:image/png;base64,abc',
  ])
    assert.equal(isCatalogImage(value), false);
  assert.equal(isCatalogImage('/images/product-placeholder.svg'), true);
});
test('product parsing keeps only editable fields and validates money and unique choices', () => {
  const input = product();
  assert.equal(input.variants[0].lengthMm, null);
  const parsed = parseProductInput({
    ...input,
    code: 'FORGED',
    publication: 'PUBLISHED',
    revision: 999,
  });
  assert.equal('code' in parsed, false);
  assert.equal('publication' in parsed, false);
  assert.throws(() =>
    parseProductInput({ ...input, variants: [...input.variants, ...input.variants] }),
  );
  assert.throws(() =>
    parseProductInput({ ...input, variants: [{ ...input.variants[0], price: 0.5 }] }),
  );
});
test('publication requires complete content, a sellable variant and a review reason', () => {
  assert.deepEqual(publicationProblems(product()), []);
  const input = product();
  input.images = [];
  input.variants[0].status = 'INACTIVE';
  assert.equal(publicationProblems(input).length, 2);
  assert.throws(() => parsePublicationInput({ action: 'PUBLISH', revision: 1, note: '' }));
  assert.throws(() => parsePublicationInput({ action: 'PUBLISH', revision: 0, note: 'Reviewed' }));
});
test('retired SKU history does not fill the editor or consume the editable variant limit', () => {
  const variant = product().variants[0];
  const history = Array.from({ length: 35 }, () => ({ ...variant, status: 'INACTIVE' as const }));
  const unavailable = { ...variant, name: 'Hết hàng', status: 'OUT_OF_STOCK' as const };
  assert.deepEqual(editableVariants([...history, variant, unavailable]), [variant, unavailable]);
  assert.equal(history.length, 35);
});

test('API failures return a searchable request ID while logs and public errors omit exception details', async () => {
  const originalWrite = process.stderr.write;
  const lines: string[] = [];
  process.stderr.write = ((chunk: string | Uint8Array) => {
    lines.push(String(chunk));
    return true;
  }) as typeof process.stderr.write;
  try {
    const response = apiErrorResponse(Object.assign(new Error('secret token and private DB host'), { code: 'ECONNRESET' }), 'Có lỗi xảy ra.');
    const body = await response.json();
    assert.equal(response.status, 500);
    assert.match(body.requestId, /^[0-9a-f-]{36}$/i);
    assert.equal(response.headers.get('x-request-id'), body.requestId);
    assert.equal(body.error, 'Có lỗi xảy ra.');
    assert(!JSON.stringify(body).includes('secret token'));
    const entry = JSON.parse(lines[0]);
    assert.deepEqual(entry, { event: 'api_error', requestId: body.requestId, code: 'ECONNRESET', status: 500 });
    assert(!lines[0].includes('private DB host'));

    lines.length = 0;
    const expected = apiErrorResponse(new AppError('Dữ liệu chưa hợp lệ.', 400), 'Có lỗi xảy ra.');
    assert.equal(expected.status, 400);
    assert.equal(lines.length, 0);
  } finally {
    process.stderr.write = originalWrite;
  }
});

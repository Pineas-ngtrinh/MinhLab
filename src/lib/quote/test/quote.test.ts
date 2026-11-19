import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_QUOTE_CONFIG, DEFAULT_RATE_CARD } from '../config/defaults';
import { priceFdm } from '../pricing/pricing';
import { computeQuote, toCustomerQuoteView } from '../quote';
import { toReferenceQuoteView } from '../reference';
import { analyzeStl, type MeshFeatures } from '../stl/analyze';
import fixtures from './fixtures/reference-python.json';

const fixture = fixtures.shapes[0];
const mesh = () => analyzeStl(Buffer.from(fixture.stlBase64, 'base64'));
const params = { material: 'PLA', scale: 1, infill: 0.15 } as const;

test('electricity follows predicted hours: 50 g and 2 h costs 57,000 before shipping', () => {
  const oneHour = priceFdm(50, 3600, 'PLA', DEFAULT_RATE_CARD);
  const twoHours = priceFdm(50, 7200, 'PLA', DEFAULT_RATE_CARD);
  assert.equal(oneHour.materialVnd, 50000);
  assert.equal(oneHour.electricityVnd, 3500);
  assert.equal(twoHours.electricityVnd, 7000);
  assert.equal(twoHours.productVnd, 57000);
  assert.equal(twoHours.orderTotalVnd, 82000);
});

test('rounds only the final sum half up, with shipping free strictly above 300,000', () => {
  assert.equal(priceFdm(0.0004, 0.4114285714285714, 'PLA', DEFAULT_RATE_CARD).productVnd, 1);
  const atThreshold = priceFdm(293, 7200, 'PLA', DEFAULT_RATE_CARD);
  const above = priceFdm(293.001, 7200, 'PLA', DEFAULT_RATE_CARD);
  assert.equal(atThreshold.productVnd, 300000);
  assert.equal(atThreshold.shippingVnd, 25000);
  assert.equal(above.productVnd, 300001);
  assert.equal(above.shippingVnd, 0);
});

test('rejects missing, negative, non-finite or overflowing time and mass', () => {
  for (const value of [NaN, Infinity, -1, undefined as unknown as number]) {
    assert.throws(() => priceFdm(value, 3600, 'PLA', DEFAULT_RATE_CARD), RangeError);
    assert.throws(() => priceFdm(50, value, 'PLA', DEFAULT_RATE_CARD), RangeError);
  }
  assert.throws(() => priceFdm(Number.MAX_VALUE, 3600, 'PLA', DEFAULT_RATE_CARD), RangeError);
});

test('resource model is the default and approved order prices remain gated while advisory quotes use both outputs', () => {
  const quote = computeQuote(mesh(), params, DEFAULT_QUOTE_CONFIG);
  assert.equal(quote.modelVersion, 'minhlab-resource-physics-v1');
  assert.equal(quote.rateCardVersion, 'minhlab-vnd-2026-10-21-hourly-v2');
  assert.ok(quote.estimate.massG > 0);
  assert.ok(quote.estimate.timeS > 0);
  assert.equal(quote.customerVisiblePriceVnd, null);
  assert.deepEqual(toCustomerQuoteView(quote), { status: 'awaiting_review', price: null });
  const reference = toReferenceQuoteView(quote, 'PLA', DEFAULT_RATE_CARD);
  assert.equal(reference.status, 'ready');
  if (reference.status !== 'ready') return;
  assert.equal(reference.referencePriceVnd, quote.developerPreview.productVnd);
  assert.equal(reference.lowPriceVnd, priceFdm(quote.estimate.massRangeG[0], quote.estimate.timeRangeS[0], 'PLA', DEFAULT_RATE_CARD).productVnd);
  assert.equal(reference.highPriceVnd, priceFdm(quote.estimate.massRangeG[1], quote.estimate.timeRangeS[1], 'PLA', DEFAULT_RATE_CARD).productVnd);
});

test('every geometry or scope flag blocks advisory prices including incomplete topology', () => {
  for (const flag of ['OPEN_MESH', 'NON_MANIFOLD', 'INCONSISTENT_WINDING', 'INVERTED_NORMALS', 'DEGENERATE_TRIANGLES', 'SUSPICIOUS_UNITS', 'TOPOLOGY_SKIPPED'] as const) {
    const features = mesh(); features.flags.push(flag);
    assert.equal(toReferenceQuoteView(computeQuote(features, params, DEFAULT_QUOTE_CONFIG), 'PLA', DEFAULT_RATE_CARD).status, 'review');
  }
  const features: MeshFeatures = { ...mesh(), modelGeometry: undefined };
  const quote = computeQuote(features, params, DEFAULT_QUOTE_CONFIG);
  assert.ok(quote.flags.includes('MISSING_MODEL_GEOMETRY'));
  assert.equal(toReferenceQuoteView(quote, 'PLA', DEFAULT_RATE_CARD).status, 'review');
});

test('requires review outside trained scales without crashing for valid UI scales', () => {
  for (const scale of [0.01, 0.49, 1.51, 50]) {
    const quote = computeQuote(mesh(), { ...params, scale }, DEFAULT_QUOTE_CONFIG);
    assert.ok(quote.flags.includes('OUT_OF_TRAINING_RANGE'));
    assert.equal(toReferenceQuoteView(quote, 'PLA', DEFAULT_RATE_CARD).status, 'review');
  }
});

test('advisory review explains file issues without exposing numeric estimates', () => {
  const features = mesh();
  features.flags.push('OPEN_MESH', 'INCONSISTENT_WINDING', 'DEGENERATE_TRIANGLES', 'TOPOLOGY_SKIPPED');
  const reference = toReferenceQuoteView(computeQuote(features, params, DEFAULT_QUOTE_CONFIG), 'PLA', DEFAULT_RATE_CARD);
  assert.equal(reference.status, 'review');
  if (reference.status !== 'review') return;
  assert.match(reference.message, /Lưới STL bị hở/);
  assert.match(reference.message, /các mặt không đồng nhất hướng/);
  assert.match(reference.message, /Tệp STL có một số tam giác bị lỗi/);
  assert.match(reference.message, /Tệp lớn nên hệ thống chưa kiểm tra toàn bộ lưới/);
  assert.doesNotMatch(reference.message, /Giá là ước tính theo slicer/);
  assert.equal('massG' in reference, false);
  assert.equal('modelTimeHours' in reference, false);
  assert.equal('referencePriceVnd' in reference, false);

  const outOfRange = toReferenceQuoteView(computeQuote(mesh(), { ...params, scale: 0.49 }, DEFAULT_QUOTE_CONFIG), 'PLA', DEFAULT_RATE_CARD);
  assert.equal(outOfRange.status, 'review');
  if (outOfRange.status === 'review') assert.match(outOfRange.message, /ngoài phạm vi dữ liệu huấn luyện/);
});

test('keeps 5 mm brim on each side inside usable 170 mm XY, and 180 mm height', () => {
  const shape = mesh();
  const atEdge = { ...shape, bboxMm: { w: 160, d: 160, h: 180 } };
  const tooWide = { ...shape, bboxMm: { w: 160.01, d: 20, h: 40 } };
  const tooTall = { ...shape, bboxMm: { w: 20, d: 20, h: 180.01 } };
  assert.ok(!computeQuote(atEdge, params, DEFAULT_QUOTE_CONFIG).flags.includes('EXCEEDS_BUILD_VOLUME'));
  for (const shape of [tooWide, tooTall]) {
    const quote = computeQuote(shape, params, DEFAULT_QUOTE_CONFIG);
    assert.ok(quote.flags.includes('EXCEEDS_BUILD_VOLUME'));
    assert.equal(toReferenceQuoteView(quote, 'PLA', DEFAULT_RATE_CARD).status, 'review');
  }
});

test('profile mismatch and stale rate card cannot expose advisory prices', () => {
  const config = { ...DEFAULT_QUOTE_CONFIG, printer: { ...DEFAULT_QUOTE_CONFIG.printer, slicingProfileId: 'other-profile' } };
  const quote = computeQuote(mesh(), params, config);
  assert.ok(quote.flags.includes('OUT_OF_TRAINING_RANGE'));
  assert.equal(toReferenceQuoteView(quote, 'PLA', DEFAULT_RATE_CARD).status, 'review');
  const valid = computeQuote(mesh(), params, DEFAULT_QUOTE_CONFIG);
  const stale = toReferenceQuoteView(valid, 'PLA', { ...DEFAULT_RATE_CARD, version: 'stale' });
  assert.equal(stale.status, 'review');
  if (stale.status === 'review') assert.match(stale.message, /Bảng giá đã thay đổi.*tải lại trang/);
});

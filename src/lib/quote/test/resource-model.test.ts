import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeStl } from '../stl/analyze';
import { computeQuote } from '../quote';
import { DEFAULT_QUOTE_CONFIG, DEFAULT_RATE_CARD } from '../config/defaults';
import { predictRegression } from '../estimate/regression';
import { toReferenceQuoteView } from '../reference';
import type { InfillFraction, Material, PrinterConfig } from '../types';
import fixtures from './fixtures/resource-python.json';

function close(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) <= Math.max(1e-8, Math.abs(expected) * 1e-9), `${actual} != ${expected}`);
}

test('default resource coefficients match the independently exported Python parity fixtures', () => {
  assert.equal(DEFAULT_QUOTE_CONFIG.model.version, 'minhlab-resource-physics-v1');
  const bytes = readFileSync(join(__dirname, '../config/model_resource_v1.json'));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), fixtures.sourceModelSha256);
});

for (const fixture of fixtures.shapes) {
  test(`physical resource Python parity: ${fixture.name}`, () => {
    const mesh = analyzeStl(Buffer.from(fixture.stlBase64, 'base64'));
    for (const expected of fixture.expected) {
      const quote = computeQuote(mesh, { material: expected.material as Material, infill: expected.infill as InfillFraction, scale: expected.scale }, DEFAULT_QUOTE_CONFIG);
      close(quote.estimate.massG, expected.grams);
      close(quote.estimate.timeS / 60, expected.minutes);
      assert.equal(quote.needsReview, true);
      assert.equal(quote.customerVisiblePriceVnd, null);
    }
  });
}

test('resource quantities are independent of store prices', () => {
  const mesh = analyzeStl(Buffer.from(fixtures.shapes[0].stlBase64, 'base64'));
  const params = { material: 'PLA' as const, infill: 0.15 as const, scale: 1 };
  const a = computeQuote(mesh, params, DEFAULT_QUOTE_CONFIG);
  const b = computeQuote(mesh, params, { ...DEFAULT_QUOTE_CONFIG, rateCard: { ...DEFAULT_RATE_CARD, pricePerGramVnd: { ...DEFAULT_RATE_CARD.pricePerGramVnd, PLA: DEFAULT_RATE_CARD.pricePerGramVnd.PLA * 2 }, electricityVndPerHour: DEFAULT_RATE_CARD.electricityVndPerHour * 3 } });
  assert.equal(a.estimate.massG, b.estimate.massG);
  assert.equal(a.estimate.timeS, b.estimate.timeS);
  assert.notEqual(a.developerPreview.productVnd, b.developerPreview.productVnd);
});

test('unsupported profile changes are reviewed even when the profile ID was not changed', () => {
  const mesh = analyzeStl(Buffer.from(fixtures.shapes[0].stlBase64, 'base64'));
  const changes: Partial<PrinterConfig>[] = [{ layerHeightMm: 0.3 }, { nozzleDiameterMm: 0.6 }, { supports: 'off' }, { slicerVersion: 'different' }];
  for (const change of changes) {
    const config = { ...DEFAULT_QUOTE_CONFIG, printer: { ...DEFAULT_QUOTE_CONFIG.printer, ...change } };
    const quote = computeQuote(mesh, { material: 'PLA', infill: 0.15, scale: 1 }, config);
    assert.ok(quote.flags.includes('OUT_OF_TRAINING_RANGE'));
    assert.equal(toReferenceQuoteView(quote, 'PLA', config.rateCard).status, 'review');
  }
});

test('larger scale and infill cannot reduce predicted resources for a fixed material/profile', () => {
  const mesh = analyzeStl(Buffer.from(fixtures.shapes[0].stlBase64, 'base64'));
  for (const material of ['PLA', 'PETG', 'TPU'] as const) {
    const scales = [0.5, 1, 1.5].map(scale => computeQuote(mesh, { material, infill: 0.15, scale }, DEFAULT_QUOTE_CONFIG).estimate);
    const infills = ([0.15, 0.4, 0.8] as const).map(infill => computeQuote(mesh, { material, infill, scale: 1 }, DEFAULT_QUOTE_CONFIG).estimate);
    for (const estimates of [scales, infills]) for (let index = 1; index < estimates.length; index++) {
      assert.ok(estimates[index].massG >= estimates[index - 1].massG - 1e-9);
      assert.ok(estimates[index].timeS >= estimates[index - 1].timeS - 1e-9);
    }
  }
});

test('corrupt resource coefficients cannot yield a usable estimate', () => {
  const target = DEFAULT_QUOTE_CONFIG.model.targets.grams;
  assert.ok('feature_scales' in target);
  const features = Object.fromEntries(target.feature_names.map(name => [name, 1]));
  assert.throws(() => predictRegression({ ...target, coefficients: target.coefficients.map(() => NaN) }, features), /không hợp lệ/);
  assert.throws(() => predictRegression({ ...target, feature_scales: target.feature_scales.map(() => 0) }, features), /không hợp lệ/);
});

test('changing the configured machine height does not expand the trained model scope', () => {
  const bytes = Buffer.from(fixtures.shapes[0].stlBase64, 'base64');
  const original = analyzeStl(bytes);
  const ratio = 190 / original.bboxMm.h;
  for (let triangle = 0; triangle < bytes.readUInt32LE(80); triangle++) {
    for (let vertex = 0; vertex < 3; vertex++) {
      const offset = 84 + triangle * 50 + 12 + vertex * 12 + 8;
      bytes.writeFloatLE(bytes.readFloatLE(offset) * ratio, offset);
    }
  }
  const mesh = analyzeStl(bytes);
  const config = { ...DEFAULT_QUOTE_CONFIG, printer: { ...DEFAULT_QUOTE_CONFIG.printer, buildVolumeMm: { w: 180, d: 180, h: 400 } } };
  const quote = computeQuote(mesh, { material: 'PLA', infill: 0.15, scale: 1 }, config);
  assert.ok(quote.flags.includes('EXCEEDS_BUILD_VOLUME'));
  assert.equal(toReferenceQuoteView(quote, 'PLA', config.rateCard).status, 'review');
});

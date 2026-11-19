import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeStl } from '../stl/analyze';
import { computeQuote } from '../quote';
import { V3_QUOTE_CONFIG as DEFAULT_QUOTE_CONFIG } from '../config/defaults';
import type { InfillFraction, Material } from '../types';
import fixtures from './fixtures/v3-python.json';

function close(actual: number, expected: number, name: string): void {
  assert.ok(Math.abs(actual - expected) <= Math.max(1e-8, Math.abs(expected) * 1e-9), `${name}: ${actual} != ${expected}`);
}

test('bundled coefficients are an unchanged copy of the Python v3 model', () => {
  const bytes = readFileSync(join(__dirname, '../config/model_v3.json'));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), fixtures.sourceModelSha256);
});

for (const fixture of fixtures.shapes) {
  test(`Python parity for ${fixture.name}: geometry, 3 materials, 3 infills and 3 scales`, () => {
    const features = analyzeStl(Buffer.from(fixture.stlBase64, 'base64'));
    assert.deepEqual(features.flags, []);
    assert.ok(features.modelGeometry);
    for (const [key, value] of Object.entries(fixture.geometry)) {
      close(features.modelGeometry[key as keyof typeof features.modelGeometry], value, key);
    }
    for (const expected of fixture.expected) {
      const quote = computeQuote(features, { material: expected.material as Material,
        infill: expected.infill as InfillFraction, scale: expected.scale }, DEFAULT_QUOTE_CONFIG);
      close(quote.estimate.massG, expected.grams, 'grams');
      close(quote.estimate.timeS / 60, expected.minutes, 'minutes');
      close(quote.developerPreview.materialVnd, expected.material_vnd, 'material');
      close(quote.developerPreview.electricityVnd, expected.electricity_vnd, 'electricity');
      assert.equal(quote.developerPreview.productVnd, expected.product_vnd);
      assert.equal(quote.developerPreview.shippingVnd, expected.shipping_vnd);
      assert.equal(quote.developerPreview.orderTotalVnd, expected.order_vnd);
    }
  });
}

test('inconsistent face directions require review even on a closed surface', () => {
  const bytes = Buffer.from(fixtures.shapes[0].stlBase64, 'base64');
  const first = Buffer.from(bytes.subarray(96, 108));
  bytes.copy(bytes, 96, 108, 120); first.copy(bytes, 108);
  assert.ok(analyzeStl(bytes).flags.includes('INCONSISTENT_WINDING'));
});

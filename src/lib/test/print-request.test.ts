import assert from 'node:assert/strict';
import { test } from 'node:test';
import { copyTextToClipboard } from '../clipboard';
import { resolvePrintFileDimensions } from '../../components/print-request/print-file-dimensions';
import { estimatePrintQuantity, parsePrintQuantity } from '../../components/print-request/print-request-quantity';
import type { ReferenceQuoteView } from '../quote';
import { describePrintSettings, formatPrintDuration } from '../../components/print-request/print-request-settings';

const unitQuote: ReferenceQuoteView = {
  status: 'ready', referencePriceVnd: 12345, lowPriceVnd: 10001, highPriceVnd: 15001,
  lowDeltaPercent: 19, highDeltaPercent: 22, massG: 10, modelTimeHours: 1,
  materialVnd: 12000, electricityVnd: 345,
};

test('multiple copies preserve the displayed unit price and multiply both ends of its estimate', () => {
  assert.deepEqual(estimatePrintQuantity(unitQuote, '3'), {
    quantity: 3, referencePriceVnd: 37035, lowPriceVnd: 30003, highPriceVnd: 45003,
  });
  assert.equal(unitQuote.referencePriceVnd, 12345);
  assert.equal(estimatePrintQuantity(unitQuote, '1')?.referencePriceVnd, 12345);
  assert.equal(estimatePrintQuantity(unitQuote, '100')?.referencePriceVnd, 1234500);
});

test('invalid quantities never produce totals for a print request', () => {
  for (const value of ['', ' ', '0', '-1', '1.5', '101', 'Infinity', 'NaN', 'abc']) {
    assert.equal(parsePrintQuantity(value), null, value);
    assert.equal(estimatePrintQuantity(unitQuote, value), null, value);
  }
});

test('requests awaiting file analysis or staff review cannot show a numeric total', () => {
  assert.equal(estimatePrintQuantity(null, '3'), null);
  assert.equal(estimatePrintQuantity({ status: 'review', message: 'Xưởng cần kiểm tra' }, '3'), null);
});

test('worker measurements preserve STL axes and units when WebGL cannot provide dimensions', () => {
  assert.deepEqual(resolvePrintFileDimensions(null, { bboxMm: { w: 12.345, d: 67.89, h: 23.456 } }), {
    x: 12.345, y: 67.89, z: 23.456,
  });
});

test('preview measurements keep existing behavior when available', () => {
  assert.deepEqual(resolvePrintFileDimensions({ x: 10, y: 20, z: 30 }, { bboxMm: { w: 11, d: 21, h: 31 } }), {
    x: 10, y: 20, z: 30,
  });
});

test('pending or invalid analysis cannot produce usable model dimensions', () => {
  assert.equal(resolvePrintFileDimensions(null, null), null);
  for (const w of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(resolvePrintFileDimensions(null, { bboxMm: { w, d: 20, h: 30 } }), null);
  }
});

test('copy waits for browser acknowledgement and preserves the complete Vietnamese summary', async () => {
  const text = 'Yêu cầu in MinhLab\nKích thước: 12 × 20 × 30 mm';
  let acknowledge: (() => void) | undefined;
  let completed = false;
  const result = copyTextToClipboard(text, {
    writeText(value) {
      assert.equal(value, text);
      return new Promise<void>((resolve) => { acknowledge = resolve; });
    },
  }).then((success) => { completed = true; return success; });
  await Promise.resolve();
  assert.equal(completed, false);
  assert.ok(acknowledge);
  acknowledge();
  assert.equal(await result, true);
});

test('denied and unavailable clipboard report failure, allowing a truthful retry', async () => {
  assert.equal(await copyTextToClipboard('summary'), false);
  assert.equal(await copyTextToClipboard('summary', {
    writeText: async () => { throw new Error('Permission denied'); },
  }), false);
  assert.equal(await copyTextToClipboard('summary', { writeText: async () => {} }), true);
});

test('official print requests preserve selected scale, infill and layer settings for staff', () => {
  const purpose = describePrintSettings('Mô hình kiến trúc', '75', '80', '0.20mm · mặc định');
  assert.ok(purpose.includes('Tỷ lệ mong muốn: 75%'));
  assert.ok(purpose.includes('Mật độ ruột: 80%'));
  assert.ok(purpose.includes('Chiều cao lớp: 0.20mm'));
  assert.ok(purpose.includes('Mô hình kiến trúc'));
});

test('print time uses hours and minutes consistently without presenting an invalid duration', () => {
  assert.equal(formatPrintDuration(1.5), '1 giờ 30 phút');
  assert.equal(formatPrintDuration(1), '1 giờ');
  assert.equal(formatPrintDuration(59.8 / 60), '1 giờ');
  assert.equal(formatPrintDuration(12 / 60), '12 phút');
  assert.equal(formatPrintDuration(0.1 / 60), 'Dưới 1 phút');
  for (const value of [0, -1, NaN, Infinity]) assert.equal(formatPrintDuration(value), 'Chưa xác định');
});

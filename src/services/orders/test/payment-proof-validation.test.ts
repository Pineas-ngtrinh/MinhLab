import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../../../lib/errors';
import { readPaymentProofImage } from '../payment-proof-validation';

const validJpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

test('private payment proof accepts a supported image only when MIME and file signature match', async () => {
  const request = new Request('https://minhlab.local/api/orders/ML-1/payment-proof', {
    method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: validJpeg,
  });
  const proof = await readPaymentProofImage(request, 5 * 1024 * 1024);
  assert.equal(proof.format, 'jpg');
  assert.equal(proof.mimeType, 'image/jpeg');
  assert.equal(proof.bytes.byteLength, validJpeg.byteLength);
});

test('private payment proof rejects unsupported, mismatched and oversized image bodies', async () => {
  const unsupported = new Request('https://minhlab.local/upload', {
    method: 'POST', headers: { 'Content-Type': 'image/svg+xml' }, body: validJpeg,
  });
  await assert.rejects(readPaymentProofImage(unsupported, 5 * 1024 * 1024),
    (error: unknown) => error instanceof AppError && error.status === 400);

  const mismatch = new Request('https://minhlab.local/upload', {
    method: 'POST', headers: { 'Content-Type': 'image/png' }, body: validJpeg,
  });
  await assert.rejects(readPaymentProofImage(mismatch, 5 * 1024 * 1024), /không khớp định dạng/);

  const oversized = new Request('https://minhlab.local/upload', {
    method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: new Uint8Array(13),
  });
  await assert.rejects(readPaymentProofImage(oversized, 12),
    (error: unknown) => error instanceof AppError && error.status === 413);
});

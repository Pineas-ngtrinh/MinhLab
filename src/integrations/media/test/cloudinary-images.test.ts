import assert from 'node:assert/strict';
import test from 'node:test';
import { cloudinaryImages } from '../cloudinary-images';
import { AppError } from '../../../lib/errors';

const config = { cloudName: 'test-cloud', apiKey: 'test-api-key', apiSecret: 'synthetic-test-secret' };
const input = {
  productName: 'Black b-daman',
  productCode: 'ML-P-002',
  bytes: Uint8Array.from([1, 2, 3, 4]),
  filename: 'front.png',
  mimeType: 'image/png',
  format: 'png' as const,
};

test('Cloudinary adapter authenticates server-side and validates the returned public image asset', async () => {
  let authorization = '';
  const captured: { form: FormData | null } = { form: null };
  const fetcher: typeof fetch = async (_url, init) => {
    authorization = new Headers(init?.headers).get('authorization') ?? '';
    captured.form = init?.body instanceof FormData ? init.body : null;
    return new Response(JSON.stringify({
      public_id: 'minhlab_product/black-b-daman__ml-p-002/fixed-id',
      secure_url: 'https://res.cloudinary.com/test-cloud/image/upload/v1/minhlab_product/black-b-daman__ml-p-002/fixed-id.png',
      width: 320,
      height: 240,
      bytes: 4,
      format: 'png',
    }), { status: 200 });
  };

  const result = await cloudinaryImages.upload(config, input, fetcher, () => 'fixed-id');
  assert.match(authorization, /^Basic /);
  assert.equal(result.publicId, 'minhlab_product/black-b-daman__ml-p-002/fixed-id');
  assert.equal(captured.form?.get('asset_folder'), 'minhlab_product/Black b-daman__ML-P-002');
  assert.equal(captured.form?.get('public_id'), result.publicId);
  assert.equal(result.width, 320);
  assert.equal(result.height, 240);
  assert.equal(result.format, 'png');
  assert.equal(result.sha256.length, 64);
});

test('Cloudinary adapter deletes the reserved asset when provider metadata is invalid', async () => {
  const requests: Array<{ url: string; form: FormData | null }> = [];
  let calls = 0;
  const fetcher: typeof fetch = async (url, init) => {
    calls += 1;
    const form = init?.body instanceof FormData ? init.body : null;
    requests.push({ url: String(url), form });
    return calls === 1
      ? new Response(JSON.stringify({ public_id: 'unexpected', secure_url: 'https://example.com/image.png' }), { status: 200 })
      : new Response(JSON.stringify({ result: 'ok' }), { status: 200 });
  };

  await assert.rejects(cloudinaryImages.upload(config, input, fetcher, () => 'fixed-id'), /CLOUDINARY_INVALID_RESPONSE/);
  assert.equal(requests.length, 2);
  assert.match(requests[1].url, /\/image\/destroy$/);
  assert.equal(requests[1].form?.get('public_id'), 'minhlab_product/black-b-daman__ml-p-002/fixed-id');
});

test('Cloudinary adapter maps provider failures to bounded errors', async () => {
  const fetcher: typeof fetch = async () => new Response('provider detail must not escape', { status: 500 });
  await assert.rejects(cloudinaryImages.upload(config, input, fetcher, () => 'fixed-id'), /CLOUDINARY_UPLOAD_FAILED/);
});

test('Cloudinary permission denial gives an actionable error without exposing provider details', async () => {
  const fetcher: typeof fetch = async () => new Response(JSON.stringify({
    error: { message: 'Request forbidden due to missing permissions; private-provider-detail' },
  }), { status: 403 });
  await assert.rejects(cloudinaryImages.upload(config, input, fetcher), (error: unknown) => {
    assert(error instanceof AppError);
    assert.equal(error.status, 502);
    assert.match(error.message, /create/);
    assert.match(error.message, /minhlab_product/);
    assert.doesNotMatch(error.message, /private-provider-detail|test-api-key|synthetic-test-secret/);
    return true;
  });
});

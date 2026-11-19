import { createHash, randomUUID } from 'node:crypto';
import { CATALOG_IMAGE_MAX_BYTES, type CatalogImageFormat } from '../../contracts/catalog-admin';
import { AppError } from '../../lib/errors';

export interface CloudinaryImageConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export interface UploadedCloudinaryImage {
  publicId: string;
  secureUrl: string;
  width: number;
  height: number;
  format: CatalogImageFormat;
  bytes: number;
  sha256: string;
}

export interface CloudinaryImageUploadInput {
  productName: string;
  productCode: string;
  bytes: Uint8Array;
  filename: string;
  mimeType: string;
  format: CatalogImageFormat;
}

type Fetcher = typeof fetch;

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function authorization(config: CloudinaryImageConfig): string {
  return `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')}`;
}

function uploadUrl(config: CloudinaryImageConfig): string {
  return `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/upload`;
}

function destroyUrl(config: CloudinaryImageConfig): string {
  return `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/image/destroy`;
}

function folderSegment(value: string): string {
  const safe = value
    .normalize('NFC')
    .replace(/[\\/]/g, '-')
    .replace(/[^\p{L}\p{N}._ -]/gu, '-')
    .replace(/\s+/g, ' ')
    .replace(/-{2,}/g, '-')
    .replace(/^[. ]+|[. ]+$/g, '')
    .slice(0, 80);
  return /^v\d/i.test(safe) ? `product-${safe}` : safe || 'san-pham';
}

function productFolder(input: Pick<CloudinaryImageUploadInput, 'productName' | 'productCode'>): string {
  return `minhlab_product/${folderSegment(input.productName)}__${folderSegment(input.productCode)}`;
}

function publicIdFolder(input: Pick<CloudinaryImageUploadInput, 'productName' | 'productCode'>): string {
  const slug = (value: string, maxLength: number) => value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, maxLength)
    .replace(/-$/g, '') || 'san-pham';
  return `minhlab_product/${slug(input.productName, 72)}__${slug(input.productCode, 24)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function verifiedSecureUrl(value: unknown, config: CloudinaryImageConfig): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'res.cloudinary.com' &&
      !url.username && !url.password && !url.port &&
      url.pathname.startsWith(`/${config.cloudName}/image/upload/`);
  } catch {
    return false;
  }
}

async function destroy(config: CloudinaryImageConfig, publicId: string, fetcher: Fetcher): Promise<void> {
  const form = new FormData();
  form.set('public_id', publicId);
  form.set('invalidate', 'true');
  const response = await fetcher(destroyUrl(config), {
    method: 'POST',
    headers: { Authorization: authorization(config) },
    body: form,
    signal: AbortSignal.timeout(15_000),
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok || !isRecord(data) || !['ok', 'not found'].includes(String(data.result))) {
    throw new Error('CLOUDINARY_DELETE_FAILED');
  }
}

export const cloudinaryImages = {
  async upload(
    config: CloudinaryImageConfig,
    input: CloudinaryImageUploadInput,
    fetcher: Fetcher = fetch,
    createId: () => string = randomUUID,
  ): Promise<UploadedCloudinaryImage> {
    if (input.bytes.byteLength > CATALOG_IMAGE_MAX_BYTES) throw new Error('IMAGE_TOO_LARGE');
    const folder = productFolder(input);
    const publicId = `${publicIdFolder(input)}/${createId()}`;
    const form = new FormData();
    form.set('public_id', publicId);
    form.set('asset_folder', folder);
    form.set('overwrite', 'false');
    form.set('allowed_formats', 'jpg,png,webp');
    const blob = new Blob([Uint8Array.from(input.bytes)], { type: input.mimeType });
    form.set('file', blob, input.filename);

    const response = await fetcher(uploadUrl(config), {
      method: 'POST',
      headers: { Authorization: authorization(config) },
      body: form,
      signal: AbortSignal.timeout(15_000),
    }).catch(() => { throw new Error('CLOUDINARY_UNAVAILABLE'); });
    const data: unknown = await response.json().catch(() => null);
    if (response.status === 403) {
      throw new AppError(
        'Cloudinary từ chối tải ảnh. Hãy kiểm tra quyền tạo ảnh (create) và quyền thư mục minhlab_product của API key.',
        502,
      );
    }
    if (!response.ok) throw new Error('CLOUDINARY_UPLOAD_FAILED');

    if (!isRecord(data)) {
      try { await destroy(config, publicId, fetcher); } catch { /* Report the bounded provider error below. */ }
      throw new Error('CLOUDINARY_INVALID_RESPONSE');
    }

    const secureUrl = data.secure_url;
    const width = data.width;
    const height = data.height;
    const uploadedBytes = data.bytes;
    if (
      data.public_id !== publicId ||
      !verifiedSecureUrl(secureUrl, config) ||
      !isPositiveSafeInteger(width) || !isPositiveSafeInteger(height) ||
      !isPositiveSafeInteger(uploadedBytes) || uploadedBytes > CATALOG_IMAGE_MAX_BYTES ||
      data.format !== input.format
    ) {
      try { await destroy(config, publicId, fetcher); } catch { /* Report the bounded provider error below. */ }
      throw new Error('CLOUDINARY_INVALID_RESPONSE');
    }

    return {
      publicId,
      secureUrl,
      width,
      height,
      format: input.format,
      bytes: uploadedBytes,
      sha256: createHash('sha256').update(input.bytes).digest('hex'),
    };
  },

  async delete(config: CloudinaryImageConfig, publicId: string, fetcher: Fetcher = fetch): Promise<void> {
    await destroy(config, publicId, fetcher);
  },
};

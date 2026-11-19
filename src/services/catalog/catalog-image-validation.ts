import { inspectSupportedImage, type ValidatedImage } from '../../domain/media/image-validation';
import { CATALOG_IMAGE_MAX_BYTES, type CatalogImageFormat } from '../../contracts/catalog-admin';
import { AppError } from '../../lib/errors';

export type ValidatedCatalogImage = ValidatedImage & { format: CatalogImageFormat };

export function validateCatalogImage(
  bytes: Uint8Array,
  declaredMimeType: string,
  filename: string,
): ValidatedCatalogImage {
  const result = inspectSupportedImage(bytes, declaredMimeType, filename, CATALOG_IMAGE_MAX_BYTES);
  if (result.valid) return result.image;
  if (result.reason === 'TOO_LARGE') throw new AppError('Ảnh rỗng, không hợp lệ hoặc vượt quá 5 MB.', 413);
  if (result.reason === 'UNSUPPORTED_MIME') throw new AppError('Chỉ nhận ảnh JPEG, PNG hoặc WebP.');
  if (result.reason === 'INVALID_FILENAME') throw new AppError('Tên tệp ảnh không hợp lệ.');
  if (result.reason === 'EMPTY') throw new AppError('Ảnh rỗng hoặc không hợp lệ.');
  throw new AppError('Nội dung tệp không khớp định dạng ảnh được hỗ trợ.');
}

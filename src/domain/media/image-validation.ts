export type SupportedImageFormat = 'jpg' | 'png' | 'webp';
export type SupportedImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp';
export interface ValidatedImage {
  format: SupportedImageFormat;
  mimeType: SupportedImageMimeType;
  originalFilename: string;
}
export type ImageValidationFailure = 'EMPTY' | 'TOO_LARGE' | 'UNSUPPORTED_MIME' | 'SIGNATURE_MISMATCH' | 'INVALID_FILENAME';
export type ImageValidationResult =
  | { valid: true; image: ValidatedImage }
  | { valid: false; reason: ImageValidationFailure };

const ACCEPTED_TYPES = new Set<SupportedImageMimeType>(['image/jpeg', 'image/png', 'image/webp']);

export function inspectSupportedImage(
  bytes: Uint8Array,
  declaredMimeType: string,
  filename: string,
  maxBytes: number,
): ImageValidationResult {
  if (bytes.byteLength < 12) return { valid: false, reason: 'EMPTY' };
  if (bytes.byteLength > maxBytes) return { valid: false, reason: 'TOO_LARGE' };
  if (!ACCEPTED_TYPES.has(declaredMimeType as SupportedImageMimeType)) return { valid: false, reason: 'UNSUPPORTED_MIME' };

  let format: SupportedImageFormat;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) format = 'jpg';
  else if (
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) format = 'png';
  else if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) format = 'webp';
  else return { valid: false, reason: 'SIGNATURE_MISMATCH' };

  const mimeType: SupportedImageMimeType = format === 'jpg' ? 'image/jpeg' : `image/${format}`;
  if (declaredMimeType !== mimeType) return { valid: false, reason: 'SIGNATURE_MISMATCH' };
  const originalFilename = filename
    .replace(/[\\/]/g, '_')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 255);
  if (!originalFilename) return { valid: false, reason: 'INVALID_FILENAME' };
  return { valid: true, image: { format, mimeType, originalFilename } };
}

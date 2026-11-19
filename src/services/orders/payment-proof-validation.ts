import { AppError } from '../../lib/errors';
import { inspectSupportedImage } from '../../domain/media/image-validation';
import { PAYMENT_PROOF_MAX_BYTES } from '../../contracts/payment-proof';

export async function readPaymentProofImage(request: Request, configuredMaxBytes: number) {
  const mimeType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() ?? '';
  const maxBytes = Math.min(PAYMENT_PROOF_MAX_BYTES, configuredMaxBytes);
  if (!request.body || !Number.isSafeInteger(maxBytes) || maxBytes < 12) {
    throw new AppError('Kho ảnh biên lai chưa được cấu hình hoặc dữ liệu không hợp lệ.', 503);
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new AppError('Ảnh biên lai vượt quá giới hạn 5 MB.', 413);
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType.slice('image/'.length);
  const result = inspectSupportedImage(bytes, mimeType, `payment-proof.${extension}`, maxBytes);
  if (!result.valid) {
    if (result.reason === 'TOO_LARGE') throw new AppError('Ảnh biên lai vượt quá giới hạn 5 MB.', 413);
    if (result.reason === 'EMPTY') throw new AppError('Ảnh biên lai rỗng hoặc không hợp lệ.');
    if (result.reason === 'UNSUPPORTED_MIME') throw new AppError('Chỉ nhận ảnh JPEG, PNG hoặc WebP.');
    throw new AppError('Nội dung ảnh biên lai không khớp định dạng đã khai báo.');
  }
  return { ...result.image, bytes };
}

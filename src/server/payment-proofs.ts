import { AppError } from '../lib/errors';
import { hashToken } from '../services/orders/checkout-idempotency';
import { readPaymentProofImage } from '../services/orders/payment-proof-validation';
import { OrderService } from './orders';
import { privateFileConfig, privateFileStream, removePrivateFile, storePrivateImage } from '../integrations/private-files/local-store';
import { paymentProofRepository } from '../repositories/orders/payment-proof.repository';
import { privateFiles } from '../repositories/print-requests/private-file.repository';
import { withTransaction } from '../lib/db';

export async function uploadPaymentProof(input: {
  request: Request;
  orderNumber: string;
  trackingToken?: string;
  customerId?: string;
}) {
  const order = await OrderService.getOrderByNumber(input.orderNumber, input.trackingToken, input.customerId);
  if (!order) throw new AppError('Không tìm thấy đơn hàng hoặc bạn không có quyền khai báo thanh toán.', 404);
  if (order.order.order_status !== 'PENDING_PAYMENT' || order.order.payment_status !== 'UNPAID' || !order.payment) {
    throw new AppError('Chỉ nhận biên lai khi đơn còn chờ thanh toán.', 409);
  }

  const config = privateFileConfig();
  if (!config) throw new AppError('Kho ảnh biên lai riêng tư chưa được cấu hình tại xưởng.', 503);
  const image = await readPaymentProofImage(input.request, config.maxBytes);
  const stored = await storePrivateImage(image.bytes, image.format, config);
  const uploadedBy = input.customerId && order.order.customer_id === input.customerId ? input.customerId : null;
  const trackingTokenHash = uploadedBy === null && input.trackingToken ? hashToken(input.trackingToken) : null;

  try {
    return await withTransaction(async (client) => {
      if (uploadedBy) {
        const used = await privateFiles.usage(client, uploadedBy);
        if (used + stored.bytes > config.quotaBytes) {
          throw new AppError('Không còn đủ quota lưu trữ riêng tư cho ảnh biên lai.', 409);
        }
      }
      const saved = await paymentProofRepository.attach(client, {
        orderNumber: input.orderNumber,
        uploadedBy,
        trackingTokenHash,
        key: stored.key,
        filename: image.originalFilename,
        extension: image.format,
        mimeType: image.mimeType,
        byteSize: stored.bytes,
        sha256: stored.sha256,
        retentionDays: config.retentionDays,
      });
      return { id: saved.id, scanStatus: 'PENDING' as const };
    });
  } catch (error) {
    let attached = true;
    try {
      attached = await paymentProofRepository.existsByKey(stored.key);
    } catch {
      // Keep the local file if commit status cannot be verified; cleanup can reconcile it later.
    }
    if (!attached) await removePrivateFile(config, stored.key).catch(() => {});
    throw error;
  }
}

export async function downloadPaymentProof(paymentId: string, assetId: string) {
  const proof = await paymentProofRepository.authorizedDownload(paymentId, assetId);
  if (!proof) throw new AppError('Không tìm thấy biên lai hoặc bạn không có quyền xem.', 404);
  if (proof.upload_status !== 'AVAILABLE' || proof.malware_scan_status !== 'CLEAN') {
    throw new AppError('Ảnh biên lai đang được kiểm tra an toàn; hãy thử lại sau.', 409);
  }
  const config = privateFileConfig();
  if (!config) throw new AppError('Kho file private chưa được cấu hình.', 503);
  return {
    body: privateFileStream(config, proof.object_key),
    bytes: Number(proof.byte_size),
    mimeType: proof.mime_type,
    extension: proof.file_extension,
  };
}

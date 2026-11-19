import type { PoolClient } from 'pg';
import { query } from '../../lib/db';
import { AppError } from '../../lib/errors';

export interface NewPrivatePaymentProof {
  orderNumber: string;
  uploadedBy: string | null;
  trackingTokenHash: string | null;
  key: string;
  filename: string;
  extension: 'jpg' | 'png' | 'webp';
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  byteSize: number;
  sha256: string;
  retentionDays: number;
}

export const paymentProofRepository = {
  async attach(c: PoolClient, input: NewPrivatePaymentProof) {
    const order = (await c.query<{
      id: string;
      customer_id: string | null;
      order_status: string;
      payment_status: string;
    }>('SELECT id,customer_id,order_status,payment_status FROM orders WHERE order_number=$1 FOR UPDATE', [input.orderNumber])).rows[0];
    if (!order) throw new AppError('Không tìm thấy đơn hàng hoặc bạn không có quyền khai báo thanh toán.', 404);
    const ownerAllowed = input.uploadedBy !== null && order.customer_id === input.uploadedBy;
    const trackingAllowed = input.uploadedBy === null && input.trackingTokenHash !== null && (await c.query<{ allowed: boolean }>(
      `SELECT EXISTS(SELECT 1 FROM order_tracking_tokens WHERE order_id=$1 AND token_hash=$2 AND expires_at>clock_timestamp()) AS allowed`,
      [order.id, input.trackingTokenHash],
    )).rows[0]?.allowed === true;
    if (!ownerAllowed && !trackingAllowed) throw new AppError('Không tìm thấy đơn hàng hoặc bạn không có quyền khai báo thanh toán.', 404);
    if (order.order_status !== 'PENDING_PAYMENT' || order.payment_status !== 'UNPAID') {
      throw new AppError('Chỉ nhận biên lai khi đơn còn chờ thanh toán.', 409);
    }
    const payment = (await c.query<{
      id: string;
      verification_status: string;
    }>(`SELECT id,verification_status FROM payments WHERE order_id=$1
        ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE`, [order.id])).rows[0];
    if (!payment || !['PENDING', 'REJECTED'].includes(payment.verification_status)) {
      throw new AppError('Khoản thanh toán hiện không nhận thêm biên lai.', 409);
    }

    const current = (await c.query<{
      storage_provider: string;
      upload_status: string;
    }>(`SELECT f.storage_provider,f.upload_status FROM attachments a
        JOIN file_assets f ON f.id=a.file_asset_id
        WHERE a.entity_type='PAYMENT' AND a.entity_id=$1 AND a.purpose='PAYMENT_PROOF' AND a.is_current=true
        ORDER BY a.created_at DESC,a.id DESC LIMIT 1 FOR UPDATE OF a,f`, [payment.id])).rows[0];
    if (current?.storage_provider === 'LOCAL_PRIVATE' && ['STORED', 'AVAILABLE'].includes(current.upload_status)) {
      throw new AppError('Đơn đã có biên lai đang được lưu hoặc kiểm tra.', 409);
    }
    await c.query(`UPDATE attachments SET is_current=false
      WHERE entity_type='PAYMENT' AND entity_id=$1 AND purpose='PAYMENT_PROOF' AND is_current=true`, [payment.id]);

    const asset = (await c.query<{ id: string }>(`INSERT INTO file_assets(
        uploaded_by,storage_provider,object_key,secure_url,original_filename,file_extension,mime_type,
        byte_size,sha256,access_level,upload_status,malware_scan_status,retain_until,asset_kind
      ) VALUES($1,'LOCAL_PRIVATE',$2,NULL,$3,$4,$5,$6,$7,'PRIVATE','STORED','PENDING',NULL,'PAYMENT_PROOF')
      RETURNING id`, [input.uploadedBy, input.key, input.filename, input.extension, input.mimeType,
      input.byteSize, input.sha256])).rows[0];
    const attachment = (await c.query<{ id: string }>(`INSERT INTO attachments(
        file_asset_id,entity_type,entity_id,purpose,is_primary,is_current,sort_order,uploaded_by
      ) VALUES($1,'PAYMENT',$2,'PAYMENT_PROOF',true,true,0,$3) RETURNING id`,
    [asset.id, payment.id, input.uploadedBy])).rows[0];
    await c.query(`INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,new_values)
      VALUES($1,'PAYMENT_PROOF_UPLOADED','PAYMENT',$2,$3::jsonb)`,
    [input.uploadedBy, payment.id, JSON.stringify({ fileAssetId: asset.id, format: input.extension, byteSize: input.byteSize })]);
    return { id: asset.id, paymentId: payment.id, attachmentId: attachment.id };
  },

  async existsByKey(key: string) {
    const result = await query<{ exists: boolean }>(`SELECT EXISTS(
      SELECT 1 FROM file_assets f JOIN attachments a ON a.file_asset_id=f.id
      WHERE f.storage_provider='LOCAL_PRIVATE' AND f.object_key=$1
        AND a.entity_type='PAYMENT' AND a.purpose='PAYMENT_PROOF'
    ) AS exists`, [key]);
    return result.rows[0]?.exists === true;
  },

  async authorizedDownload(paymentId: string, assetId: string) {
    const result = await query<{
      object_key: string;
      byte_size: string;
      mime_type: string;
      file_extension: string;
      upload_status: string;
      malware_scan_status: string;
    }>(`SELECT f.object_key,f.byte_size,f.mime_type,f.file_extension
        ,f.upload_status,f.malware_scan_status
        FROM attachments a JOIN file_assets f ON f.id=a.file_asset_id
        WHERE a.entity_type='PAYMENT' AND a.entity_id=$1 AND a.purpose='PAYMENT_PROOF'
          AND a.file_asset_id=$2 AND a.is_current=true
          AND f.storage_provider='LOCAL_PRIVATE' AND f.access_level='PRIVATE'
          AND f.mime_type IN ('image/jpeg','image/png','image/webp')
          AND f.file_extension IN ('jpg','png','webp')`, [paymentId, assetId]);
    return result.rows[0] ?? null;
  },
};

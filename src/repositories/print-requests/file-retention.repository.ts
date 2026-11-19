import type { PoolClient } from 'pg';
import { withTransaction } from '../../lib/db';
import { AppError } from '../../lib/errors';
import { modelFileRetention, type FileRetentionContext } from '../../domain/print-requests/file-retention';

// Acquire before order/production/asset row locks in every lifecycle writer.
export async function lockPrivateFileLifecycle(client: PoolClient) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext('minhlab-custom-print-v1'))");
}

export async function notifyPrintRequestChange(client: PoolClient, id: string) {
  await client.query(`INSERT INTO email_outbox(dedup_key,recipient,subject,body_text,notification_type)
    SELECT 'request-change:'||gen_random_uuid(),u.email_normalized,'Cập nhật yêu cầu in',
      'Yêu cầu in đã được cập nhật. Đăng nhập website để xem trạng thái, việc cần làm và thời hạn lưu file.','CUSTOM_REQUEST_UPDATED'
    FROM print_requests r JOIN users u ON u.id=r.customer_id WHERE r.id=$1`, [id]);
}

interface RetentionRow {
  id: string;
  object_key: string;
  byte_size: string;
  upload_status: string;
  purged_at: Date | null;
  processing: boolean;
  purging: boolean;
  retry_ready: boolean;
  purge_attempts: number;
  context: FileRetentionContext;
}

/** One bounded query for asset contexts, including all historical request revisions. */
export async function readFileRetention(client: PoolClient, ids: string[]) {
  if (!ids.length) return [];
  return (await client.query<RetentionRow>(`WITH refs AS (
    SELECT DISTINCT a.file_asset_id,r.id AS request_id FROM attachments a
    JOIN print_request_items i ON a.entity_type='PRINT_REQUEST_ITEM' AND a.entity_id=i.id
    JOIN print_requests r ON r.id=i.print_request_id WHERE a.file_asset_id=ANY($1::uuid[])
  ) SELECT f.id,f.object_key,f.byte_size,f.upload_status,f.purged_at,f.purge_attempts,
    COALESCE(f.processing_lease_until>now(),false) AS processing,
    COALESCE(f.purge_lease_until>now(),false) AS purging,
    (f.purge_retry_at IS NULL OR f.purge_retry_at<=now()) AS retry_ready,
    jsonb_build_object('kind',f.asset_kind,'createdAt',f.created_at,
      'unknownReferences',EXISTS(SELECT 1 FROM attachments a WHERE a.file_asset_id=f.id AND
        (a.entity_type<>'PRINT_REQUEST_ITEM' OR NOT EXISTS(SELECT 1 FROM print_request_items i WHERE i.id=a.entity_id))),
      'requests',COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'status',r.status,'closedAt',r.closed_at,'closedReason',r.closed_reason,
        'holds',COALESCE((SELECT jsonb_agg(jsonb_build_object('releasedAt',h.released_at)) FROM print_file_holds h WHERE h.request_id=r.id),'[]'::jsonb),
        'orders',COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'status',o.order_status,'paymentStatus',o.payment_status,'completedAt',o.completed_at,'cancelledAt',o.cancelled_at,
          'pendingPayment',EXISTS(SELECT 1 FROM payments p WHERE p.order_id=o.id AND p.verification_status='PENDING' AND p.transferred_at IS NOT NULL),
          'productionActive',EXISTS(SELECT 1 FROM order_items oi JOIN production_jobs j ON j.order_item_id=oi.id WHERE oi.order_id=o.id AND j.status NOT IN ('COMPLETED','FAILED','CANCELLED'))
            OR EXISTS(SELECT 1 FROM order_items oi JOIN production_holds h ON h.custom_order_item_id=oi.id WHERE oi.order_id=o.id AND h.released_at IS NULL),
          'returnStatus',ret.status,'refundedAt',ret.refunded_at))
          FROM orders o LEFT JOIN order_return_requests ret ON ret.order_id=o.id WHERE
          EXISTS(SELECT 1 FROM quotes q WHERE q.print_request_id=r.id AND (q.converted_order_id=o.id OR q.id=o.accepted_quote_id))
          OR EXISTS(SELECT 1 FROM order_items oi JOIN print_specifications ps ON ps.id=oi.print_specification_id JOIN print_request_items ri ON ri.id=ps.print_request_item_id WHERE oi.order_id=o.id AND ri.print_request_id=r.id)), '[]'::jsonb)
      )) FROM refs JOIN print_requests r ON r.id=refs.request_id WHERE refs.file_asset_id=f.id),'[]'::jsonb)) AS context
    FROM file_assets f WHERE f.id=ANY($1::uuid[]) AND f.storage_provider='LOCAL_PRIVATE'`, [ids])).rows
    .map(row => ({ ...row, decision: modelFileRetention(row.context) }));
}

export async function requestFileRetention(client: PoolClient, requestId: string) {
  const rows = (await client.query<{ id: string }>(`SELECT DISTINCT a.file_asset_id AS id FROM attachments a
    JOIN print_request_items i ON a.entity_type='PRINT_REQUEST_ITEM' AND a.entity_id=i.id
    WHERE i.print_request_id=$1`, [requestId])).rows;
  const files = await readFileRetention(client, rows.map(row => row.id));
  return files.map(file => ({
    id: file.id,
    availability: file.purged_at || file.upload_status === 'DELETED' ? 'PURGED' as const
      : file.upload_status === 'AVAILABLE' ? 'AVAILABLE' as const : 'PROCESSING' as const,
    scheduledDeletionAt: file.purged_at || file.upload_status === 'DELETED' ? null : file.decision.deleteAfter,
    retentionReason: file.decision.reason,
  }));
}

export async function cleanupCandidates(apply = false, retryFailed = false) {
  return withTransaction(async client => {
    await lockPrivateFileLifecycle(client);
    if (apply && retryFailed) await client.query(`UPDATE file_assets SET purge_attempts=0,purge_retry_at=NULL
      WHERE upload_status='DELETED' AND purged_at IS NULL AND purge_attempts=5 AND asset_kind IN ('PRINT_SOURCE','PRINT_APPROVED','SLICER_ARTIFACT')`);
    // Tombstones first. Persisted deadlines and a moving cursor avoid starving older active assets.
    const ids = (await client.query<{ id: string }>(`SELECT id FROM file_assets WHERE storage_provider='LOCAL_PRIVATE'
      AND asset_kind IN ('PRINT_SOURCE','PRINT_APPROVED','SLICER_ARTIFACT') AND purged_at IS NULL
      AND upload_status IN ('STORED','AVAILABLE','REJECTED','DELETED')
      AND (purge_lease_until IS NULL OR purge_lease_until<=now()) AND purge_attempts<5
      AND (purge_retry_at IS NULL OR purge_retry_at<=now())
      ORDER BY (upload_status='DELETED') DESC,retention_checked_at NULLS FIRST,created_at,id
      LIMIT 1000 FOR UPDATE`, [])).rows;
    const files = await readFileRetention(client, ids.map(row => row.id));
    const now = Date.now();
    const eligible = files.filter(file => !file.processing && !file.purging && file.retry_ready &&
      (file.upload_status === 'DELETED' || (file.decision.deleteAfter && Date.parse(file.decision.deleteAfter) <= now))).slice(0, 100);
    const claimed: { id: string; object_key: string; bytes: number; token: string | null }[] = [];
    if (apply) {
      for (const file of files) {
        await client.query(`UPDATE file_assets SET retention_checked_at=now(),
          retain_until=CASE WHEN upload_status='DELETED' THEN retain_until ELSE $2 END WHERE id=$1`, [file.id, file.decision.deleteAfter]);
      }
    }
    for (const file of eligible) {
      let token: string | null = null;
      if (apply) {
        token = (await client.query<{ purge_token: string }>(`UPDATE file_assets SET upload_status='DELETED',
          processing_lease_token=NULL,processing_lease_until=NULL,purge_token=gen_random_uuid(),purge_lease_until=now()+interval '2 minutes',purge_attempts=purge_attempts+1
          WHERE id=$1 RETURNING purge_token`, [file.id])).rows[0].purge_token;
        await client.query(`INSERT INTO audit_logs(action,entity_type,entity_id,new_values)
          VALUES('MODEL_FILE_PURGE_CLAIMED','FILE_ASSET',$1,$2::jsonb)`, [file.id, JSON.stringify({ scheduledDeletionAt: file.decision.deleteAfter })]);
      }
      claimed.push({ id: file.id, object_key: file.object_key, bytes: Number(file.byte_size), token });
    }
    const failedPurges = Number((await client.query<{ count: string }>(`SELECT count(*) FROM file_assets
      WHERE storage_provider='LOCAL_PRIVATE' AND asset_kind IN ('PRINT_SOURCE','PRINT_APPROVED','SLICER_ARTIFACT')
      AND upload_status='DELETED' AND purged_at IS NULL AND purge_attempts=5`)).rows[0].count);
    const overdueHolds = Number((await client.query<{ count: string }>(`SELECT count(*) FROM print_file_holds
      WHERE released_at IS NULL AND review_at<=now()`)).rows[0].count);
    return { rows: claimed, inspected: files.length, held: files.filter(file => !file.decision.deleteAfter && file.upload_status !== 'DELETED').length, failedPurges, overdueHolds };
  });
}

export async function finishFilePurge(id: string, token: string, removed: boolean) {
  return withTransaction(async client => {
    await lockPrivateFileLifecycle(client);
    const result = await client.query(`UPDATE file_assets SET
      purged_at=CASE WHEN $3 THEN now() ELSE purged_at END,purge_token=NULL,purge_lease_until=NULL,
      purge_retry_at=CASE WHEN $3 THEN NULL ELSE now()+interval '5 minutes' END
      WHERE id=$1 AND purge_token=$2 AND upload_status='DELETED' RETURNING id`, [id, token, removed]);
    if (!result.rowCount) throw new AppError('Quyền xử lý xóa file đã đổi; cần kiểm tra lại worker.', 409);
    await client.query(`INSERT INTO audit_logs(action,entity_type,entity_id,new_values)
      VALUES($2,'FILE_ASSET',$1,'{}'::jsonb)`, [id, removed ? 'MODEL_FILE_PURGED' : 'MODEL_FILE_PURGE_RETRY']);
  });
}

export async function expirePrintQuotes() {
  return withTransaction(async client => {
    await lockPrivateFileLifecycle(client);
    const expired = await client.query<{ print_request_id: string }>(`UPDATE quotes SET status='EXPIRED'
      WHERE status='SENT' AND valid_until<=now() AND converted_order_id IS NULL RETURNING print_request_id`);
    let closed = 0;
    for (const { print_request_id: id } of expired.rows) {
      const result = await client.query(`UPDATE print_requests SET status='CLOSED',closed_at=now(),closed_reason='QUOTE_EXPIRED',revision=revision+1
        WHERE id=$1 AND status='READY_FOR_QUOTE'
        AND NOT EXISTS(SELECT 1 FROM quotes WHERE print_request_id=$1 AND (status='SENT' OR converted_order_id IS NOT NULL)) RETURNING id`, [id]);
      if (result.rowCount) {
        closed++;
        await notifyPrintRequestChange(client, id);
        await client.query(`INSERT INTO audit_logs(action,entity_type,entity_id,new_values)
          VALUES('PRINT_REQUEST_QUOTE_EXPIRED','PRINT_REQUEST',$1,'{}'::jsonb)`, [id]);
      }
    }
    return { expired: expired.rowCount, closed };
  });
}

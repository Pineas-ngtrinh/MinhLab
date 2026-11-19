import { lockPrivateFileLifecycle } from './file-retention.repository';
import type { PoolClient } from 'pg';
import { query, withTransaction } from '../../lib/db';
export const privateFiles = {
    async usage(c: PoolClient, ownerId: string) {
        await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`private-files:${ownerId}`]);
        return Number((await c.query<{
            bytes: string;
        }>("SELECT COALESCE(sum(byte_size),0) AS bytes FROM file_assets WHERE uploaded_by=$1 AND storage_provider='LOCAL_PRIVATE' AND purged_at IS NULL", [ownerId])).rows[0].bytes);
    },
    async save(c: PoolClient, ownerId: string, input: {
        key: string;
        bytes: number;
        sha256: string;
        filename: string;
    }) {
        return (await c.query<{
            id: string;
        }>(`INSERT INTO file_assets(uploaded_by,storage_provider,object_key,original_filename,file_extension,mime_type,byte_size,sha256,access_level,upload_status,malware_scan_status,retain_until,asset_kind)
  VALUES($1,'LOCAL_PRIVATE',$2,$6,$5,'application/octet-stream',$3,$4,'PRIVATE','STORED','PENDING',now()+interval '48 hours','PRINT_SOURCE') RETURNING id`, [ownerId, input.key, input.bytes, input.sha256, input.key.split('.').pop(), input.filename])).rows[0].id;
    },
    async authorized(c: PoolClient, id: string, userId: string, role: string) {
        return (await c.query<{
            object_key: string;
            byte_size: string;
            malware_scan_status: string;
            upload_status: string;
        }>(`SELECT f.object_key,f.byte_size,f.malware_scan_status,f.upload_status FROM file_assets f WHERE f.id=$1 AND f.storage_provider='LOCAL_PRIVATE' AND f.asset_kind IN ('LEGACY','PRINT_SOURCE','PRINT_APPROVED') AND
  ((f.uploaded_by=$2 AND $3='CUSTOMER') OR ($3='FILE_REVIEWER' AND f.malware_scan_status='CLEAN' AND EXISTS(SELECT 1 FROM attachments a JOIN print_request_items i ON a.entity_id=i.id AND a.entity_type='PRINT_REQUEST_ITEM' JOIN print_requests r ON r.id=i.print_request_id WHERE a.file_asset_id=f.id AND r.assigned_reviewer_id=$2)) OR
  ($3='PRINT_OPERATOR' AND f.malware_scan_status='CLEAN' AND EXISTS(SELECT 1 FROM attachments a JOIN print_specifications ps ON ps.attachment_id=a.id JOIN order_items i ON i.print_specification_id=ps.id JOIN orders o ON o.id=i.order_id WHERE a.file_asset_id=f.id AND o.payment_status='PAID' AND o.order_status IN ('CONFIRMED','IN_PRODUCTION') AND EXISTS(SELECT 1 FROM production_jobs j WHERE j.order_item_id=i.id AND j.metadata_snapshot->>'kind'='CUSTOM' AND j.status<>'CANCELLED'))))`, [id, userId, role])).rows[0] ?? null;
    },
    async claim() {
        return withTransaction(async (c) => {
            await lockPrivateFileLifecycle(c);
            await c.query("UPDATE file_assets SET analysis_status='FAILED',malware_scan_status='FAILED',upload_status='REJECTED',processing_lease_token=NULL,processing_lease_until=NULL WHERE storage_provider='LOCAL_PRIVATE' AND upload_status='STORED' AND processing_attempts>=5 AND processing_lease_until<=now()");
            const token = (await c.query<{
                id: string;
            }>('SELECT gen_random_uuid() AS id')).rows[0].id;
            const r = (await c.query<{
                id: string;
                object_key: string;
                sha256: string;
            }>(`UPDATE file_assets SET processing_attempts=processing_attempts+1,processing_lease_token=$1,processing_lease_until=now()+interval '2 minutes' WHERE id=(SELECT id FROM file_assets WHERE storage_provider='LOCAL_PRIVATE' AND upload_status='STORED' AND processing_attempts<5 AND (processing_lease_until IS NULL OR processing_lease_until<now()) ORDER BY created_at,id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id,object_key,sha256`, [token])).rows[0];
            return r ? { ...r, token } : null;
        });
    },
    async finish(id: string, token: string, scan: string, analysis: unknown, error = false) { await query(`UPDATE file_assets SET malware_scan_status=$3,analysis_status=$4,analysis_metadata=$5::jsonb,upload_status=$6,processing_lease_until=NULL,processing_lease_token=NULL WHERE id=$1 AND processing_lease_token=$2 AND upload_status='STORED'`, [id, token, scan, error ? 'FAILED' : analysis === null ? 'MANUAL_REVIEW' : 'COMPLETE', JSON.stringify(analysis), error || scan !== 'CLEAN' ? 'REJECTED' : 'AVAILABLE']); },
    async retry(id: string, token: string) { await query("UPDATE file_assets SET processing_lease_token=NULL,processing_lease_until=now()+interval '5 minutes',analysis_status=CASE WHEN processing_attempts>=5 THEN 'FAILED' ELSE 'PENDING' END,malware_scan_status=CASE WHEN processing_attempts>=5 THEN 'FAILED' ELSE 'PENDING' END WHERE id=$1 AND processing_lease_token=$2 AND upload_status='STORED'", [id, token]); },
};
export async function recordManualFileAnalysis(c: PoolClient, fileId: string, actorId: string, bbox: {
    w: number;
    d: number;
    h: number;
}, evidenceCode: string) {
    const result = await c.query("UPDATE file_assets SET analysis_status='COMPLETE',analysis_metadata=$2::jsonb WHERE id=$1 AND upload_status='AVAILABLE' AND purged_at IS NULL AND malware_scan_status='CLEAN' AND analysis_status='MANUAL_REVIEW' AND file_extension IN ('obj','step') RETURNING id", [fileId, JSON.stringify({ bboxMm: bbox, triangleCount: 0, flags: ['MANUAL_REVIEW'], source: 'WORKSHOP_MANUAL', verifiedBy: actorId, evidenceCode, verifiedAt: new Date().toISOString() })]);
    return !!result.rowCount;
}

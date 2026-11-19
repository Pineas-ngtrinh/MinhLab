import type { PoolClient } from 'pg';
import type { CustomProductionWriter } from '../../services/production/custom-production.ports';
import type { CustomProductionItem, CustomBatch, CustomBatchInput } from '../../contracts/custom-production';
import { PostgresProductionWriter } from './production.repository';
import { materialStockKey } from '../../domain/production/planning';
import { AppError } from '../../lib/errors';
export class PostgresCustomProductionWriter implements CustomProductionWriter {
    private readonly core: PostgresProductionWriter;
    constructor(private readonly c: PoolClient) { this.core = new PostgresProductionWriter(c); }
    resources() { return this.core.snapshot(); }
    async view() {
        const items = (await this.c.query<{
            data: CustomProductionItem;
        }>(`SELECT jsonb_build_object('id',i.id,'orderId',o.id,'orderNumber',o.order_number,'quantity',i.quantity,
   'materialId',ps.material_id,'materialCode',m.material_code,'technology',m.technology,'color',ps.color_name_snapshot,'fileId',f.id,'fileHash',ps.source_file_sha256,
   'fileReady',f.upload_status='AVAILABLE' AND f.purged_at IS NULL AND f.malware_scan_status='CLEAN' AND f.analysis_status='COMPLETE' AND ps.status='APPROVED','reviewerId',r.assigned_reviewer_id,'packedAt',i.custom_packed_at,'readyAt',i.custom_dispatch_ready_at,
   'orderStatus',o.order_status,'paymentStatus',o.payment_status,'length',ps.final_length_mm,'width',ps.final_width_mm,'height',ps.final_height_mm) AS data
   FROM order_items i JOIN orders o ON o.id=i.order_id JOIN print_specifications ps ON ps.id=i.print_specification_id JOIN materials m ON m.id=ps.material_id
   JOIN attachments a ON a.id=ps.attachment_id JOIN file_assets f ON f.id=a.file_asset_id JOIN print_request_items ri ON ri.id=ps.print_request_item_id JOIN print_requests r ON r.id=ri.print_request_id
   WHERE i.item_type='CUSTOM_PRINT' AND o.accepted_quote_id IS NOT NULL AND o.order_status IN ('CONFIRMED','IN_PRODUCTION','READY_TO_SHIP') ORDER BY o.placed_at,i.id`)).rows.map(r => r.data);
        const batches = (await this.c.query<{
            data: CustomBatch;
        }>(`SELECT jsonb_build_object('id',j.id,'itemId',j.order_item_id,'printerId',j.assigned_printer_id,'holdId',j.hold_id,'status',j.status,
   'quantity',(j.metadata_snapshot->>'quantity')::integer,'good',COALESCE((SELECT sum(quantity_passed) FROM quality_inspections WHERE production_job_id=j.id),0),
   'failed',COALESCE((SELECT sum(quantity_failed) FROM quality_inspections WHERE production_job_id=j.id),0),'startAt',j.planned_start_at,'finishAt',j.planned_finish_at,
   'actualStartAt',j.actual_start_at,'actualFinishAt',j.actual_finish_at,'profileId',j.metadata_snapshot->>'profileId','evidenceCode',j.metadata_snapshot->>'evidenceCode') AS data
   FROM production_jobs j WHERE j.metadata_snapshot->>'kind'='CUSTOM' ORDER BY j.created_at,j.id`)).rows.map(r => r.data);
        return { items, batches };
    }
    async replay(key: string) { const p = await this.core.replay(key); return p ? { actorId: p.actorId, hash: p.requestHash, result: p.result } : null; }
    remember(key: string, actorId: string, hash: string, result: unknown) { return this.core.remember(key, actorId, hash, result); }
    audit(action: string, id: string, actorId: string, detail: unknown) { return this.core.audit(action, id, actorId, detail); }
    async approve(input: CustomBatchInput, _actorId: string) {
        const s = await this.resources();
        const profile = s.revisions.find(r => r.id === input.profileId)!;
        if (profile.kind !== 'PROFILE')
            throw new AppError('Profile không hợp lệ.', 409);
        const finish = new Date(Date.parse(input.startAt) + input.durationMinutes * 60000).toISOString();
        const existing = (await this.c.query<{
            id: string;
            custom_order_item_id: string | null;
        }>('SELECT id,custom_order_item_id FROM production_holds WHERE printer_id=$1 AND released_at IS NULL FOR UPDATE', [profile.printerId])).rows[0];
        if (existing && existing.custom_order_item_id !== input.itemId)
            throw new AppError('Máy đang giữ cho nhóm sản phẩm khác.', 409);
        if ((await this.c.query("SELECT id FROM production_jobs WHERE assigned_printer_id=$1 AND status NOT IN ('COMPLETED','FAILED','CANCELLED') AND planned_start_at<$3 AND planned_finish_at>$2", [profile.printerId, input.startAt, finish])).rowCount)
            throw new AppError('Lịch máy bị chồng với mẻ đã được duyệt.', 409);
        const key = materialStockKey(profile.body);
        if (!(await this.c.query('UPDATE production_inventory SET available=available-$2,revision=revision+1 WHERE stock_key=$1 AND available>=$2 RETURNING stock_key', [key, input.materialQuantity])).rowCount)
            throw new AppError('Vật liệu không đủ.', 409);
        const holdId = existing?.id ?? (await this.c.query<{
            id: string;
        }>('INSERT INTO production_holds(printer_id,group_id,custom_order_item_id) VALUES($1,gen_random_uuid(),$2) RETURNING id', [profile.printerId, input.itemId])).rows[0].id;
        await this.c.query('INSERT INTO production_hold_items(hold_id,order_item_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [holdId, input.itemId]);
        const item = (await this.view()).items.find(i => i.id === input.itemId)!;
        const result = await this.c.query<{
            id: string;
        }>(`INSERT INTO production_jobs(job_number,order_item_id,assigned_printer_id,assigned_material_id,hold_id,planned_start_at,planned_finish_at,metadata_snapshot)
   VALUES('JOB-'||gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING id`, [input.itemId, profile.printerId, item.materialId, holdId, input.startAt, finish, JSON.stringify({ kind: 'CUSTOM', quantity: input.quantity, profileId: profile.id, evidenceCode: input.evidenceCode, materialQuantity: input.materialQuantity, sourceFileHash: item.fileHash, fileId: item.fileId })]);
        return result.rows[0].id;
    }
    async step(b: CustomBatch, action: 'START' | 'FINISH' | 'QC_READY' | 'FAIL', actorId: string) {
        const hold = await this.c.query('SELECT id FROM production_holds WHERE id=$1 AND released_at IS NULL AND custom_order_item_id=$2', [b.holdId, b.itemId]);
        if (!hold.rowCount)
            throw new AppError('Giữ máy không còn hiệu lực.', 409);
        if (action === 'START' && (await this.c.query("SELECT id FROM production_jobs WHERE assigned_printer_id=$1 AND status='PRINTING'", [b.printerId])).rowCount)
            throw new AppError('Máy đang chạy một mẻ khác.', 409);
        const status = { START: 'PRINTING', FINISH: 'POST_PROCESSING', QC_READY: 'QC_PENDING', FAIL: 'FAILED' }[action];
        await this.c.query(`UPDATE production_jobs SET status=$2::varchar,assigned_operator_id=COALESCE(assigned_operator_id,$3::uuid),
   actual_start_at=CASE WHEN $2::varchar='PRINTING' THEN now() ELSE actual_start_at END,
   actual_finish_at=CASE WHEN $2::varchar IN ('POST_PROCESSING','FAILED') THEN now() ELSE actual_finish_at END WHERE id=$1`, [b.id, status, actorId]);
        if (action === 'START') {
            const orders = (await this.c.query<{
                id: string;
            }>(`UPDATE orders SET order_status='IN_PRODUCTION',updated_at=now() WHERE order_status='CONFIRMED' AND id=(SELECT order_id FROM order_items WHERE id=$1) RETURNING id`, [b.itemId])).rows;
            for (const o of orders)
                await this.c.query("INSERT INTO status_history(entity_type,entity_id,from_status,to_status,changed_by,reason) VALUES('ORDER',$1,'CONFIRMED','IN_PRODUCTION',$2,'Thợ ghi bắt đầu mẻ custom thực tế')", [o.id, actorId]);
        }
        if (action === 'FAIL')
            await this.qc(b, 0, b.quantity, actorId);
        await this.core.event('CustomProductionChanged', b.id);
    }
    async qc(b: CustomBatch, good: number, failed: number, actorId: string) {
        await this.c.query('INSERT INTO quality_inspections(production_job_id,inspected_by,result,quantity_passed,quantity_failed) VALUES($1,$2,$3,$4,$5)', [b.id, actorId, failed ? 'FAIL' : 'PASS', good, failed]);
        await this.c.query('UPDATE production_jobs SET status=$2 WHERE id=$1', [b.id, failed ? 'FAILED' : 'COMPLETED']);
        await this.core.event('CustomQualityChanged', b.id);
    }
    async pack(itemId: string, ready: boolean, actorId: string) {
        await this.c.query(ready ? 'UPDATE order_items SET custom_dispatch_ready_at=now() WHERE id=$1' : 'UPDATE order_items SET custom_packed_at=now() WHERE id=$1', [itemId]);
        if (!ready)
            await this.c.query(`UPDATE production_holds h SET released_at=now() WHERE custom_order_item_id=$1 AND released_at IS NULL
   AND NOT EXISTS(SELECT 1 FROM production_jobs j WHERE j.hold_id=h.id AND j.status NOT IN ('COMPLETED','FAILED','CANCELLED'))`, [itemId]);
        if (ready) {
            const remaining = await this.c.query(`SELECT i.id FROM order_items i LEFT JOIN production_requirements r ON r.order_item_id=i.id
    WHERE i.order_id=(SELECT order_id FROM order_items WHERE id=$1) AND ((i.item_type='READY_PRODUCT' AND r.dispatch_ready_at IS NULL) OR (i.item_type='CUSTOM_PRINT' AND i.custom_dispatch_ready_at IS NULL))`, [itemId]);
            if (!remaining.rowCount) {
                const order = (await this.c.query<{
                    id: string;
                }>("UPDATE orders SET order_status='READY_TO_SHIP',updated_at=now() WHERE id=(SELECT order_id FROM order_items WHERE id=$1) AND order_status='IN_PRODUCTION' RETURNING id", [itemId])).rows[0];
                if (order)
                    await this.c.query("INSERT INTO status_history(entity_type,entity_id,from_status,to_status,changed_by,reason) VALUES('ORDER',$1,'IN_PRODUCTION','READY_TO_SHIP',$2,'Đủ toàn bộ dòng đã QC và đóng gói')", [order.id, actorId]);
            }
        }
        await this.core.event('CustomPackingChanged', itemId);
    }
}

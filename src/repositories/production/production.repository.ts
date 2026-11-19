import { lockPrivateFileLifecycle } from '../print-requests/file-retention.repository';
import type { PoolClient } from 'pg';
import type { ProductionWriter } from '../../services/production/production.ports';
import type { Revision, RevisionInput, ProductionItem, ProductionSupply, Printer, Inventory, MachineHold, TechnicalCheck, TechnicalCheckInput, ProductionJob, ProductionPlan, PlanBody } from '../../contracts/production';
import { materialStockKey } from '../../domain/production/planning';
import { AppError } from '../../lib/errors';
/** The composition holds the production advisory lock and commerce row locks for this client. */
export class PostgresProductionWriter implements ProductionWriter {
    constructor(private readonly client: PoolClient) { }
    async snapshot() {
        const revisions = (await this.client.query<{
            data: Revision;
        }>(`SELECT jsonb_build_object('id',id,'kind',kind,'code',code,'revision',revision,'status',status,
   'body',body,'variantId',variant_id,'printerId',printer_id,'verifiedBy',verified_by,'verifiedAt',verified_at) AS data
   FROM manufacturing_revisions ORDER BY kind,code,revision,id`)).rows.map(r => r.data);
        const items = (await this.client.query<{
            data: ProductionItem;
        }>(`SELECT jsonb_build_object('id',i.id,'orderId',o.id,'orderNumber',o.order_number,'variantId',i.product_variant_id,
   'sku',i.sku_snapshot,'quantity',i.quantity,'placedAt',o.placed_at,'orderStatus',o.order_status,'paymentStatus',o.payment_status,'paymentTiming',o.payment_timing,
   'bomRevisionId',COALESCE(r.bom_revision_id,i.manufacturing_revision_id),'groupId',r.group_id,'packedAt',r.packed_at,'dispatchReadyAt',r.dispatch_ready_at) AS data
   FROM order_items i JOIN orders o ON o.id=i.order_id LEFT JOIN production_requirements r ON r.order_item_id=i.id
   WHERE i.item_type='READY_PRODUCT' AND o.order_status IN ('CONFIRMED','IN_PRODUCTION','READY_TO_SHIP')
   ORDER BY o.placed_at,o.id,i.id LIMIT 501`)).rows.map(r => r.data);
        if (items.length > 500)
            throw new AppError('Hàng đợi vượt 500 dòng đang mở; cần chia phạm vi truy vấn trước khi lập kế hoạch.', 409);
        const inventory = (await this.client.query<{
            stock_key: string;
            available: string;
            revision: number;
        }>('SELECT stock_key,available,revision FROM production_inventory ORDER BY stock_key')).rows.map(r => ({ key: r.stock_key, available: Number(r.available), revision: r.revision } satisfies Inventory));
        const checks = (await this.client.query<{
            id: string;
            code: string;
            profile_revision_id: string;
            body: Omit<TechnicalCheckInput, 'code' | 'profileRevisionId'>;
            verified_by: string;
            revoked: boolean;
        }>(`SELECT id,code,profile_revision_id,body,verified_by,revoked_at IS NOT NULL AS revoked FROM production_checks ORDER BY created_at,id`)).rows.map(r => ({ id: r.id, code: r.code, profileRevisionId: r.profile_revision_id, ...r.body, verifiedBy: r.verified_by, revoked: r.revoked } satisfies TechnicalCheck));
        const printers = (await this.client.query<{
            id: string;
            printer_code: string;
            name: string;
            technology: Printer['technology'];
            status: string;
        }>(`SELECT p.id,p.printer_code,p.name,p.technology,CASE WHEN EXISTS(SELECT 1 FROM production_jobs j WHERE j.assigned_printer_id=p.id AND j.status='PRINTING' AND j.plan_id IS NULL AND (j.metadata_snapshot->>'kind') IS DISTINCT FROM 'CUSTOM') THEN 'PRINTING' ELSE p.status END AS status FROM printers p ORDER BY p.printer_code,p.id`)).rows.map(r => ({ id: r.id, code: r.printer_code, name: r.name, technology: r.technology, status: r.status }));
        const supplies = (await this.client.query<{
            data: ProductionSupply;
        }>(`SELECT jsonb_build_object('id',id,'itemId',order_item_id,'componentRevisionId',component_revision_id,
   'jobId',job_id,'quantity',quantity,'good',good,'failed',failed,'inspectedAt',inspected_at) AS data FROM production_supplies ORDER BY id`)).rows.map(r => r.data);
        const holds = (await this.client.query<{
            data: MachineHold;
        }>(`SELECT jsonb_build_object('id',h.id,'printerId',h.printer_id,'groupId',h.group_id,
   'itemIds',COALESCE((SELECT jsonb_agg(order_item_id ORDER BY order_item_id) FROM production_hold_items WHERE hold_id=h.id),'[]'::jsonb)) AS data
   FROM production_holds h WHERE released_at IS NULL ORDER BY h.id`)).rows.map(r => r.data);
        const jobs = (await this.client.query<{
            id: string;
            job_number: string;
            assigned_printer_id: string;
            hold_id: string;
            status: string;
            start_at: string;
            finish_at: string;
            actual_start_at: string | null;
            actual_finish_at: string | null;
            metadata_snapshot: TechnicalCheck;
        }>(`SELECT id,job_number,assigned_printer_id,hold_id,status,planned_start_at::text AS start_at,planned_finish_at::text AS finish_at,
   actual_start_at::text,actual_finish_at::text,metadata_snapshot FROM production_jobs WHERE plan_id IS NOT NULL ORDER BY created_at,id`)).rows.map(r => ({ id: r.id, number: r.job_number, printerId: r.assigned_printer_id, holdId: r.hold_id, status: r.status, startAt: r.start_at, finishAt: r.finish_at, actualStartAt: r.actual_start_at, actualFinishAt: r.actual_finish_at, check: r.metadata_snapshot, supplies: supplies.filter(a => a.jobId === r.id) } satisfies ProductionJob));
        return { revisions, items, inventory, checks, printers, supplies, holds, jobs };
    }
    async workspace() {
        const s = await this.snapshot();
        const plans = (await this.client.query<{
            data: ProductionPlan;
        }>(`SELECT jsonb_build_object('id',id,'revision',revision,'status',status,'snapshotHash',snapshot_hash,'body',body,
   'proposedBy',proposed_by,'decisionNote',decision_note) AS data FROM production_plans WHERE deleted_at IS NULL ORDER BY created_at DESC,id DESC LIMIT 100`)).rows.map(r => r.data);
        const variants = (await this.client.query<{
            id: string;
            sku: string;
            name: string;
        }>(`SELECT v.id,v.sku,p.name||' / '||v.variant_name AS name FROM product_variants v JOIN products p ON p.id=v.product_id WHERE v.status='ACTIVE' ORDER BY v.sku`)).rows;
        return { ...s, plans, variants };
    }
    async replay(key: string) {
        const r = (await this.client.query<{
            actor_id: string;
            request_hash: string;
            result: unknown;
        }>('SELECT actor_id,request_hash,result FROM production_operations WHERE operation_key=$1', [key])).rows[0];
        return r ? { actorId: r.actor_id, requestHash: r.request_hash, result: r.result } : null;
    }
    async remember(key: string, actorId: string, requestHash: string, result: unknown) {
        await this.client.query('INSERT INTO production_operations(operation_key,actor_id,request_hash,result) VALUES($1,$2,$3,$4::jsonb)', [key, actorId, requestHash, JSON.stringify(result)]);
    }
    async audit(action: string, id: string, actorId: string, detail: unknown) {
        // Agent identity is a software principal; never coerce it to a human UUID.
        const human = /^[0-9a-f-]{36}$/i.test(actorId) ? actorId : null;
        await this.client.query(`INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,new_values) VALUES($1,$2,'PRODUCTION',$3,$4::jsonb)`, [human, action, id, JSON.stringify({ ...{ actorId }, detail })]);
    }
    async event(type: string, id: string) { await this.client.query('INSERT INTO production_events(event_type,entity_id) VALUES($1,$2)', [type, id]); }
    async saveRevision(input: RevisionInput, actorId: string) {
        if (input.kind === 'BOM' && !(await this.client.query('SELECT id FROM product_variants WHERE id=$1', [input.variantId])).rowCount)
            throw new AppError('Biến thể không tồn tại.');
        if (input.kind === 'PROFILE' && !(await this.client.query('SELECT id FROM printers WHERE id=$1', [input.printerId])).rowCount)
            throw new AppError('Máy không tồn tại.');
        const previous = (await this.client.query<{
            variant_id: string | null;
            printer_id: string | null;
        }>('SELECT variant_id,printer_id FROM manufacturing_revisions WHERE kind=$1 AND code=$2 ORDER BY revision DESC LIMIT 1', [input.kind, input.code])).rows[0];
        if (previous && (previous.variant_id !== (input.kind === 'BOM' ? input.variantId : null) || previous.printer_id !== (input.kind === 'PROFILE' ? input.printerId : null)))
            throw new AppError('Mã revision đã thuộc đối tượng khác.', 409);
        const r = await this.client.query<{
            id: string;
        }>(`INSERT INTO manufacturing_revisions(kind,code,revision,variant_id,printer_id,body,created_by)
   SELECT $1::text,$2::varchar,COALESCE(max(revision),0)+1,$3::uuid,$4::uuid,$5::jsonb,$6::uuid FROM manufacturing_revisions WHERE kind=$1::text AND code=$2::varchar RETURNING id`, [input.kind, input.code, input.kind === 'BOM' ? input.variantId : null, input.kind === 'PROFILE' ? input.printerId : null, JSON.stringify(input.body), actorId]);
        return r.rows[0].id;
    }
    async setRevision(id: string, status: Revision['status'], actorId: string, verify = false) {
        await this.client.query(`UPDATE manufacturing_revisions SET status=$2,
   verified_by=CASE WHEN $4 THEN $3::uuid ELSE verified_by END, verified_at=CASE WHEN $4 THEN now() ELSE verified_at END,
   published_by=CASE WHEN $2='PUBLISHED' THEN $3::uuid ELSE published_by END,published_at=CASE WHEN $2='PUBLISHED' THEN now() ELSE published_at END WHERE id=$1`, [id, status, actorId, verify]);
    }
    async savePrinter(input: Omit<Printer, 'id'>, _actorId: string, id?: string) {
        if (id) {
            const result = await this.client.query<{
                id: string;
            }>('UPDATE printers SET printer_code=$2,name=$3,technology=$4,status=$5 WHERE id=$1 RETURNING id', [id, input.code, input.name, input.technology, input.status]);
            if (!result.rowCount)
                throw new AppError('Không tìm thấy máy.', 404);
            return id;
        }
        return (await this.client.query<{
            id: string;
        }>('INSERT INTO printers(printer_code,name,technology,status) VALUES($1,$2,$3,$4) RETURNING id', [input.code, input.name, input.technology, input.status])).rows[0].id;
    }
    async inventory(key: string, quantity: number, revision: number, actorId: string) {
        const r = await this.client.query(`INSERT INTO production_inventory(stock_key,available,revision,confirmed_by) SELECT $1,$2,1,$4 WHERE $3::integer=0
   ON CONFLICT(stock_key) DO NOTHING RETURNING stock_key`, [key, quantity, revision, actorId]);
        if (!r.rowCount) {
            const updated = await this.client.query('UPDATE production_inventory SET available=$2,revision=revision+1,confirmed_by=$4,confirmed_at=now() WHERE stock_key=$1 AND revision=$3 RETURNING stock_key', [key, quantity, revision, actorId]);
            if (!updated.rowCount)
                throw new AppError('Tồn kho đã đổi; tải lại trước khi xác nhận lượng chưa phân bổ.', 409);
        }
        await this.client.query(`INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,new_values)
   VALUES($1,'INVENTORY_CONFIRMED','PRODUCTION',gen_random_uuid(),$2::jsonb)`, [actorId, JSON.stringify({ key, quantity, revision })]);
        await this.client.query(`INSERT INTO production_events(event_type,entity_id) VALUES('InventoryChanged',gen_random_uuid())`);
    }
    async saveCheck(input: TechnicalCheckInput, actorId: string) {
        const { code, profileRevisionId, ...body } = input;
        return (await this.client.query<{
            id: string;
        }>('INSERT INTO production_checks(code,profile_revision_id,body,verified_by) VALUES($1,$2,$3::jsonb,$4) RETURNING id', [code, profileRevisionId, JSON.stringify(body), actorId])).rows[0].id;
    }
    async revokeCheck(id: string) {
        if (!(await this.client.query('UPDATE production_checks SET revoked_at=now() WHERE id=$1 RETURNING id', [id])).rowCount)
            throw new AppError('Không tìm thấy kiểm tra.', 404);
    }
    async pinRequirements(itemIds: string[]) {
        // No implicit repinning. A checkout snapshot or the first explicitly prepared revision wins.
        await this.client.query(`INSERT INTO production_requirements(order_item_id,bom_revision_id)
   SELECT i.id,COALESCE(i.manufacturing_revision_id,b.id) FROM order_items i
   LEFT JOIN LATERAL(SELECT id FROM manufacturing_revisions WHERE kind='BOM' AND variant_id=i.product_variant_id AND status='PUBLISHED' ORDER BY published_at DESC,revision DESC,id DESC LIMIT 1)b ON true
   WHERE i.id=ANY($1::uuid[]) AND i.item_type='READY_PRODUCT' AND EXISTS(SELECT 1 FROM orders o WHERE o.id=i.order_id AND o.order_status IN ('CONFIRMED','IN_PRODUCTION') AND (o.payment_status='PAID' OR o.payment_timing='COD')) AND COALESCE(i.manufacturing_revision_id,b.id) IS NOT NULL ON CONFLICT DO NOTHING`, [itemIds]);
        const legacy = await this.client.query(`SELECT id FROM production_jobs WHERE order_item_id=ANY($1::uuid[]) AND plan_id IS NULL AND status NOT IN ('COMPLETED','FAILED','CANCELLED')`, [itemIds]);
        if (legacy.rowCount)
            throw new AppError('Có job cũ chưa kết thúc; cần đối chiếu WIP trước khi lập nhu cầu mới.', 409);
    }
    async savePlan(body: PlanBody, hash: string, actorId: string, id?: string, revision?: number) {
        if (id) {
            const old = await this.plan(id);
            // Preserve every submitted revision as a separate historical record.
            if (!old || old.revision !== revision)
                throw new AppError('Revision kế hoạch đã đổi.', 409);
            await this.decidePlan(id, 'SUPERSEDED', actorId, 'Được thay bằng phiên bản nháp mới.');
        }
        return (await this.client.query<{
            id: string;
        }>(`INSERT INTO production_plans(revision,status,snapshot_hash,body,proposed_by)
   VALUES($1,$2,$3,$4::jsonb,$5) RETURNING id`, [(revision ?? 0) + 1, body.blockers.length ? 'WAITING_DATA' : 'PENDING_APPROVAL', hash, JSON.stringify(body), actorId])).rows[0].id;
    }
    async plan(id: string) {
        return (await this.client.query<{
            data: ProductionPlan;
        }>(`SELECT jsonb_build_object('id',id,'revision',revision,'status',status,'snapshotHash',snapshot_hash,
   'body',body,'proposedBy',proposed_by,'decisionNote',decision_note) AS data FROM production_plans WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`, [id])).rows[0]?.data ?? null;
    }
    async deletePlan(id: string, revision: number, actorId: string) {
        const result = await this.client.query(`UPDATE production_plans p SET deleted_at=now(),deleted_by=$3
          WHERE p.id=$1 AND p.revision=$2 AND p.deleted_at IS NULL
            AND p.status IN ('WAITING_DATA','PENDING_APPROVAL','REJECTED','STALE','SUPERSEDED')
            AND NOT EXISTS(SELECT 1 FROM production_jobs j WHERE j.plan_id=p.id)
            AND NOT EXISTS(SELECT 1 FROM production_holds h WHERE h.plan_id=p.id)
            AND NOT EXISTS(SELECT 1 FROM production_supplies s WHERE s.plan_id=p.id)
          RETURNING p.id`, [id, revision, actorId]);
        if (!result.rowCount) throw new AppError('Kế hoạch đã thay đổi hoặc đã có phân công sản xuất; không thể xóa.', 409);
    }
    async decidePlan(id: string, status: string, actorId: string, note: string) {
        await this.client.query(`UPDATE production_plans SET status=$2,decided_by=$3,decision_note=$4,approved_at=CASE WHEN $2='APPROVED' THEN now() ELSE approved_at END WHERE id=$1`, [id, status, actorId, note]);
    }
    private async consumeStock(key: string, quantity: number) {
        if (!(await this.client.query('UPDATE production_inventory SET available=available-$2,revision=revision+1 WHERE stock_key=$1 AND available>=$2 RETURNING stock_key', [key, quantity])).rowCount)
            throw new AppError('Tồn kho không đủ hoặc chưa xác nhận.', 409);
    }
    async applyPlan(plan: ProductionPlan, _actorId: string) {
        const s = await this.snapshot();
        const groupId = plan.body.groupId ?? (await this.client.query<{
            id: string;
        }>('SELECT gen_random_uuid() AS id')).rows[0].id;
        for (const id of plan.body.itemIds) {
            const r = await this.client.query('UPDATE production_requirements SET group_id=$2 WHERE order_item_id=$1 AND (group_id IS NULL OR group_id=$2::uuid) RETURNING order_item_id', [id, groupId]);
            if (!r.rowCount)
                throw new AppError('Nhu cầu chưa chốt revision hoặc thuộc nhóm khác. Hãy chuẩn bị lại.', 409);
        }
        for (const stock of plan.body.stocks) {
            await this.consumeStock(stock.key, stock.quantity);
            await this.client.query(`INSERT INTO production_supplies(order_item_id,component_revision_id,plan_id,stock_key,quantity,good,inspected_at)
    VALUES($1,$2,$3,$4,$5,$5,now())`, [stock.itemId, stock.componentRevisionId, plan.id, stock.key, stock.quantity]);
        }
        for (const job of plan.body.jobs) {
            const check = s.checks.find(c => c.id === job.checkId)!;
            const profile = s.revisions.find(r => r.id === check.profileRevisionId)!;
            if (profile.kind !== 'PROFILE')
                throw new AppError('Profile không hợp lệ.', 409);
            await this.consumeStock(materialStockKey(profile.body), check.materialQuantity);
            let hold = s.holds.find(h => h.printerId === job.printerId);
            if (!hold) {
                const id = (await this.client.query<{
                    id: string;
                }>('INSERT INTO production_holds(printer_id,group_id,plan_id) VALUES($1,$2,$3) RETURNING id', [job.printerId, groupId, plan.id])).rows[0].id;
                hold = { id, printerId: job.printerId, groupId, itemIds: [] };
                s.holds.push(hold);
            }
            if (hold.groupId !== groupId)
                throw new AppError('Máy đã được giữ cho nhóm khác.', 409);
            // Only products actually using this machine govern its release. Other lines never extend this hold.
            for (const itemId of new Set(job.allocations.map(a => a.itemId)))
                await this.client.query('INSERT INTO production_hold_items(hold_id,order_item_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [hold.id, itemId]);
            const jobId = (await this.client.query<{
                id: string;
            }>(`INSERT INTO production_jobs(job_number,assigned_printer_id,plan_id,hold_id,check_id,planned_start_at,planned_finish_at,metadata_snapshot)
    VALUES('JOB-'||gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING id`, [job.printerId, plan.id, hold.id, check.id, job.startAt, job.finishAt, JSON.stringify(check)])).rows[0].id;
            for (const a of job.allocations)
                await this.client.query(`INSERT INTO production_supplies(order_item_id,component_revision_id,job_id,plan_id,quantity) VALUES($1,$2,$3,$4,$5)`, [a.itemId, a.componentRevisionId, jobId, plan.id, a.quantity]);
        }
    }
    async jobAction(job: ProductionJob, action: 'START' | 'FINISH' | 'QC_READY' | 'FAIL', actorId: string, machineFailure = false) {
        const status = { START: 'PRINTING', FINISH: 'POST_PROCESSING', QC_READY: 'QC_PENDING', FAIL: 'FAILED' }[action];
        await this.client.query(`UPDATE production_jobs SET status=$2::varchar,assigned_operator_id=COALESCE(assigned_operator_id,$3),
   actual_start_at=CASE WHEN $2::varchar='PRINTING' THEN now() ELSE actual_start_at END,
   actual_finish_at=CASE WHEN $2::varchar IN ('POST_PROCESSING','FAILED') THEN now() ELSE actual_finish_at END WHERE id=$1`, [job.id, status, actorId]);
        if (action === 'START') {
            const changed = await this.client.query<{
                id: string;
            }>(`UPDATE orders SET order_status='IN_PRODUCTION',updated_at=now() WHERE order_status='CONFIRMED' AND id IN
    (SELECT i.order_id FROM order_items i JOIN production_supplies a ON a.order_item_id=i.id WHERE a.job_id=$1) RETURNING id`, [job.id]);
            for (const o of changed.rows)
                await this.client.query(`INSERT INTO status_history(entity_type,entity_id,from_status,to_status,changed_by,reason) VALUES('ORDER',$1,'CONFIRMED','IN_PRODUCTION',$2,'Thợ ghi nhận bắt đầu thực tế')`, [o.id, actorId]);
        }
        if (action === 'FAIL') {
            await this.client.query('UPDATE production_supplies SET failed=quantity,inspected_at=now() WHERE job_id=$1', [job.id]);
            if (machineFailure)
                await this.client.query("UPDATE printers SET status='MAINTENANCE' WHERE id=$1", [job.printerId]);
        }
    }
    async inspect(job: ProductionJob, results: {
        supplyId: string;
        good: number;
        failed: number;
    }[], actorId: string) {
        for (const r of results)
            await this.client.query('UPDATE production_supplies SET good=$2,failed=$3,inspected_at=now() WHERE id=$1', [r.supplyId, r.good, r.failed]);
        await this.client.query('UPDATE production_jobs SET status=$2 WHERE id=$1', [job.id, results.some(r => r.failed > 0) ? 'FAILED' : 'COMPLETED']);
        await this.client.query(`INSERT INTO quality_inspections(production_job_id,inspected_by,result,quantity_passed,quantity_failed)
   VALUES($1,$2,$3,$4,$5)`, [job.id, actorId, results.some(r => r.failed > 0) ? 'FAIL' : 'PASS', results.reduce((n, r) => n + r.good, 0), results.reduce((n, r) => n + r.failed, 0)]);
    }
    async pack(itemId: string, ready: boolean, actorId: string) {
        await this.client.query(ready ? 'UPDATE production_requirements SET dispatch_ready_at=now() WHERE order_item_id=$1' : 'UPDATE production_requirements SET packed_at=now() WHERE order_item_id=$1', [itemId]);
        if (!ready) {
            // Release once, only the hold owning these allocations; never overwrite machine condition.
            await this.client.query(`UPDATE production_holds h SET released_at=now() WHERE released_at IS NULL
    AND EXISTS(SELECT 1 FROM production_hold_items x WHERE x.hold_id=h.id AND x.order_item_id=$1)
    AND NOT EXISTS(SELECT 1 FROM production_hold_items x JOIN production_requirements r ON r.order_item_id=x.order_item_id WHERE x.hold_id=h.id AND r.packed_at IS NULL)
    AND NOT EXISTS(SELECT 1 FROM production_jobs j WHERE j.hold_id=h.id AND j.status NOT IN ('COMPLETED','FAILED','CANCELLED'))`, [itemId]);
        }
        const order = (await this.client.query<{
            id: string;
            order_status: string;
        }>(`SELECT o.id,o.order_status FROM orders o JOIN order_items i ON i.order_id=o.id WHERE i.id=$1`, [itemId])).rows[0];
        const target = ready ? 'READY_TO_SHIP' : 'IN_PRODUCTION';
        if (ready) {
            const remaining = await this.client.query(`SELECT i.id FROM order_items i LEFT JOIN production_requirements r ON r.order_item_id=i.id
    WHERE i.order_id=$1 AND ((i.item_type='READY_PRODUCT' AND r.dispatch_ready_at IS NULL) OR (i.item_type='CUSTOM_PRINT' AND i.custom_dispatch_ready_at IS NULL))`, [order.id]);
            if (remaining.rowCount)
                return;
        }
        if ((!ready && order.order_status === 'CONFIRMED') || (ready && order.order_status === 'IN_PRODUCTION')) {
            await this.client.query('UPDATE orders SET order_status=$2,updated_at=now() WHERE id=$1', [order.id, target]);
            await this.client.query(`INSERT INTO status_history(entity_type,entity_id,from_status,to_status,changed_by,reason) VALUES('ORDER',$1,$2,$3,$4,'Bàn giao/đóng gói thực tế')`, [order.id, order.order_status, target, actorId]);
        }
    }
}
export async function lockProduction(client: PoolClient) {
    await lockPrivateFileLifecycle(client);
    await client.query("SELECT pg_advisory_xact_lock(hashtext('minhlab-production-v1'))");
    await client.query("SELECT id FROM orders WHERE order_status IN ('CONFIRMED','IN_PRODUCTION','READY_TO_SHIP') ORDER BY id FOR UPDATE");
}

import { query } from '../../lib/db';
import type { ProductionProgressData } from '../../contracts/orders';
/** Public projection, read only after order ownership/tracking authorization. No workshop IDs or files. */
export async function readProductionProgress(numbers: string[]) {
    if (!numbers.length)
        return new Map<string, ProductionProgressData[]>();
    const rows = (await query<{
        order_number: string;
        item_name: string;
        quantity: number;
        status: ProductionProgressData['status'];
    }>(`SELECT o.order_number,i.item_name_snapshot AS item_name,i.quantity,
 CASE
 WHEN o.order_status='READY_TO_SHIP' OR r.dispatch_ready_at IS NOT NULL OR i.custom_dispatch_ready_at IS NOT NULL THEN 'READY_FOR_DISPATCH'
 WHEN r.packed_at IS NOT NULL OR i.custom_packed_at IS NOT NULL THEN 'PACKING'
 WHEN EXISTS(SELECT 1 FROM production_jobs j WHERE j.status='PRINTING' AND (j.order_item_id=i.id OR EXISTS(SELECT 1 FROM production_supplies a WHERE a.job_id=j.id AND a.order_item_id=i.id))) THEN 'IN_PROGRESS'
 WHEN EXISTS(SELECT 1 FROM production_jobs j WHERE j.status='POST_PROCESSING' AND (j.order_item_id=i.id OR EXISTS(SELECT 1 FROM production_supplies a WHERE a.job_id=j.id AND a.order_item_id=i.id))) THEN 'POST_PROCESSING'
 WHEN EXISTS(SELECT 1 FROM production_jobs j WHERE j.status='QC_PENDING' AND (j.order_item_id=i.id OR EXISTS(SELECT 1 FROM production_supplies a WHERE a.job_id=j.id AND a.order_item_id=i.id))) THEN 'WAITING_QC'
 WHEN EXISTS(SELECT 1 FROM production_jobs j WHERE j.status='QUEUED' AND (j.order_item_id=i.id OR EXISTS(SELECT 1 FROM production_supplies a WHERE a.job_id=j.id AND a.order_item_id=i.id))) THEN 'SCHEDULED'
 WHEN r.group_id IS NOT NULL OR EXISTS(SELECT 1 FROM production_jobs j WHERE j.order_item_id=i.id) THEN 'FINISHING_REVIEW'
 WHEN o.order_status='IN_PRODUCTION' THEN 'IN_PROGRESS'
 WHEN i.item_type='CUSTOM_PRINT' OR COALESCE(r.bom_revision_id,i.manufacturing_revision_id) IS NOT NULL THEN 'WAITING_PLAN'
 ELSE 'WAITING_DATA' END AS status
 FROM orders o JOIN order_items i ON i.order_id=o.id LEFT JOIN production_requirements r ON r.order_item_id=i.id
 WHERE o.order_number=ANY($1::varchar[]) AND o.order_status IN ('CONFIRMED','IN_PRODUCTION','READY_TO_SHIP') ORDER BY o.order_number,i.id`, [numbers])).rows;
    const result = new Map<string, ProductionProgressData[]>();
    for (const r of rows) {
        const items = result.get(r.order_number) ?? [];
        items.push({ itemName: r.item_name, quantity: r.quantity, status: r.status });
        result.set(r.order_number, items);
    }
    return result;
}

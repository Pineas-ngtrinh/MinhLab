import { requestFileRetention, notifyPrintRequestChange } from './file-retention.repository';
import { AppError } from '../../lib/errors';
import type { PoolClient } from 'pg';
import { recordManualFileAnalysis } from './private-file.repository';
import type { PageOptions } from '../../contracts/pagination';
import { pageInfo } from '../../lib/pagination';
import { query } from '../../lib/db';
import type { RequestWriter, RequestState } from '../../services/print-requests/print-request.ports';
import type { PrintRequestView, PrintSubmission, PrintQuoteInput, PrintQuote } from '../../contracts/print-requests';
import type { AcceptedCustomQuote } from '../../domain/orders/accepted-quote';
export class PostgresRequestWriter implements RequestWriter {
    constructor(private readonly c: PoolClient, private readonly createOrder: (input: AcceptedCustomQuote) => Promise<{
        id: string;
        number: string;
    }>) { }
    async list(ownerId: string | undefined, options: PageOptions, reviewerId?: string) {
        const values = [ownerId ?? null, options.status ?? null, reviewerId ?? null];
        const condition = "($1::uuid IS NULL OR customer_id=$1) AND ($2::text IS NULL OR status=$2) AND ($3::uuid IS NULL OR assigned_reviewer_id=$3)";
        const total = Number((await this.c.query<{
            total: string;
        }>(`SELECT count(*) AS total FROM print_requests WHERE ${condition}`, values)).rows[0].total);
        const rows = (await this.c.query<{
            id: string;
        }>(`SELECT id FROM print_requests WHERE ${condition} ORDER BY created_at DESC,id DESC LIMIT $4 OFFSET $5`, [...values, options.pageSize, (options.page - 1) * options.pageSize])).rows;
        const views: PrintRequestView[] = [];
        for (const row of rows) {
            const state = await this.request(row.id);
            if (state)
                views.push(state.view);
        }
        return { data: views, pagination: pageInfo(options, total) };
    }
    async request(id: string): Promise<RequestState | null> {
        const row = (await this.c.query<{
            id: string;
            request_number: string;
            revision: number;
            status: string;
            closed_reason: string | null;
            customer_id: string;
            email_normalized: string;
            assigned_reviewer_id: string | null;
            current_item_id: string;
            customer_note: string | null;
            contact_snapshot: PrintRequestView['contact'];
            rights_declaration_accepted: boolean;
            review_issue: string | null;
        }>(`SELECT r.id,r.request_number,r.revision,r.status,r.closed_reason,r.customer_id,u.email_normalized,r.assigned_reviewer_id,r.current_item_id,r.customer_note,r.contact_snapshot,r.rights_declaration_accepted,r.review_issue
   FROM print_requests r JOIN users u ON u.id=r.customer_id WHERE r.id=$1 FOR UPDATE OF r`, [id])).rows[0];
        if (!row)
            return null;
        const item = (await this.c.query<{
            requested_quantity: number;
            requested_spec: PrintRequestView['requested'];
        }>('SELECT requested_quantity,requested_spec FROM print_request_items WHERE id=$1', [row.current_item_id])).rows[0];
        const file = (await this.c.query<{
            attachment_id: string;
            sha256: string;
            data: NonNullable<PrintRequestView['file']>;
        }>(`SELECT a.id AS attachment_id,f.sha256,jsonb_build_object('id',f.id,'bytes',f.byte_size,'originalFilename',f.original_filename,'scanStatus',f.malware_scan_status,'analysisStatus',f.analysis_status,'analysis',f.analysis_metadata) AS data FROM attachments a JOIN file_assets f ON f.id=a.file_asset_id WHERE a.entity_type='PRINT_REQUEST_ITEM' AND a.entity_id=$1 AND a.purpose='SOURCE_MODEL' ORDER BY a.created_at DESC LIMIT 1`, [row.current_item_id])).rows[0];
        const issue = (await this.c.query<{
            issue_summary: string;
        }>(`SELECT issue_summary FROM file_inspections WHERE print_request_item_id=$1 AND status IN ('NEEDS_REVISION','REJECTED') ORDER BY inspected_at DESC,id DESC LIMIT 1`, [row.current_item_id])).rows[0]?.issue_summary ?? null;
        const quotes = (await this.c.query<{
            data: PrintQuote;
        }>(`SELECT jsonb_build_object('id',q.id,'revision',q.revision_number,'requestRevision',q.request_revision,'status',q.status,
   'quantity',ps.quantity,'unitPrice',qi.unit_price,'shipping',q.shipping_estimate,'total',q.grand_total,'validUntil',q.valid_until,'promisedFinishAt',q.promised_finish_at,
   'terms',q.terms_text,'termsHash',q.terms_hash,'orderNumber',o.order_number,'spec',jsonb_build_object('material',m.material_code,'color',ps.color_name_snapshot,'length',ps.final_length_mm,'width',ps.final_width_mm,'height',ps.final_height_mm,'scale',ps.scale_percent)) AS data
   FROM quotes q JOIN quote_items qi ON qi.quote_id=q.id AND qi.line_type='PRINT' JOIN print_specifications ps ON ps.id=qi.print_specification_id JOIN materials m ON m.id=ps.material_id
   LEFT JOIN orders o ON o.id=q.converted_order_id WHERE q.print_request_id=$1 ORDER BY q.revision_number DESC`, [id])).rows.map(r => r.data);
        const retainedFiles = await requestFileRetention(this.c, id);
        const fileHolds = (await this.c.query<{ id: string; reason: string; reviewAt: string; overdue: boolean }>(
            `SELECT id,reason,to_char(review_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "reviewAt",review_at<=now() AS overdue
             FROM print_file_holds WHERE request_id=$1 AND released_at IS NULL ORDER BY created_at,id`, [id])).rows;
        const retention = retainedFiles.find(f => f.id === file?.data.id);
        return { ownerId: row.customer_id, email: row.email_normalized, attachmentId: file?.attachment_id ?? null, fileHash: file?.sha256 ?? null, view: { closedReason: row.closed_reason, retainedFiles, fileHolds, id: row.id, number: row.request_number, revision: row.revision, status: row.status, assignedReviewerId: row.assigned_reviewer_id, itemId: row.current_item_id, quantity: item?.requested_quantity ?? 0, requested: item?.requested_spec ?? { material: '', color: '', purpose: '' }, note: row.customer_note ?? '', contact: row.contact_snapshot ?? { name: '', phone: '', address: '' }, rightsAccepted: row.rights_declaration_accepted, file: file ? { ...file.data, availability: retention?.availability, scheduledDeletionAt: retention?.scheduledDeletionAt } : null, issue: issue ?? row.review_issue, quotes } };
    }
    async confirmManualAnalysis(r: RequestState, actorId: string, bbox: {
        w: number;
        d: number;
        h: number;
    }, evidenceCode: string) { return !!r.view.file && recordManualFileAnalysis(this.c, r.view.file.id, actorId, bbox, evidenceCode); }
    async fileOwner(id: string, ownerId: string) { return !!(await this.c.query("SELECT id FROM file_assets WHERE id=$1 AND uploaded_by=$2 AND storage_provider='LOCAL_PRIVATE' AND asset_kind IN ('LEGACY','PRINT_SOURCE','PRINT_APPROVED') AND file_extension IN ('stl','obj','step') AND purged_at IS NULL AND upload_status IN ('STORED','AVAILABLE') AND malware_scan_status NOT IN ('INFECTED','FAILED')", [id, ownerId])).rowCount; }
    async submit(input: PrintSubmission, actorId: string, existing?: RequestState) {
        const id = existing?.view.id ?? (await this.c.query<{
            id: string;
        }>(`INSERT INTO print_requests(request_number,customer_id,status,customer_note,rights_declaration_accepted,rights_declared_at,submitted_at,contact_snapshot)
   VALUES('REQ-'||gen_random_uuid()::text,$1,'SUBMITTED',$2,$3,CASE WHEN $3 THEN now() ELSE NULL END,now(),$4::jsonb) RETURNING id`, [actorId, input.note, input.rightsAccepted, JSON.stringify(input.contact)])).rows[0].id;
        const revision = (existing?.view.revision ?? 0) + 1;
        const itemId = (await this.c.query<{
            id: string;
        }>(`INSERT INTO print_request_items(print_request_id,item_number,item_name,requested_quantity,customer_note,status,requested_spec)
   VALUES($1,$2,'Mô hình khách hàng',$3,$4,$5,$6::jsonb) RETURNING id`, [id, revision, input.quantity, input.note, input.fileId ? 'PENDING_REVIEW' : 'PENDING_FILE', JSON.stringify({ material: input.material, color: input.color, purpose: input.purpose })])).rows[0].id;
        if (input.fileId)
            await this.c.query(`INSERT INTO attachments(file_asset_id,entity_type,entity_id,purpose,uploaded_by) VALUES($1,'PRINT_REQUEST_ITEM',$2,'SOURCE_MODEL',$3)`, [input.fileId, itemId, actorId]);
        await this.c.query("UPDATE quotes SET status='SUPERSEDED' WHERE print_request_id=$1 AND status='SENT'", [id]);
        await this.c.query(`UPDATE print_requests SET current_item_id=$2,revision=$3,status=$4,customer_note=$5,rights_declaration_accepted=$6,rights_declared_at=CASE WHEN $6 THEN now() ELSE NULL END,contact_snapshot=$7::jsonb,submitted_at=now(),review_issue=NULL,closed_at=NULL,closed_reason=NULL
   WHERE id=$1`, [id, itemId, revision, input.fileId ? 'SUBMITTED' : 'NEEDS_REVISION', input.note, input.rightsAccepted, JSON.stringify(input.contact)]);
        await notifyPrintRequestChange(this.c, id);
        return id;
    }
    async canReuseFiles(id: string) {
        return !(await this.c.query(`SELECT 1 FROM attachments a JOIN print_request_items i ON a.entity_type='PRINT_REQUEST_ITEM' AND a.entity_id=i.id
            JOIN file_assets f ON f.id=a.file_asset_id WHERE i.print_request_id=$1 AND (f.upload_status='DELETED' OR f.purged_at IS NOT NULL)`, [id])).rowCount;
    }
    async lifecycle(id: string, action: 'CLOSE' | 'REOPEN' | 'HOLD' | 'RELEASE_HOLD', actorId: string, note: string, reviewAt?: string, holdId?: string) {
        if (action === 'HOLD') {
            await this.c.query('INSERT INTO print_file_holds(request_id,reason,created_by,review_at) VALUES($1,$2,$3,$4)', [id, note, actorId, reviewAt]);
            return;
        }
        if (action === 'RELEASE_HOLD') {
            const result = await this.c.query('UPDATE print_file_holds SET released_at=now(),released_by=$3,resolution=$4 WHERE id=$1 AND request_id=$2 AND released_at IS NULL RETURNING id', [holdId, id, actorId, note]);
            if (!result.rowCount) throw new AppError('Không tìm thấy lần giữ file đang hoạt động.', 409);
            return;
        }
        if (action === 'CLOSE') {
            await this.c.query(`UPDATE print_requests SET status='CLOSED',closed_at=now(),closed_reason=CASE WHEN customer_id=$2 THEN 'CUSTOMER_CLOSED' ELSE 'STAFF_CLOSED' END,review_issue=$3,revision=revision+1 WHERE id=$1`, [id, actorId, note]);
        } else {
            await this.c.query("UPDATE print_requests SET status='NEEDS_REVISION',closed_at=NULL,closed_reason=NULL,review_issue=$2,revision=revision+1 WHERE id=$1", [id, note]);
        }
        await this.c.query("UPDATE quotes SET status='SUPERSEDED' WHERE print_request_id=$1 AND status='SENT'", [id]);
        await notifyPrintRequestChange(this.c, id);
    }
    async claim(id: string, reviewerId: string) { await this.c.query("UPDATE print_requests SET assigned_reviewer_id=$2,status='UNDER_REVIEW' WHERE id=$1", [id, reviewerId]); }
    async reviewerExists(id: string) { return !!(await this.c.query("SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE u.id=$1 AND u.status='ACTIVE' AND u.deleted_at IS NULL AND r.code='FILE_REVIEWER'", [id])).rowCount; }
    async assign(id: string, reviewerId: string) { await this.c.query('UPDATE print_requests SET assigned_reviewer_id=$2 WHERE id=$1', [id, reviewerId]); }
    async decline(id: string, quoteId: string, note: string) { await this.c.query("UPDATE quotes SET status='DECLINED' WHERE id=$1", [quoteId]); await this.c.query("UPDATE print_requests SET status='NEEDS_REVISION',review_issue=$2 WHERE id=$1", [id, note]); }
    async decision(r: RequestState, status: 'NEEDS_REVISION' | 'REJECTED', note: string, actorId: string) {
        await this.c.query(`UPDATE print_requests SET status=$2,review_issue=$3,closed_at=CASE WHEN $2='REJECTED' THEN now() ELSE NULL END,closed_reason=CASE WHEN $2='REJECTED' THEN 'REJECTED' ELSE NULL END WHERE id=$1`, [r.view.id, status, note]);
        await this.c.query("UPDATE quotes SET status='SUPERSEDED' WHERE print_request_id=$1 AND status='SENT'", [r.view.id]);
        if (r.attachmentId)
            await this.c.query('INSERT INTO file_inspections(print_request_item_id,attachment_id,inspected_by,status,issue_summary) VALUES($1,$2,$3,$4,$5)', [r.view.itemId, r.attachmentId, actorId, status, note]);
        else
            await this.c.query('UPDATE print_request_items SET customer_note=$2 WHERE id=$1', [r.view.itemId, note]);
        await notifyPrintRequestChange(this.c, r.view.id);
    }
    async material(id: string) {
        const r = (await this.c.query<{
            id: string;
            material_code: string;
            product_name: string | null;
        }>("SELECT id,material_code,product_name FROM materials WHERE id=$1 AND status='ACTIVE'", [id])).rows[0];
        return r ? { id: r.id, name: r.product_name ?? r.material_code } : null;
    }
    async issue(r: RequestState, input: PrintQuoteInput, termsHash: string, actorId: string) {
        const specId = (await this.c.query<{
            id: string;
        }>(`INSERT INTO print_specifications(print_request_item_id,attachment_id,material_id,created_by,revision_number,source_file_sha256,
   final_length_mm,final_width_mm,final_height_mm,scale_percent,quantity,color_name_snapshot,status)
   SELECT $1,$2,$3,$4,COALESCE(max(revision_number),0)+1,$5,$6,$7,$8,$9,$10,$11,'APPROVED' FROM print_specifications WHERE print_request_item_id=$1 RETURNING id`, [r.view.itemId, r.attachmentId, input.materialId, actorId, r.fileHash, input.length, input.width, input.height, input.scale, r.view.quantity, input.color])).rows[0].id;
        await this.c.query("UPDATE quotes SET status='SUPERSEDED' WHERE print_request_id=$1 AND status='SENT'", [r.view.id]);
        const subtotal = r.view.quantity * input.unitPrice;
        const quoteId = (await this.c.query<{
            id: string;
        }>(`INSERT INTO quotes(quote_number,print_request_id,created_by,revision_number,status,subtotal,shipping_estimate,grand_total,valid_until,request_revision,promised_finish_at,terms_text,terms_hash)
   SELECT 'Q-'||gen_random_uuid()::text,$1,$2,COALESCE(max(revision_number),0)+1,'SENT',$3,$4,$5,$6,$7,$8,$9,$10 FROM quotes WHERE print_request_id=$1 RETURNING id`, [r.view.id, actorId, subtotal, input.shipping, subtotal + input.shipping, input.validUntil, input.revision, input.promisedFinishAt, input.terms, termsHash])).rows[0].id;
        await this.c.query("INSERT INTO quote_items(quote_id,print_specification_id,line_number,line_type,description,quantity,unit_price,line_total) VALUES($1,$2,1,'PRINT','Giá mỗi bản bao gồm toàn bộ phụ phí chế tạo',$3,$4,$5)", [quoteId, specId, r.view.quantity, input.unitPrice, subtotal]);
        await this.c.query("INSERT INTO file_inspections(print_request_item_id,attachment_id,inspected_by,status,issue_summary) VALUES($1,$2,$3,'APPROVED',$4)", [r.view.itemId, r.attachmentId, actorId, `Xác nhận kỹ thuật ${input.evidenceCode}`]);
        await this.c.query("UPDATE print_requests SET status='READY_FOR_QUOTE' WHERE id=$1", [r.view.id]);
        await this.c.query(`INSERT INTO email_outbox(dedup_key,recipient,subject,body_text,notification_type) VALUES($1,$2,$3,$4,'CUSTOM_QUOTE_ISSUED') ON CONFLICT(dedup_key) DO NOTHING`, [`custom-quote:${quoteId}`, r.email, `Báo giá cho ${r.view.number}`, `Xưởng đã phát hành báo giá cho yêu cầu ${r.view.number}. Đăng nhập website, mở mục Yêu cầu in và báo giá để xem đúng revision và quyết định. Chưa tạo đơn hoặc ghi nhận đã thanh toán.`]);
        return quoteId;
    }
    async conversion(quoteId: string) {
        return (await this.c.query<{
            number: string;
        }>(`SELECT o.order_number AS number FROM quotes q JOIN orders o ON o.id=q.converted_order_id WHERE q.id=$1`, [quoteId])).rows[0] ?? null;
    }
    async convert(r: RequestState, quoteId: string, actorId: string, input: Omit<AcceptedCustomQuote, 'customerId' | 'email' | 'name' | 'phone' | 'address' | 'specificationId'>) {
        const q = r.view.quotes.find(q => q.id === quoteId)!;
        const spec = (await this.c.query<{
            print_specification_id: string;
        }>("SELECT print_specification_id FROM quote_items WHERE quote_id=$1 AND line_type='PRINT'", [quoteId])).rows[0];
        const approval = (await this.c.query<{
            id: string;
        }>(`INSERT INTO customer_approvals(customer_id,print_request_id,quote_id,approval_status,approved_file_hashes,specification_snapshot,quote_snapshot,terms_version_code,terms_content_sha256,rights_declaration_accepted)
   VALUES($1,$2,$3,'ACCEPTED',$4::jsonb,$5::jsonb,$6::jsonb,'CUSTOM_V1',$7,true) RETURNING id`, [actorId, r.view.id, quoteId, JSON.stringify([r.fileHash]), JSON.stringify(q.spec), JSON.stringify(q), q.termsHash])).rows[0].id;
        const order = await this.createOrder({ ...input, specificationId: spec.print_specification_id, customerId: r.ownerId, email: r.email, name: r.view.contact.name, phone: r.view.contact.phone, address: r.view.contact.address });
        await this.c.query('UPDATE orders SET accepted_quote_id=$2,customer_approval_id=$3 WHERE id=$1', [order.id, quoteId, approval]);
        await this.c.query("UPDATE quotes SET status='CONVERTED',converted_order_id=$2 WHERE id=$1", [quoteId, order.id]);
        await this.c.query("UPDATE print_requests SET status='CLOSED',closed_at=now(),closed_reason='CONVERTED' WHERE id=$1", [r.view.id]);
        await this.audit('QUOTE_ACCEPTED_AND_CONVERTED', quoteId, actorId, { orderId: order.id, approvalId: approval });
        return { number: order.number };
    }
    async audit(action: string, id: string, actorId: string, detail: unknown) { await this.c.query("INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,new_values) VALUES($1,$2,'PRINT_REQUEST',$3,$4::jsonb)", [actorId, action, id, JSON.stringify(detail)]); }
    async replay(key: string) {
        const r = (await this.c.query<{
            actor_id: string;
            request_hash: string;
            result: unknown;
        }>('SELECT actor_id,request_hash,result FROM print_request_operations WHERE operation_key=$1', [key])).rows[0];
        return r ? { actorId: r.actor_id, hash: r.request_hash, result: r.result } : null;
    }
    async remember(key: string, actorId: string, hash: string, result: unknown) { await this.c.query('INSERT INTO print_request_operations(operation_key,actor_id,request_hash,result) VALUES($1,$2,$3,$4::jsonb)', [key, actorId, hash, JSON.stringify(result)]); }
}
export async function readRequestMaterials() {
    return (await query<{
        id: string;
        name: string;
    }>("SELECT id,material_code||' / '||COALESCE(product_name,material_type)||' / '||color_name AS name FROM materials WHERE status='ACTIVE' ORDER BY material_code")).rows;
}
export async function lockPrintRequests(c: PoolClient) { await c.query("SELECT pg_advisory_xact_lock(hashtext('minhlab-custom-print-v1'))"); }
export async function readFileReviewers() {
    return (await query<{
        id: string;
        name: string;
    }>("SELECT DISTINCT u.id,u.full_name AS name FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE u.status='ACTIVE' AND u.deleted_at IS NULL AND r.code='FILE_REVIEWER' ORDER BY u.full_name,u.id")).rows;
}

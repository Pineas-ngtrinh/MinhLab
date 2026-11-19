import { query, withTransaction } from '../../lib/db';
import { AppError } from '../../lib/errors';
interface RunClaim {
    id: string;
    scopeIds: string[];
    planId: string | null;
}
export const productionAgentRepository = {
    async claim(input: {
        key: string;
        hash: string;
        scopeIds: string[];
        eventId: string | null;
        requestedBy: string | null;
        model: string | null;
    }): Promise<RunClaim> {
        return withTransaction(async (c) => {
            await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`production-agent:${input.key}`]);
            let prior = (await c.query<{
                id: string;
                request_hash: string;
                scope_ids: string[];
                plan_id: string | null;
                lease_active: boolean;
                attempts: number;
            }>('SELECT id,request_hash,scope_ids,plan_id,lease_until>now() AS lease_active,attempts FROM production_agent_runs WHERE request_key=$1 FOR UPDATE', [input.key])).rows[0];
            if (prior) {
                if (prior.request_hash !== input.hash)
                    throw new AppError('Khóa yêu cầu AI đã dùng với phạm vi/nội dung khác.', 409);
                if (prior.plan_id)
                    return { id: prior.id, scopeIds: prior.scope_ids, planId: prior.plan_id };
                // Recover a draft committed just before a process died, without calling the provider again.
                const committed = (await c.query<{
                    plan_id: string;
                }>("SELECT result->>'id' AS plan_id FROM production_operations WHERE operation_key IN ($1,$2) AND actor_id='production-agent'", [`agent-draft-${prior.id}`, `agent-local-draft-${prior.id}`])).rows[0]?.plan_id;
                if (committed) {
                    await c.query("UPDATE production_agent_runs SET status='SUCCEEDED',plan_id=$2,lease_until=NULL WHERE id=$1", [prior.id, committed]);
                    return { id: prior.id, scopeIds: prior.scope_ids, planId: committed };
                }
                if (prior.lease_active)
                    throw new AppError('Agent đang xử lý yêu cầu này. Hãy thử tải lại sau.', 409);
                if (prior.attempts >= 5)
                    throw new AppError('Yêu cầu AI đã dừng sau năm lần thử; cần người phụ trách kiểm tra.', 409);
                await c.query("UPDATE production_agent_runs SET status='FAILED',model=$2,attempts=attempts+1,lease_until=now()+interval '2 minutes' WHERE id=$1", [prior.id, input.model]);
            }
            else {
                const inserted = (await c.query<{
                    id: string;
                }>(`INSERT INTO production_agent_runs(event_id,model,status,request_key,request_hash,scope_ids,requested_by,attempts,lease_until)
     VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,1,now()+interval '2 minutes') RETURNING id`, [input.eventId, input.model, 'FAILED', input.key, input.hash, JSON.stringify(input.scopeIds), input.requestedBy])).rows[0];
                prior = { id: inserted.id, request_hash: input.hash, scope_ids: input.scopeIds, plan_id: null, lease_active: true, attempts: 1 };
            }
            return { id: prior.id, scopeIds: prior.scope_ids, planId: null };
        });
    },
    async totals(id: string) {
        const { rows } = await query<{ orders: number; batches: number; blockers: number }>(`SELECT
          (SELECT count(DISTINCT order_id)::int FROM order_items WHERE id::text IN (SELECT jsonb_array_elements_text(body->'itemIds'))) AS orders,
          jsonb_array_length(body->'jobs') AS batches,jsonb_array_length(body->'blockers') AS blockers FROM production_plans WHERE id=$1`, [id]);
        return rows[0];
    },
    async finish(id: string, planId: string, hash: string) { await query("UPDATE production_agent_runs SET status='SUCCEEDED',plan_id=$2,snapshot_hash=$3,lease_until=NULL WHERE id=$1", [id, planId, hash]); },
    async fail(id: string) { await query("UPDATE production_agent_runs SET status='FAILED',lease_until=NULL WHERE id=$1", [id]); },
    async audit(id: string, actorId: string) { await query("INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id) VALUES($1,'AGENT_RUN_REQUESTED','PRODUCTION',$2)", [actorId, id]); },
};

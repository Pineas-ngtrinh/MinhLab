import { createHash } from 'node:crypto';
import { ProductionService } from './production';
import { productionAgentConfig, runConfiguredProductionAgent } from '../integrations/production/openai-agent';
import { productionAgentRepository } from '../repositories/production/agent.repository';
import { explainPlan } from '../integrations/production/plan-explanation';
import { AppError } from '../lib/errors';
import { eligible, suggestBatchChecks } from '../domain/production/planning';
import type { ProductionSnapshot } from '../contracts/production';
import { productionIds, productionRecord } from '../lib/production-validation';
/** Explicit projection. Never pass workspace DTOs, body strings, file evidence, names or commerce data to a provider. */
export function agentMetadata(s: ProductionSnapshot, scope: string[]) {
    return {
        items: s.items.filter(i => scope.includes(i.id) && eligible(i) && !i.packedAt).map(i => ({ id: i.id, variantId: i.variantId, quantity: i.quantity, bomRevisionId: i.bomRevisionId, groupId: i.groupId, placedAt: i.placedAt })),
        revisions: s.revisions.filter(r => r.status === 'PUBLISHED').map(r => r.kind === 'COMPONENT' ? { id: r.id, kind: r.kind, revision: r.revision, routing: r.body.routing, objectsPerUnit: r.body.objectsPerUnit, mirrorRequired: r.body.mirrorRequired, technology: r.body.technology, material: r.body.material, color: r.body.color, appearance: r.body.appearance } : r.kind === 'BOM' ? { id: r.id, kind: r.kind, revision: r.revision, variantId: r.variantId, lines: r.body.lines } : { id: r.id, kind: r.kind, revision: r.revision, printerId: r.printerId, technology: r.body.technology, material: r.body.material, color: r.body.color, appearance: r.body.appearance }),
        inventory: s.inventory.map(i => ({ key: i.key, available: i.available, revision: i.revision })),
        checks: s.checks.filter(c => !c.revoked).map(c => ({ id: c.id, profileRevisionId: c.profileRevisionId, members: c.members, durationMinutes: c.durationMinutes, preparationMinutes: c.preparationMinutes, finishingMinutes: c.finishingMinutes, materialQuantity: c.materialQuantity })),
        printers: s.printers.map(p => ({ id: p.id, technology: p.technology, status: p.status })),
        supplies: s.supplies.filter(a => scope.includes(a.itemId)).map(a => ({ itemId: a.itemId, componentRevisionId: a.componentRevisionId, quantity: a.quantity, good: a.good, failed: a.failed })),
        holds: s.holds.map(h => ({ printerId: h.printerId, groupId: h.groupId })),
    };
}
function selectedDraft(value: unknown, scopeIds: string[]) {
    let record: Record<string, unknown>;
    try {
        record = productionRecord(value);
    }
    catch {
        throw new AppError('AI trả về kế hoạch không đúng định dạng.', 502);
    }
    if (Object.keys(record).length !== 2 || !Array.isArray(record.itemIds) || !Array.isArray(record.checkIds))
        throw new AppError('AI trả về kế hoạch không đúng định dạng.', 502);
    let itemIds: string[];
    let checkIds: string[];
    try {
        itemIds = productionIds(record.itemIds);
        checkIds = record.checkIds.length ? productionIds(record.checkIds, false) : [];
    }
    catch {
        throw new AppError('AI trả về mã đơn hoặc mẻ in không hợp lệ.', 502);
    }
    if (itemIds.length !== scopeIds.length || itemIds.some(id => !scopeIds.includes(id)))
        throw new AppError('AI đề xuất mặt hàng ngoài phạm vi được giao.', 502);
    return { itemIds, checkIds };
}
function planReference(value: unknown): { id: string } {
    if (!value || typeof value !== 'object' || !('id' in value) || typeof value.id !== 'string')
        throw new AppError('Chưa lưu được kế hoạch in.', 500);
    return { id: value.id };
}
export async function runProductionAgent(input: {
    itemIds: string[];
    startAt?: string;
    key: string;
    requestedBy?: string;
    eventId?: string;
}) {
    const config = productionAgentConfig();
    const requestKey = input.eventId ? `event-${input.eventId}` : createHash('sha256').update(JSON.stringify({ actor: input.requestedBy, key: input.key })).digest('hex');
    const requestHash = createHash('sha256').update(JSON.stringify(input.eventId ? { eventId: input.eventId } : { itemIds: input.itemIds, startAt: input.startAt, requestedBy: input.requestedBy })).digest('hex');
    const run = await productionAgentRepository.claim({ key: requestKey, hash: requestHash, scopeIds: input.itemIds, eventId: input.eventId ?? null, requestedBy: input.requestedBy ?? null, model: config?.model ?? null });
    if (run.planId)
        return { id: run.planId };
    const runId = run.id;
    if (input.requestedBy)
        await productionAgentRepository.audit(runId, input.requestedBy);
    try {
        await ProductionService.prepare({ id: 'production-agent', role: 'AGENT' }, `agent-prepare-${runId}`, run.scopeIds);
        const startAt = input.startAt ?? new Date().toISOString();
        const s = await ProductionService.workspace();
        const hash = createHash('sha256').update(JSON.stringify(agentMetadata(s, run.scopeIds))).digest('hex');
        const actor = { id: 'production-agent', role: 'AGENT' as const };
        let result: { id: string };
        let providerFallback = false;
        if (config) {
            let coreDraftError: unknown;
            try {
                result = await runConfiguredProductionAgent(config, {
                    read: async () => agentMetadata(s, run.scopeIds),
                    draft: async value => {
                        const draft = selectedDraft(value, run.scopeIds);
                        try {
                            return planReference(await ProductionService.propose(actor, `agent-draft-${runId}`, draft.itemIds, draft.checkIds, startAt, undefined, !input.startAt));
                        }
                        catch (error) {
                            coreDraftError = error;
                            throw error;
                        }
                    },
                });
            }
            catch (error) {
                if (error === coreDraftError || !(error instanceof AppError) || (error.status !== 502 && error.status !== 503))
                    throw error;
                providerFallback = true;
                const checkIds = suggestBatchChecks(s, run.scopeIds, startAt);
                result = planReference(await ProductionService.propose(actor, `agent-local-draft-${runId}`, run.scopeIds, checkIds, startAt, undefined, !input.startAt));
            }
        }
        else {
            const checkIds = suggestBatchChecks(s, run.scopeIds, startAt);
            result = planReference(await ProductionService.propose(actor, `agent-local-draft-${runId}`, run.scopeIds, checkIds, startAt, undefined, !input.startAt));
        }
        await productionAgentRepository.finish(runId, result.id, hash);
        const saved = await productionAgentRepository.totals(result.id).catch(() => null);
        if (!saved) return { id: result.id };
        const explanation = await explainPlan(saved, providerFallback ? null : config);
        return { id: result.id, explanation: providerFallback ? `AI chưa phản hồi; đã dùng bộ tối ưu nội bộ. ${explanation}` : explanation };
    }
    catch (error) {
        await productionAgentRepository.fail(runId);
        throw error;
    }
}

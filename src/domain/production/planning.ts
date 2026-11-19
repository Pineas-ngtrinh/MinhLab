import { groupingDecision } from './grouping-rules';
import { fitPlate, type Piece } from './plate-layout';
import type { Revision, RevisionInput, ProductionSnapshot, ProductionItem, PlanBody, TechnicalCheckInput, PlannedJob } from '../../contracts/production';
export const componentStockKey = (id: string) => `component:${id}`;
export const finishedStockKey = (variant: string, bom: string) => `finished:${variant}:${bom}`;
export const materialStockKey = (spec: {
    material: string;
    color: string;
    appearance: string;
}) => `material:${spec.material}:${spec.color}:${spec.appearance}`;
export const eligible = (item: ProductionItem) => ['CONFIRMED', 'IN_PRODUCTION'].includes(item.orderStatus) && (item.paymentStatus === 'PAID' || item.paymentTiming === 'COD');
export const published = (s: ProductionSnapshot, id: string | null) => s.revisions.find(r => r.id === id && r.status === 'PUBLISHED');
export const compatibilityKey = (spec: {
    technology: string;
    material: string;
    color: string;
    appearance: string;
}) => JSON.stringify([spec.technology, spec.material, spec.color, spec.appearance]);
export function revisionProblems(input: RevisionInput | Revision, snapshot: ProductionSnapshot): string[] {
    const problems: string[] = [];
    if (input.kind === 'BOM') {
        if (!input.body.lines.length)
            problems.push('BOM_EMPTY');
        const seen = new Set<string>();
        for (const line of input.body.lines) {
            if (!Number.isInteger(line.quantity) || line.quantity < 1)
                problems.push('INVALID_BOM_QUANTITY');
            const c = published(snapshot, line.componentRevisionId);
            if (!c || c.kind !== 'COMPONENT')
                problems.push(`COMPONENT_NOT_PUBLISHED:${line.componentRevisionId}`);
            if (seen.has(line.componentRevisionId))
                problems.push('DUPLICATE_BOM_COMPONENT');
            seen.add(line.componentRevisionId);
        }
    }
    else if (input.kind === 'COMPONENT') {
        if (!input.body.unit || input.body.objectsPerUnit === null || !Number.isInteger(input.body.objectsPerUnit) || input.body.objectsPerUnit < 1)
            problems.push('COMPONENT_UNIT_UNCONFIRMED');
        if (input.body.routing === 'PRINTED' && (!input.body.technology || !input.body.material || !input.body.color || !input.body.appearance))
            problems.push('PRINT_SPEC_INCOMPLETE');
    }
    else if (input.kind === 'PROFILE') {
        if (!input.body.technology || !input.body.material || !input.body.color || !input.body.appearance || !input.body.processCode)
            problems.push('PROFILE_INCOMPLETE');
        const printer = snapshot.printers.find(p => p.id === input.printerId);
        if (!printer || printer.technology !== input.body.technology)
            problems.push('PRINTER_TECHNOLOGY_MISMATCH');
    }
    return problems;
}
export function checkProblems(check: TechnicalCheckInput, s: ProductionSnapshot): string[] {
    const profile = published(s, check.profileRevisionId);
    if (!profile || profile.kind !== 'PROFILE')
        return ['PROFILE_NOT_PUBLISHED'];
    const problems: string[] = [];
    if (!s.printers.some(p => p.id === profile.printerId && p.technology === profile.body.technology))
        problems.push('Công nghệ máy hiện tại không khớp hồ sơ in.');
    if (!Number.isInteger(check.durationMinutes) || check.durationMinutes < 1 || !Number.isInteger(check.preparationMinutes) || check.preparationMinutes < 0 || !Number.isInteger(check.finishingMinutes) || check.finishingMinutes < 0 || !Number.isFinite(check.materialQuantity) || check.materialQuantity <= 0)
        problems.push('INVALID_BATCH_ESTIMATE');
    if (!check.resourcesConfirmed)
        problems.push('WORKSHOP_RESOURCES_UNCONFIRMED');
    const seen = new Set<string>();
    const pieces: Piece[] = [];
    for (const member of check.members) {
        if (!Number.isInteger(member.quantity) || member.quantity < 1)
            problems.push('INVALID_BATCH_QUANTITY');
        const c = published(s, member.componentRevisionId);
        if (!c || c.kind !== 'COMPONENT' || c.body.routing !== 'PRINTED')
            problems.push(`COMPONENT_NOT_PRINTABLE:${member.componentRevisionId}`);
        else if (compatibilityKey(c.body) !== compatibilityKey(profile.body))
            problems.push(`PROFILE_INCOMPATIBLE:${member.componentRevisionId}`);
        if (profile.body.plate && c?.kind === 'COMPONENT') {
            if (!c.body.envelope) problems.push('Chưa có kích thước cả đơn vị linh kiện để kiểm tra bàn in.');
            else pieces.push({ id: c.id, size: c.body.envelope, count: member.quantity });
        }
        if (seen.has(member.componentRevisionId))
            problems.push('DUPLICATE_CHECK_COMPONENT');
        seen.add(member.componentRevisionId);
    }
    if (profile.body.groupingRules?.length) {
        const parts = check.members.flatMap(m => { const c = published(s,m.componentRevisionId); return c?.kind==='COMPONENT' ? [c.body] : []; });
        const decision = groupingDecision(profile.body.groupingRules,parts);
        if (!decision.permitted) problems.push(`Quy tắc chặn mẻ: ${decision.ids.join(', ')}${decision.conflict ? ' (xung đột cùng ưu tiên)' : ''}.`);
    }
    if (profile.body.plate && pieces.length && !fitPlate(profile.body.plate, pieces))
        problems.push('Chưa xếp được mẻ theo kích thước và khoảng hở đã xác nhận.');
    return problems;
}
/** N - E - G - A: failed units leave A, good units never also enter inventory. */
export function unmet(s: ProductionSnapshot, item: ProductionItem): {
    componentRevisionId: string;
    quantity: number;
}[] | null {
    const bom = published(s, item.bomRevisionId);
    if (!bom || bom.kind !== 'BOM')
        return null;
    const supplies = s.supplies.filter(x => x.itemId === item.id);
    const finished = supplies.filter(x => x.componentRevisionId === null).reduce((n, x) => n + x.good, 0);
    return bom.body.lines.map(line => ({ componentRevisionId: line.componentRevisionId,
        quantity: Math.max(0, (item.quantity - finished) * line.quantity - supplies.filter(x => x.componentRevisionId === line.componentRevisionId).reduce((n, x) => n + x.quantity - x.failed, 0)) }));
}
/** Builds reviewable candidates from exact, human-verified batch metadata. No geometry or invented capacity. */
export function buildPlan(s: ProductionSnapshot, itemIds: string[], checkIds: string[], startAt: string): PlanBody {
    const plan: PlanBody = { itemIds, stocks: [], jobs: [], blockers: [], warnings: ['NO_DUE_DATE: ưu tiên FIFO; chưa có hạn giao được xác nhận.'], groupId: null };
    const items = itemIds.map(id => s.items.find(x => x.id === id)).sort((a, b) => Date.parse(a?.placedAt ?? '') - Date.parse(b?.placedAt ?? '') || (a?.id ?? '').localeCompare(b?.id ?? ''));
    const groups = new Set(items.filter((x): x is ProductionItem => !!x).map(x => x.groupId).filter((x): x is string => !!x));
    if (groups.size > 1)
        plan.blockers.push('GROUP_CONFLICT: Không hợp nhất các nhóm đang giữ máy.');
    plan.groupId = [...groups][0] ?? null;
    const available = new Map(s.inventory.map(x => [x.key, x.available]));
    const needs: {
        itemId: string;
        componentRevisionId: string;
        quantity: number;
    }[] = [];
    for (const item of items) {
        if (!item || !eligible(item) || item.packedAt) {
            plan.blockers.push(`ORDER_INELIGIBLE:${item?.id ?? 'missing'}`);
            continue;
        }
        const bom = published(s, item.bomRevisionId);
        if (!bom || bom.kind !== 'BOM') {
            plan.blockers.push(`BOM_NOT_PUBLISHED:${item.sku}`);
            continue;
        }
        const prior = s.supplies.filter(x => x.itemId === item.id);
        const finished = prior.filter(x => x.componentRevisionId === null).reduce((n, x) => n + x.good, 0);
        // Do not assign finished kits after components/jobs have already been committed.
        let newFinished = 0;
        if (!prior.length) {
            const key = finishedStockKey(item.variantId, bom.id);
            if (!available.has(key))
                plan.blockers.push(`INVENTORY_UNKNOWN:${key}`);
            else {
                newFinished = Math.min(item.quantity - finished, available.get(key)!);
                if (newFinished > 0) {
                    plan.stocks.push({ itemId: item.id, componentRevisionId: null, key, quantity: newFinished });
                    available.set(key, available.get(key)! - newFinished);
                }
            }
        }
        for (const line of bom.body.lines) {
            const c = published(s, line.componentRevisionId);
            if (!c || c.kind !== 'COMPONENT') {
                plan.blockers.push(`COMPONENT_NOT_PUBLISHED:${line.componentRevisionId}`);
                continue;
            }
            let quantity = (item.quantity - finished - newFinished) * line.quantity - prior.filter(x => x.componentRevisionId === c.id).reduce((n, x) => n + x.quantity - x.failed, 0);
            if (quantity <= 0)
                continue;
            const key = componentStockKey(c.id);
            if (!available.has(key))
                plan.blockers.push(`INVENTORY_UNKNOWN:${key}`);
            else {
                const count = Math.min(quantity, available.get(key)!);
                if (count > 0) {
                    plan.stocks.push({ itemId: item.id, componentRevisionId: c.id, key, quantity: count });
                    available.set(key, available.get(key)! - count);
                    quantity -= count;
                }
            }
            if (quantity > 0) {
                if (c.body.routing !== 'PRINTED')
                    plan.blockers.push(`ACCESSORY_WAITING:${c.code}:${quantity}`);
                else
                    needs.push({ itemId: item.id, componentRevisionId: c.id, quantity });
            }
        }
    }
    const nextStart = new Map<string, number>();
    for (const checkId of checkIds) {
        const check = s.checks.find(c => c.id === checkId && !c.revoked);
        if (!check) {
            plan.blockers.push(`CHECK_UNAVAILABLE:${checkId}`);
            continue;
        }
        const problems = checkProblems(check, s);
        if (problems.length) {
            plan.blockers.push(...problems);
            continue;
        }
        const profile = published(s, check.profileRevisionId)!;
        if (profile.kind !== 'PROFILE')
            continue;
        const printer = s.printers.find(p => p.id === profile.printerId);
        const hold = s.holds.find(h => h.printerId === profile.printerId);
        if (!printer || printer.status !== 'AVAILABLE' || (hold && hold.groupId !== plan.groupId))
            plan.blockers.push(`MACHINE_WAITING:${profile.printerId}`);
        const membersFit = check.members.every(m => needs.filter(n => n.componentRevisionId === m.componentRevisionId).reduce((n, x) => n + x.quantity, 0) >= m.quantity);
        if (!membersFit) {
            plan.blockers.push(`CHECK_QUANTITY_MISMATCH:${check.code}`);
            continue;
        }
        const allocations: PlannedJob['allocations'] = [];
        for (const member of check.members) {
            if (!Number.isInteger(member.quantity) || member.quantity < 1)
                problems.push('INVALID_BATCH_QUANTITY');
            let left = member.quantity;
            for (const need of needs.filter(n => n.componentRevisionId === member.componentRevisionId)) {
                const quantity = Math.min(need.quantity, left);
                if (quantity > 0) {
                    allocations.push({ itemId: need.itemId, componentRevisionId: need.componentRevisionId, quantity });
                    need.quantity -= quantity;
                    left -= quantity;
                }
            }
        }
        const materialKey = materialStockKey(profile.body);
        if (!available.has(materialKey))
            plan.blockers.push(`INVENTORY_UNKNOWN:${materialKey}`);
        else if (available.get(materialKey)! < check.materialQuantity)
            plan.blockers.push(`MATERIAL_SHORTAGE:${materialKey}`);
        else
            available.set(materialKey, available.get(materialKey)! - check.materialQuantity);
        const start = nextStart.get(profile.printerId) ?? Date.parse(startAt);
        const finish = start + (check.preparationMinutes + check.durationMinutes) * 60000;
        const packing = finish + check.finishingMinutes * 60000;
        const conflicts = s.jobs.some(j => j.printerId === profile.printerId && !['COMPLETED', 'FAILED', 'CANCELLED'].includes(j.status) && Date.parse(j.startAt) < finish && Date.parse(j.finishAt) > start);
        if (conflicts)
            plan.blockers.push(`SCHEDULE_CONFLICT:${profile.printerId}`);
        plan.jobs.push({ checkId, printerId: profile.printerId, startAt: new Date(start).toISOString(), finishAt: new Date(finish).toISOString(), packingAt: new Date(packing).toISOString(), allocations });
        nextStart.set(profile.printerId, finish);
    }
    const outstanding = new Map<string, number>();
    for (const need of needs.filter(n => n.quantity > 0))
        outstanding.set(need.componentRevisionId, (outstanding.get(need.componentRevisionId) ?? 0) + need.quantity);
    for (const [componentRevisionId, quantity] of outstanding)
        plan.blockers.push(`TECHNICAL_CHECK_REQUIRED:${componentRevisionId}:${quantity}`);
    if (!plan.stocks.length && !plan.jobs.length && !plan.blockers.length)
        plan.blockers.push('NO_UNCOVERED_DEMAND');
    plan.blockers = [...new Set(plan.blockers)];
    return plan;
}
export function canPack(s: ProductionSnapshot, item: ProductionItem): boolean {
    const bom = published(s, item.bomRevisionId);
    if (!bom || bom.kind !== 'BOM' || !eligible(item))
        return false;
    const supplies = s.supplies.filter(x => x.itemId === item.id);
    const finished = supplies.filter(x => x.componentRevisionId === null).reduce((n, x) => n + x.good, 0);
    return bom.body.lines.every(line => supplies.filter(x => x.componentRevisionId === line.componentRevisionId).reduce((n, x) => n + x.good, 0) >= (item.quantity - finished) * line.quantity);
}

export function hasEarlierUnfinishedOrder(s: ProductionSnapshot, item: ProductionItem): boolean {
    const placedAt = Date.parse(item.placedAt);
    return s.items.some(candidate => {
        if (candidate.orderId === item.orderId || !eligible(candidate) || candidate.dispatchReadyAt)
            return false;
        const candidatePlacedAt = Date.parse(candidate.placedAt);
        return candidatePlacedAt < placedAt ||
            (candidatePlacedAt === placedAt && candidate.orderId.localeCompare(item.orderId) < 0);
    });
}

export function suggestBatchChecks(s: ProductionSnapshot, itemIds: string[], startAt: string): string[] {
    const baseline = buildPlan(s, itemIds, [], startAt);
    const outstanding = new Map<string, number>();
    for (const blocker of baseline.blockers) {
        const match = /^TECHNICAL_CHECK_REQUIRED:([^:]+):(\d+)$/.exec(blocker);
        if (match)
            outstanding.set(match[1], (outstanding.get(match[1]) ?? 0) + Number(match[2]));
    }

    const componentIds = [...outstanding.keys()].sort();
    if (!componentIds.length)
        return [];
    const initial = componentIds.map(id => outstanding.get(id)!);
    const checks = s.checks.filter(check => !check.revoked && check.members.length > 0 && checkProblems(check, s).length === 0 && check.members.every(member => outstanding.has(member.componentRevisionId)))
        .filter(check => {
            const profile = published(s, check.profileRevisionId);
            return profile?.kind === 'PROFILE' && !!profile.body.plate && s.printers.some(p => p.id === profile.printerId && p.status === 'AVAILABLE') &&
                !s.holds.some(h => h.printerId === profile.printerId && h.groupId !== baseline.groupId);
        })
        .map(check => ({
        id: check.id,
        code: check.code,
        minutes: check.preparationMinutes + check.durationMinutes + check.finishingMinutes,
        vector: componentIds.map(id => check.members.find(member => member.componentRevisionId === id)?.quantity ?? 0),
    }))
        .filter(check => check.vector.some(quantity => quantity > 0) && check.vector.every((quantity, index) => quantity <= initial[index]))
        .sort((a, b) => b.vector.filter(quantity => quantity > 0).length - a.vector.filter(quantity => quantity > 0).length ||
        b.vector.reduce((sum, quantity) => sum + quantity, 0) - a.vector.reduce((sum, quantity) => sum + quantity, 0) ||
        a.minutes - b.minutes || a.code.localeCompare(b.code) || a.id.localeCompare(b.id));

    let bestIds: string[] = [];
    let bestRemaining = [...initial];
    let bestMinutes = 0;
    let explored = 0;
    let capped = false;
    const memo = new Map<string, { runs: number; minutes: number }>();
    const path: string[] = [];
    const MAX_SEARCH_STATES = 20_000;
    const MAX_BATCHES = 100;
    // shortcut: cap search at 20,000 states; raise it if real order mixes hit the cap with avoidable runs.
    const remainingTotal = (values: number[]) => values.reduce((sum, value) => sum + value, 0);
    const lexicallyBefore = (left: string[], right: string[]) => left.join('\u0000') < right.join('\u0000');

    // Keep the previous greedy result as a safe candidate if the bounded search reaches its cap.
    const greedyRemaining = [...initial];
    const greedyIds: string[] = [];
    let greedyMinutes = 0;
    while (greedyIds.length < MAX_BATCHES) {
        const chosen = checks.find(check => check.vector.every((quantity, index) => quantity <= greedyRemaining[index]));
        if (!chosen)
            break;
        greedyIds.push(chosen.id);
        greedyMinutes += chosen.minutes;
        chosen.vector.forEach((quantity, index) => { greedyRemaining[index] -= quantity; });
    }
    bestIds = greedyIds;
    bestRemaining = greedyRemaining;
    bestMinutes = greedyMinutes;

    function consider(remaining: number[], minutes: number) {
        const covered = remainingTotal(initial) - remainingTotal(remaining);
        const bestCovered = remainingTotal(initial) - remainingTotal(bestRemaining);
        const isBetter = covered > bestCovered || (covered === bestCovered && (
            path.length < bestIds.length ||
            (path.length === bestIds.length && (
                minutes < bestMinutes ||
                (minutes === bestMinutes && lexicallyBefore(path, bestIds))
            ))
        ));
        if (isBetter) {
            bestIds = [...path];
            bestRemaining = [...remaining];
            bestMinutes = minutes;
        }
    }

    function search(remaining: number[], minutes: number) {
        if (capped)
            return;
        explored += 1;
        if (explored > MAX_SEARCH_STATES) {
            capped = true;
            return;
        }
        consider(remaining, minutes);
        if (remaining.every(quantity => quantity === 0) || path.length >= MAX_BATCHES)
            return;

        const state = remaining.join(',');
        const previous = memo.get(state);
        if (previous && (previous.runs < path.length || (previous.runs === path.length && previous.minutes <= minutes)))
            return;
        memo.set(state, { runs: path.length, minutes });

        let choices: typeof checks | null = null;
        for (let index = 0; index < remaining.length; index += 1) {
            if (remaining[index] === 0)
                continue;
            const fitting = checks.filter(check => check.vector[index] > 0 && check.vector.every((quantity, part) => quantity <= remaining[part]));
            if (!fitting.length)
                continue;
            if (!choices || fitting.length < choices.length)
                choices = fitting;
        }
        if (!choices)
            return;
        for (const check of choices ?? []) {
            const next = remaining.map((quantity, index) => quantity - check.vector[index]);
            path.push(check.id);
            search(next, minutes + check.minutes);
            path.pop();
            if (capped)
                return;
        }
    }

    search(initial, 0);
    return bestIds;
}

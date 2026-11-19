import type { ComponentSpec, GroupingRule } from '../../contracts/production';

/** Rules on a published printer profile can restrict, but never relax, hard compatibility. */
export function groupingDecision(rules: GroupingRule[], parts: ComponentSpec[]) {
    const matches = rules.filter(r => parts.some(p => p[r.field] === r.value))
        .sort((a,b) => b.priority-a.priority || a.id.localeCompare(b.id));
    const top = matches.filter(r=>r.priority===matches[0]?.priority);
    return { permitted: !top.some(r=>r.effect==='DENY'), ids: top.map(r=>r.id),
        conflict: new Set(top.map(r=>r.effect)).size>1 };
}

import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ProductionSnapshot, Revision, ProductionItem } from '../../../contracts/production';
import { buildPlan, unmet, canPack, checkProblems, revisionProblems, hasEarlierUnfinishedOrder, suggestBatchChecks } from '../planning';
const component: Revision = { id: 'component', code: 'DYNAMIC_COMPONENT', revision: 1, kind: 'COMPONENT', variantId: null, printerId: null, status: 'PUBLISHED', verifiedBy: 'technician', verifiedAt: null, body: { name: 'Synthetic group', unit: 'group', envelope: {width:10,depth:10,height:10}, routing: 'PRINTED', objectsPerUnit: 2, mirrorRequired: true, technology: 'FDM', material: 'PLA', color: 'BLACK', appearance: 'OPAQUE' } };
const bom: Revision = { id: 'bom', code: 'DYNAMIC_BOM', revision: 1, kind: 'BOM', variantId: 'variant', printerId: null, status: 'PUBLISHED', verifiedBy: 'technician', verifiedAt: null, body: { lines: [{ componentRevisionId: 'component', quantity: 2 }] } };
const profile: Revision = { id: 'profile', code: 'DYNAMIC_PROFILE', revision: 1, kind: 'PROFILE', variantId: null, printerId: 'printer', status: 'PUBLISHED', verifiedBy: 'technician', verifiedAt: null, body: { name: 'Synthetic confirmed profile', technology: 'FDM', material: 'PLA', color: 'BLACK', appearance: 'OPAQUE', processCode: 'CONFIRMED_PROCESS', plate: {width:120,depth:120,height:50,margin:2,spacing:2} } };
const item = (id: string, quantity: number, placedAt: string): ProductionItem => ({ id, quantity, placedAt, orderId: `order-${id}`, orderNumber: `SYNTHETIC-${id}`, variantId: 'variant', sku: 'DYNAMIC_SKU', orderStatus: 'CONFIRMED', paymentStatus: 'PAID', paymentTiming: 'PREPAID', bomRevisionId: 'bom', groupId: null, packedAt: null, dispatchReadyAt: null });
function snapshot(): ProductionSnapshot { return { revisions: [structuredClone(component), structuredClone(bom), structuredClone(profile)], items: [item('old', 2, '2026-11-10T00:00:00Z'), item('new', 1, '2026-11-11T00:00:00Z')], inventory: [{ key: 'finished:variant:bom', available: 1, revision: 1 }, { key: 'component:component', available: 1, revision: 1 }, { key: 'material:PLA:BLACK:OPAQUE', available: 10, revision: 1 }], checks: [{ id: 'check', code: 'EXACT_BATCH', profileRevisionId: 'profile', members: [{ componentRevisionId: 'component', quantity: 3 }], durationMinutes: 30, preparationMinutes: 5, finishingMinutes: 10, materialQuantity: 2, evidenceCode: 'CONFIRMED_AT_WORKSHOP', resourcesConfirmed: true, verifiedBy: 'technician', revoked: false }], printers: [{ id: 'printer', code: 'PRINTER', name: 'Synthetic printer', technology: 'FDM', status: 'AVAILABLE' }], supplies: [], holds: [], jobs: [] }; }
test('finished kits precede BOM explosion, free components precede batches, and FIFO survives reverse selection order', () => {
    const s = snapshot();
    const plan = buildPlan(s, ['new', 'old'], ['check'], '2026-11-12T00:00:00Z');
    assert.deepEqual(plan.blockers, []);
    assert.deepEqual(plan.stocks.map(x => ({ item: x.itemId, component: x.componentRevisionId, quantity: x.quantity })), [{ item: 'old', component: null, quantity: 1 }, { item: 'old', component: 'component', quantity: 1 }]);
    assert.deepEqual(plan.jobs[0].allocations, [{ itemId: 'old', componentRevisionId: 'component', quantity: 1 }, { itemId: 'new', componentRevisionId: 'component', quantity: 2 }]);
    assert.equal(plan.jobs[0].finishAt, '2026-11-12T00:35:00.000Z');
});
test('confirmed E, produced G and outstanding A are disjoint; only failed outstanding units return to demand', () => {
    const s = snapshot();
    s.items = [item('one', 5, '2026-11-10T00:00:00Z')];
    s.supplies = [{ id: 'E', itemId: 'one', componentRevisionId: 'component', jobId: null, quantity: 2, good: 2, failed: 0, inspectedAt: '2026-11-11T00:00:00Z' }, { id: 'G', itemId: 'one', componentRevisionId: 'component', jobId: 'completed-job', quantity: 3, good: 3, failed: 0, inspectedAt: '2026-11-11T00:00:00Z' }, { id: 'A', itemId: 'one', componentRevisionId: 'component', jobId: 'active-job', quantity: 4, good: 0, failed: 0, inspectedAt: null }];
    assert.equal(unmet(s, s.items[0])![0].quantity, 1);
    s.supplies[2].failed = 2;
    assert.equal(unmet(s, s.items[0])![0].quantity, 3);
});
test('unknown inventory blocks application even when a verified layout exists', () => {
    const s = snapshot();
    s.inventory = [];
    const p = buildPlan(s, ['old', 'new'], [], '2026-11-12T00:00:00Z');
    assert(p.blockers.some(x => x.startsWith('INVENTORY_UNKNOWN')));
});
test('a batch needs a common full profile and exact verified quantities, not a matching name', () => {
    const s = snapshot();
    const different = structuredClone(component);
    different.id = 'different';
    different.code = 'SAME_NAME_DIFFERENT_SPEC';
    different.body = { ...different.body, color: 'WHITE' };
    s.revisions.push(different);
    const check = { ...s.checks[0], members: [...s.checks[0].members, { componentRevisionId: 'different', quantity: 1 }] };
    assert(checkProblems(check, s).some(p => p.startsWith('PROFILE_INCOMPATIBLE')));
    const p = buildPlan(s, ['old'], ['check'], '2026-11-12T00:00:00Z');
    assert(p.blockers.some(p => p.startsWith('CHECK_QUANTITY_MISMATCH')));
});
test('a mandatory future accessory uses stock routing and blocks packing until present', () => {
    const s = snapshot();
    s.items = [item('old', 1, '2026-11-10T00:00:00Z')];
    const accessory = structuredClone(component);
    accessory.id = 'decal';
    accessory.body = { ...accessory.body, routing: 'FINISHING', technology: '', material: '', color: '', appearance: '' };
    s.revisions.push(accessory);
    const b = s.revisions.find(r => r.kind === 'BOM')!;
    if (b.kind !== 'BOM')
        throw new Error('fixture');
    b.body.lines.push({ componentRevisionId: 'decal', quantity: 1 });
    s.supplies = [{ id: 'good', itemId: 'old', componentRevisionId: 'component', jobId: 'job', quantity: 2, good: 2, failed: 0, inspectedAt: '2026-11-11T00:00:00Z' }];
    assert.equal(canPack(s, s.items[0]), false);
    s.supplies.push({ id: 'accessory', itemId: 'old', componentRevisionId: 'decal', jobId: null, quantity: 1, good: 1, failed: 0, inspectedAt: '2026-11-11T00:00:00Z' });
    assert.equal(canPack(s, s.items[0]), true);
});
test('shared batches can be allocated while packing remains FIFO across three orders', () => {
    const s = snapshot();
    const earlier = item('earlier', 1, '2026-11-10T00:00:00Z');
    const sameOrderLine = { ...item('earlier-line-2', 1, earlier.placedAt), orderId: earlier.orderId };
    const middle = item('middle', 1, '2026-11-11T00:00:00Z');
    const latest = item('latest', 1, '2026-11-12T00:00:00Z');
    s.items = [latest, middle, sameOrderLine, earlier];

    assert.equal(hasEarlierUnfinishedOrder(s, earlier), false);
    assert.equal(hasEarlierUnfinishedOrder(s, sameOrderLine), false);
    assert.equal(hasEarlierUnfinishedOrder(s, middle), true);
    assert.equal(hasEarlierUnfinishedOrder(s, latest), true);

    earlier.dispatchReadyAt = '2026-11-12T01:00:00Z';
    sameOrderLine.dispatchReadyAt = '2026-11-12T01:00:00Z';
    assert.equal(hasEarlierUnfinishedOrder(s, middle), false);
    assert.equal(hasEarlierUnfinishedOrder(s, latest), true);
    middle.dispatchReadyAt = '2026-11-12T02:00:00Z';
    assert.equal(hasEarlierUnfinishedOrder(s, latest), false);
});
test('local batch suggestion combines compatible components demanded by three FIFO orders', () => {
    const s = snapshot();
    const second = structuredClone(component);
    second.id = 'component-2';
    second.code = 'DYNAMIC_COMPONENT_2';
    s.revisions.push(second);
    const b = s.revisions.find(r => r.kind === 'BOM');
    if (!b || b.kind !== 'BOM')
        throw new Error('fixture');
    b.body.lines = [
        { componentRevisionId: 'component', quantity: 1 },
        { componentRevisionId: 'component-2', quantity: 1 },
    ];
    const single = { ...structuredClone(s.checks[0]), id: 'single', code: 'SINGLE', members: [{ componentRevisionId: 'component', quantity: 3 }] };
    const combined = { ...structuredClone(s.checks[0]), id: 'combined', code: 'COMBINED', members: [{ componentRevisionId: 'component', quantity: 3 }, { componentRevisionId: 'component-2', quantity: 3 }] };
    s.checks = [single, combined];
    s.items = [
        item('old', 1, '2026-11-10T00:00:00Z'),
        item('middle', 1, '2026-11-11T00:00:00Z'),
        item('new', 1, '2026-11-12T00:00:00Z'),
    ];
    s.inventory = [
        { key: 'finished:variant:bom', available: 0, revision: 1 },
        { key: 'component:component', available: 0, revision: 1 },
        { key: 'component:component-2', available: 0, revision: 1 },
        { key: 'material:PLA:BLACK:OPAQUE', available: 10, revision: 1 },
    ];

    const checkIds = suggestBatchChecks(s, ['new', 'old', 'middle'], '2026-11-12T00:00:00Z');
    const plan = buildPlan(s, ['new', 'old', 'middle'], checkIds, '2026-11-12T00:00:00Z');

    assert.deepEqual(checkIds, ['combined']);
    assert.equal(plan.jobs.length, 1);
    assert.deepEqual(plan.blockers, []);
    assert.deepEqual(plan.jobs[0].allocations.map(a => a.itemId), ['old', 'middle', 'new', 'old', 'middle', 'new']);
});
test('batch suggestion avoids a greedy dead end and chooses the complete two-run plan', () => {
    const s = snapshot();
    const second = structuredClone(component);
    second.id = 'component-2';
    second.code = 'SECOND_COMPONENT';
    s.revisions.push(second);
    const variantBom = s.revisions.find(r => r.kind === 'BOM');
    if (!variantBom || variantBom.kind !== 'BOM')
        throw new Error('fixture');
    variantBom.body.lines = [
        { componentRevisionId: 'component', quantity: 6 },
        { componentRevisionId: 'component-2', quantity: 6 },
    ];
    s.items = [item('old', 1, '2026-11-10T00:00:00Z')];
    s.inventory = [
        { key: 'finished:variant:bom', available: 0, revision: 1 },
        { key: 'component:component', available: 0, revision: 1 },
        { key: 'component:component-2', available: 0, revision: 1 },
        { key: 'material:PLA:BLACK:OPAQUE', available: 20, revision: 1 },
    ];
    const template = s.checks[0];
    s.checks = [
        { ...structuredClone(template), id: 'greedy', code: 'A_GREEDY', members: [{ componentRevisionId: 'component', quantity: 6 }, { componentRevisionId: 'component-2', quantity: 3 }] },
        { ...structuredClone(template), id: 'first', code: 'B_FIRST', members: [{ componentRevisionId: 'component', quantity: 2 }, { componentRevisionId: 'component-2', quantity: 6 }] },
        { ...structuredClone(template), id: 'second', code: 'C_SECOND', members: [{ componentRevisionId: 'component', quantity: 4 }] },
    ];

    const checkIds = suggestBatchChecks(s, ['old'], '2026-11-12T00:00:00Z');
    const plan = buildPlan(s, ['old'], checkIds, '2026-11-12T00:00:00Z');

    assert.deepEqual(checkIds, ['first', 'second']);
    assert.equal(plan.jobs.length, 2);
    assert.deepEqual(plan.blockers, []);
});
test('incomplete component metadata is draft data, never a publishable manufacturing configuration', () => {
    const s = snapshot();
    const c = structuredClone(component);
    c.body = { ...c.body, objectsPerUnit: null, unit: '', material: '' };
    assert(revisionProblems(c, s).includes('COMPONENT_UNIT_UNCONFIRMED'));
    assert(revisionProblems(c, s).includes('PRINT_SPEC_INCOMPLETE'));
});

test('an unavailable printer cannot crowd out an eligible slower batch', () => {
    const s = snapshot();
    const p = s.revisions.find(r => r.kind === 'PROFILE')!;
    s.revisions.push({ ...p, id: 'offline-profile', printerId: 'offline' });
    s.printers.push({ ...s.printers[0], id: 'offline', status: 'OFFLINE' });
    s.checks.unshift({ ...s.checks[0], id: 'fast', profileRevisionId: 'offline-profile', durationMinutes: 1 });
    assert.deepEqual(suggestBatchChecks(s, ['old','new'], '2026-11-12T00:00:00Z'), ['check']);
});

test('profile with measured plate blocks missing envelope, excess height or spacing, but permits different files', () => {
    const s = snapshot();
    const profile = s.revisions.find(r=>r.kind==='PROFILE')!;
    const part = s.revisions.find(r=>r.kind==='COMPONENT')!;
    profile.body.plate = {width:22,depth:12,height:5,margin:1,spacing:1};
    delete part.body.envelope;
    assert(checkProblems(s.checks[0],s).length);
    part.body.envelope = {width:9,depth:10,height:4};
    const other = structuredClone(part); other.id='different-file'; s.revisions.push(other);
    const check = {...s.checks[0], members:[{componentRevisionId:part.id,quantity:1},{componentRevisionId:other.id,quantity:1}]};
    assert.deepEqual(checkProblems(check,s),[]);
    profile.body.plate.spacing=4; assert(checkProblems(check,s).length);
    profile.body.plate.spacing=0; part.body.envelope.height=6; assert(checkProblems(check,s).length);
});

test('profile rule deny wins ties; higher priority allow cannot override incompatible material', () => {
    const s=snapshot(), p=s.revisions.find(r=>r.kind==='PROFILE')!, c=s.revisions.find(r=>r.kind==='COMPONENT')!;
    p.body.groupingRules = [
        { id:'white-list', priority:2, effect:'ALLOW', field:'color', value:'BLACK' },
        { id:'exception', priority:2, effect:'DENY', field:'material', value:'PLA' },
    ];
    assert(checkProblems(s.checks[0],s).some(v=>v.includes('xung đột')));
    p.body.groupingRules[0].priority=3; assert.deepEqual(checkProblems(s.checks[0],s),[]);
    c.body.material='PETG'; assert(checkProblems(s.checks[0],s).some(v=>v.startsWith('PROFILE_INCOMPATIBLE')));
});

test('unmeasured legacy profile requires a manual check; changed printer technology invalidates evidence', () => {
    const s = snapshot(), profile = s.revisions.find(r => r.kind === 'PROFILE')!;
    delete profile.body.plate;
    assert.deepEqual(suggestBatchChecks(s, ['old','new'], '2026-11-12T00:00:00Z'), []);
    assert.deepEqual(checkProblems(s.checks[0], s), []);
    s.printers[0].technology = 'SLA';
    assert(checkProblems(s.checks[0], s).length);
});

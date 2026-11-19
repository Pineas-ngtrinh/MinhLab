import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { RevisionInput } from '../../../contracts/production';
import type { ProductionDependencies, ProductionWriter, ProductionPlanNotification } from '../production.ports';
import { createProductionService } from '../production.service';

const input: RevisionInput = {
  kind: 'COMPONENT',
  code: 'STAFF_COMPONENT',
  body: {
    name: 'Linh kiện thử',
    unit: 'chiếc',
    routing: 'STOCKED',
    objectsPerUnit: 1,
    mirrorRequired: false,
    technology: '',
    material: '',
    color: '',
    appearance: '',
  },
};

function serviceFor(writer: ProductionWriter) {
  const dependencies: ProductionDependencies = {
    transaction: (operation) => operation(writer),
    hash: value => JSON.stringify(value),
    now: () => new Date(0).toISOString(),
  };
  return createProductionService(dependencies);
}

test('staff can save production metadata drafts while print operators cannot create them', async () => {
  let savedBy = '';
  const writer = {
    replay: async () => null,
    remember: async () => undefined,
    saveRevision: async (_input: RevisionInput, actorId: string) => {
      savedBy = actorId;
      return 'revision-id';
    },
    audit: async () => undefined,
  } as unknown as ProductionWriter;
  const service = serviceFor(writer);

  assert.deepEqual(
    await service.saveRevision({ id: 'staff-id', role: 'WORKSHOP_OPERATOR' }, 'staff-request-key', input),
    { id: 'revision-id' },
  );
  assert.equal(savedBy, 'staff-id');
  assert.throws(
    () => service.saveRevision({ id: 'operator-id', role: 'PRINT_OPERATOR' }, 'operator-request-key', input),
    /Vai trò hiện tại không có quyền/,
  );
});

test('workshop operators can draft production data but cannot publish revisions or change printer configuration', async () => {
  const writer = {
    replay: async () => null,
    remember: async () => undefined,
    saveRevision: async () => 'revision-id',
    audit: async () => undefined,
  } as unknown as ProductionWriter;
  const service = serviceFor(writer);

  assert.deepEqual(
    await service.saveRevision({ id: 'operator-id', role: 'WORKSHOP_OPERATOR' }, 'workshop-request-key', input),
    { id: 'revision-id' },
  );
  assert.throws(
    () => service.revisionAction({ id: 'operator-id', role: 'WORKSHOP_OPERATOR' }, 'publish-request-key', 'revision-id', 'PUBLISH'),
    /Vai trò hiện tại không có quyền/,
  );
  assert.throws(
    () => service.savePrinter({ id: 'operator-id', role: 'WORKSHOP_OPERATOR' }, 'printer-request-key', { code: 'P1', name: 'Máy', technology: 'FDM', status: 'AVAILABLE' }),
    /Vai trò hiện tại không có quyền/,
  );
});

test('proposing a plan queues its alert before recording success and replay does not notify twice', async () => {
  const calls: string[] = [];
  const alerts: ProductionPlanNotification[] = [];
  let remembered = false;
  const writer = {
    async replay() { return remembered ? { actorId: 'staff-id', requestHash: 'hash', result: { id: 'plan-id' } } : null; },
    async remember() { calls.push('remember'); remembered = true; },
    async pinRequirements() {},
    async snapshot() { return { revisions: [], items: [], inventory: [], checks: [], printers: [], supplies: [], holds: [], jobs: [] }; },
    async savePlan() { calls.push('save'); return 'plan-id'; },
    async audit() { calls.push('audit'); },
  } as unknown as ProductionWriter;
  const service = createProductionService({
    hash: () => 'hash', now: () => new Date(0).toISOString(),
    transaction: run => run(writer, { async planProposed(input) { calls.push('notify'); alerts.push(input); } }),
  });
  const propose = () => service.propose({ id: 'staff-id', role: 'WORKSHOP_OPERATOR' }, 'request-key', ['missing-item'], [], new Date(0).toISOString());
  assert.deepEqual(await propose(), { id: 'plan-id' });
  assert.deepEqual(await propose(), { id: 'plan-id' });
  assert.deepEqual(calls, ['save', 'audit', 'notify', 'remember']);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].status, 'WAITING_DATA');
  assert.equal(alerts[0].blockerCount, 1);
});

function deletionFixture(status = 'PENDING_APPROVAL') {
  const calls: string[] = [];
  let deleted = false;
  const receipts = new Map<string, { actorId: string; requestHash: string; result: unknown }>();
  const writer = {
    async replay(key: string) { return receipts.get(key) ?? null; },
    async remember(_key: string, actorId: string, requestHash: string, result: unknown) { receipts.set(_key, { actorId, requestHash, result }); },
    async plan() { return deleted ? null : { id: 'plan-id', revision: 2, status }; },
    async deletePlan() { calls.push('delete'); deleted = true; },
    async audit(action: string) { calls.push(action); },
  } as unknown as ProductionWriter;
  return { service: serviceFor(writer), calls };
}

test('only admin can delete plans; revision, state and existence are checked before writing', async () => {
  for (const role of ['WORKSHOP_OPERATOR', 'PRINT_OPERATOR', 'WORKSHOP_OPERATOR', 'FILE_REVIEWER', 'AGENT'] as const) {
    const f = deletionFixture();
    assert.throws(() => f.service.deletePlan({ id: 'actor', role }, 'key', 'plan-id', 2), /quyền/);
    assert.deepEqual(f.calls, []);
  }
  for (const status of ['APPROVED', 'UNKNOWN']) {
    const f = deletionFixture(status);
    await assert.rejects(f.service.deletePlan({ id: 'admin', role: 'ADMIN' }, 'key', 'plan-id', 2), /chưa được duyệt/);
    assert.deepEqual(f.calls, []);
  }
  const stale = deletionFixture();
  await assert.rejects(stale.service.deletePlan({ id: 'admin', role: 'ADMIN' }, 'key', 'plan-id', 1), /phiên bản mới/);
  assert.deepEqual(stale.calls, []);
});

test('deletion audits once, replays safely and a new request cannot access a deleted plan', async () => {
  for (const status of ['WAITING_DATA', 'PENDING_APPROVAL', 'STALE', 'REJECTED', 'SUPERSEDED']) {
    const f = deletionFixture(status);
    const actor = { id: 'admin', role: 'ADMIN' as const };
    await f.service.deletePlan(actor, 'key', 'plan-id', 2);
    await f.service.deletePlan(actor, 'key', 'plan-id', 2);
    assert.deepEqual(f.calls, ['delete', 'PLAN_DELETED']);
    await assert.rejects(f.service.deletePlan(actor, 'new-key', 'plan-id', 2), /Không tìm thấy/);
    // A replay key is bound to both the actor and requested revision.
    await assert.rejects(f.service.deletePlan(actor, 'key', 'plan-id', 3), /Khóa thao tác/);
  }
});

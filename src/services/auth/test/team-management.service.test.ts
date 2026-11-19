import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { WorkshopOperatorAccount, AssignAccountRole } from '../../../contracts/team';
import type { RoleCode } from '../../../lib/auth-roles';
import type { TeamManagementRepository } from '../team-management.service';
import { createTeamManagementService } from '../team-management.service';

test('the retired order staff role is rejected before modifying any account', async () => {
  const f = fixture();
  const input = { userId: 'user-1', role: 'STAFF', expectedRoles: ['CUSTOMER'], reason: 'Legacy request' };
  await assert.rejects(f.service.assign({ id: 'admin', role: 'ADMIN' }, input as unknown as AssignAccountRole), /vai trò không hợp lệ/);
  assert.deepEqual(f.roles(), ['CUSTOMER']);
});

function fixture(options: { requireVerifiedEmail?: boolean; account?: WorkshopOperatorAccount | null; roles?: RoleCode[]; currentAdmin?: boolean; adminCount?: number; failAudit?: boolean } = {}) {
  const account = options.account === undefined ? {
    id: 'user-1', email: 'operator@example.test', fullName: 'Nhân viên xưởng', status: 'ACTIVE', emailVerified: true,
  } : options.account;
  let roleAssigned = false;
  let telegramUserId: string | null = null;
  let roles: RoleCode[] = options.roles ?? ['CUSTOMER'];
  const audit: string[] = [];
  const details: { role?: RoleCode; previousRoles?: RoleCode[]; reason?: string }[] = [];
  const repository: TeamManagementRepository = {
    async isActiveAdmin() { return options.currentAdmin ?? true; },
    async listAccounts(options) { return { data: [], pagination: { page: options.page, pageSize: options.pageSize, total: 0, totalPages: 1 } }; },
    async findAccountById(id) { return account?.id === id ? { ...account, telegramUserId, roles: [...roles], effectiveRole: roles.includes('ADMIN') ? 'ADMIN' : roles.find(role => role !== 'CUSTOMER') ?? 'CUSTOMER' } : null; },
    async countActiveAdmins() { return options.adminCount ?? 2; },
    async replaceAccountRoles(_id, role) { roles = role === 'CUSTOMER' ? ['CUSTOMER'] : ['CUSTOMER', role]; },
    async setTelegramIdentity(_id, value) { telegramUserId = value; },
    async auditTelegramIdentity(actor, id) { if (options.failAudit) throw new Error('Audit fixture failed'); audit.push(`${actor}:${id}:TELEGRAM_LINK_CHANGED`); },
    async ensureRole() {},
    async listWorkshopOperators() { return roleAssigned && account ? [account] : []; },
    async findAccountByEmail(email) { return account?.email.toLowerCase() === email ? account : null; },
    async grantWorkshopOperator() { const added = !roleAssigned; roleAssigned = true; return added; },
    async revokeWorkshopOperator() { const removed = roleAssigned; roleAssigned = false; return removed; },
    async auditRoleChange(actorId, userId, action, role, previousRoles, reason) {
      if (options.failAudit) throw new Error('Audit fixture failed');
      audit.push(`${actorId}:${userId}:${action}`); details.push({ role, previousRoles, reason });
    },
  };
  const service = createTeamManagementService({
    requireVerifiedEmail: () => options.requireVerifiedEmail ?? false,
    transaction: async operation => {
      const before = [...roles];
      const beforeTelegram = telegramUserId;
      try { return await operation(repository); } catch (error) { roles = before; telegramUserId = beforeTelegram; throw error; }
    },
  });
  return { service, audit, details, roles: () => roles, isAssigned: () => roleAssigned };
}

test('only ADMIN can assign the restricted workshop operator role', async () => {
  const { service } = fixture();
  await assert.rejects(service.grant({ id: 'staff', role: 'WORKSHOP_OPERATOR' }, 'operator@example.test'), /Chỉ quản trị viên/);
  assert.throws(() => service.list({ id: 'staff', role: 'WORKSHOP_OPERATOR' }), /Chỉ quản trị viên/);
});

test('grant normalizes email, is idempotent, and writes audit only for a new role', async () => {
  const { service, audit, isAssigned } = fixture();
  const granted = await service.grant({ id: 'admin-1', role: 'ADMIN' }, ' Operator@Example.Test ');
  assert.equal(granted.account.id, 'user-1');
  assert.equal(granted.alreadyAssigned, false);
  assert.equal(isAssigned(), true);
  assert.deepEqual(audit, ['admin-1:user-1:ROLE_GRANTED']);
  const replay = await service.grant({ id: 'admin-1', role: 'ADMIN' }, 'operator@example.test');
  assert.equal(replay.alreadyAssigned, true);
  assert.equal(audit.length, 1);
});

test('inactive, missing or unverified accounts cannot receive workshop access', async () => {
  const inactive = fixture({ account: { id: 'user-1', email: 'operator@example.test', fullName: 'Nhân viên', status: 'LOCKED', emailVerified: true } });
  await assert.rejects(inactive.service.grant({ id: 'admin', role: 'ADMIN' }, 'operator@example.test'), /chưa hoạt động/);
  const unverified = fixture({ requireVerifiedEmail: true, account: { id: 'user-1', email: 'operator@example.test', fullName: 'Nhân viên', status: 'ACTIVE', emailVerified: false } });
  await assert.rejects(unverified.service.grant({ id: 'admin', role: 'ADMIN' }, 'operator@example.test'), /xác minh thư điện tử/);
  const missing = fixture({ account: null });
  await assert.rejects(missing.service.grant({ id: 'admin', role: 'ADMIN' }, 'missing@example.test'), /đăng ký trước/);
});

test('only ADMIN can revoke workshop access and revocation is audited', async () => {
  const { service, audit, isAssigned } = fixture();
  await service.grant({ id: 'admin-1', role: 'ADMIN' }, 'operator@example.test');
  const result = await service.revoke({ id: 'admin-1', role: 'ADMIN' }, 'operator@example.test');
  assert.equal(result.removed, true);
  assert.equal(isAssigned(), false);
  assert.deepEqual(audit, ['admin-1:user-1:ROLE_GRANTED', 'admin-1:user-1:ROLE_REVOKED']);
});

const admin = { id: 'admin-1', role: 'ADMIN' };
const assignment = (patch: Partial<AssignAccountRole> = {}): AssignAccountRole => ({ userId: 'user-1', role: 'WORKSHOP_OPERATOR', expectedRoles: ['CUSTOMER'], reason: 'Phân công xử lý đơn hàng', ...patch });

test('all six roles can be selected; personnel assignments are replaced and recorded with their reason', async () => {
  for (const role of ['WORKSHOP_OPERATOR', 'FILE_REVIEWER', 'PRINT_OPERATOR', 'ADMIN', 'CUSTOMER'] as const) {
    const f = fixture({ roles: ['CUSTOMER', 'PRINT_OPERATOR'] });
    await f.service.assign(admin, assignment({ role, expectedRoles: ['CUSTOMER', 'PRINT_OPERATOR'] }));
    assert.deepEqual(f.roles(), role === 'CUSTOMER' ? ['CUSTOMER'] : ['CUSTOMER', role]);
    if (role !== 'PRINT_OPERATOR') assert.deepEqual(f.details[0], { role, previousRoles: ['CUSTOMER', 'PRINT_OPERATOR'], reason: 'Phân công xử lý đơn hàng' });
  }
});

test('customers and every non-admin personnel role are denied; an ADMIN cannot edit their own account', async () => {
  const f = fixture();
  for (const role of ['CUSTOMER', 'WORKSHOP_OPERATOR', 'FILE_REVIEWER', 'PRINT_OPERATOR']) {
    await assert.rejects(f.service.assign({ id: 'actor', role }, assignment()), /Chỉ quản trị viên/);
    assert.throws(() => f.service.accounts({ id: 'actor', role }, { page: 1, pageSize: 25 }), /Chỉ quản trị viên/);
  }
  await assert.rejects(f.service.assign({ id: 'user-1', role: 'ADMIN' }, assignment()), /tài khoản khác/);
  assert.equal(f.audit.length, 0);
});

test('a revoked ADMIN session cannot mutate through the new or legacy entry point', async () => {
  const f = fixture({ currentAdmin: false });
  await assert.rejects(f.service.assign(admin, assignment()), /Quyền quản trị đã thay đổi/);
  await assert.rejects(f.service.grant(admin, 'operator@example.test'), /Quyền quản trị đã thay đổi/);
  await assert.rejects(f.service.revoke(admin, 'operator@example.test'), /Quyền quản trị đã thay đổi/);
  assert.equal(f.audit.length, 0);
});

test('stale edits conflict; retries of a successful assignment make no duplicate audit entry', async () => {
  const f = fixture();
  await f.service.assign(admin, assignment());
  const replay = await f.service.assign(admin, assignment());
  assert.equal(replay.unchanged, true); assert.equal(f.audit.length, 1);
  await assert.rejects(f.service.assign(admin, assignment({ role: 'FILE_REVIEWER' })), /đã được thay đổi/);
  assert.deepEqual(f.roles(), ['CUSTOMER', 'WORKSHOP_OPERATOR']);
});

test('revocation to CUSTOMER is allowed for locked/unverified accounts while new privileges are blocked', async () => {
  const account = { id: 'user-1', email: 'operator@example.test', fullName: 'Nhân viên', status: 'LOCKED', emailVerified: false };
  const f = fixture({ account, roles: ['CUSTOMER', 'WORKSHOP_OPERATOR'], requireVerifiedEmail: true });
  await assert.rejects(f.service.assign(admin, assignment({ role: 'ADMIN', expectedRoles: ['CUSTOMER', 'WORKSHOP_OPERATOR'] })), /đang hoạt động/);
  await f.service.assign(admin, assignment({ role: 'CUSTOMER', expectedRoles: ['CUSTOMER', 'WORKSHOP_OPERATOR'] }));
  assert.deepEqual(f.roles(), ['CUSTOMER']);
  const unverified = fixture({ account: { ...account, status: 'ACTIVE' }, requireVerifiedEmail: true });
  await assert.rejects(unverified.service.assign(admin, assignment()), /xác minh/);
});

test('last active administrator and audit persistence are transaction guards', async () => {
  const last = fixture({ roles: ['CUSTOMER', 'ADMIN'], adminCount: 1 });
  await assert.rejects(last.service.assign(admin, assignment({ role: 'CUSTOMER', expectedRoles: ['CUSTOMER', 'ADMIN'] })), /ít nhất một quản trị viên/);
  assert.deepEqual(last.roles(), ['CUSTOMER', 'ADMIN']);
  const failed = fixture({ failAudit: true });
  await assert.rejects(failed.service.assign(admin, assignment()), /Audit fixture failed/);
  assert.deepEqual(failed.roles(), ['CUSTOMER']);
});

test('invalid roles, duplicate expected roles, empty reasons and absent accounts change nothing', async () => {
  const f = fixture();
  await assert.rejects(f.service.assign(admin, assignment({ role: 'SUPERUSER' as RoleCode })), /vai trò/);
  await assert.rejects(f.service.assign(admin, assignment({ expectedRoles: ['CUSTOMER', 'CUSTOMER'] })), /vai trò/);
  await assert.rejects(f.service.assign(admin, assignment({ reason: '   ' })), /lý do/);
  await assert.rejects(f.service.assign(admin, assignment({ userId: 'missing' })), /Không tìm thấy/);
  assert.deepEqual(f.roles(), ['CUSTOMER']); assert.equal(f.audit.length, 0);
});

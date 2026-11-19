import { normalizeAccountEmail } from '../../domain/auth/account';
import type { WorkshopOperatorAccount, ManagedAccount, AssignAccountRole, LinkTelegramAccount } from '../../contracts/team';
import type { PageOptions, PageResult } from '../../contracts/pagination';
import { ROLES, isRoleCode, type RoleCode } from '../../lib/auth-roles';
import { AppError } from '../../lib/errors';

export interface TeamManagementRepository {
  ensureRole(role?: RoleCode): Promise<void>;
  isActiveAdmin(userId: string, requireVerified: boolean): Promise<boolean>;
  listAccounts(options: PageOptions): Promise<PageResult<ManagedAccount>>;
  findAccountById(userId: string): Promise<ManagedAccount | null>;
  countActiveAdmins(requireVerified: boolean): Promise<number>;
  replaceAccountRoles(userId: string, role: RoleCode): Promise<void>;
  setTelegramIdentity(userId: string, telegramUserId: string | null): Promise<void>;
  auditTelegramIdentity(actorId: string, userId: string, previous: string | null, next: string | null, reason: string): Promise<void>;
  listWorkshopOperators(): Promise<WorkshopOperatorAccount[]>;
  findAccountByEmail(normalizedEmail: string): Promise<WorkshopOperatorAccount | null>;
  grantWorkshopOperator(userId: string): Promise<boolean>;
  revokeWorkshopOperator(userId: string): Promise<boolean>;
  auditRoleChange(actorId: string, userId: string, action: 'ROLE_GRANTED' | 'ROLE_REVOKED' | 'ROLE_CHANGED', role?: RoleCode, previousRoles?: RoleCode[], reason?: string): Promise<void>;
}

interface TeamManagementDependencies {
  transaction<T>(operation: (repository: TeamManagementRepository) => Promise<T>): Promise<T>;
  requireVerifiedEmail(): boolean;
}

function requireAdmin(role: string) {
  if (role !== 'ADMIN') throw new AppError('Chỉ quản trị viên mới được cấp quyền nhân sự.', 403);
}

export function createTeamManagementService(dependencies: TeamManagementDependencies) {
  const currentAdmin = async (repository: TeamManagementRepository, id: string) => {
    if (!await repository.isActiveAdmin(id, dependencies.requireVerifiedEmail())) throw new AppError('Quyền quản trị đã thay đổi. Vui lòng đăng nhập lại.', 403);
  };
  const sameRoles = (left: RoleCode[], right: RoleCode[]) => [...left].sort().join(',') === [...right].sort().join(',');
  return {
    async linkTelegram(actor: {id: string; role: string}, input: LinkTelegramAccount) {
      requireAdmin(actor.role);
      const validId = (id: string | null) => id === null || (typeof id === 'string' && /^[1-9][0-9]{0,19}$/.test(id));
      if (!validId(input.telegramUserId) || !validId(input.expectedTelegramUserId)) throw new AppError('Cần Telegram user ID cá nhân dạng số dương, không dùng ID nhóm.');
      const reason = input.reason.trim();
      if (!reason || reason.length > 2000) throw new AppError('Cần lý do liên kết hoặc gỡ Telegram, tối đa 2.000 ký tự.');
      return dependencies.transaction(async repository => {
        await currentAdmin(repository, actor.id);
        const account = await repository.findAccountById(input.userId);
        if (!account) throw new AppError('Không tìm thấy tài khoản.', 404);
        const previous = account.telegramUserId ?? null;
        if (previous === input.telegramUserId) return {account, unchanged: true};
        if (previous !== input.expectedTelegramUserId) throw new AppError('Liên kết Telegram đã thay đổi. Hãy tải lại trước khi lưu.', 409);
        if (input.telegramUserId && account.status !== 'ACTIVE') throw new AppError('Chỉ liên kết mới cho tài khoản đang hoạt động.', 409);
        await repository.setTelegramIdentity(account.id, input.telegramUserId);
        await repository.auditTelegramIdentity(actor.id, account.id, previous, input.telegramUserId, reason);
        return {account: {...account, telegramUserId: input.telegramUserId}, unchanged: false};
      });
    },
    list(actor: { id: string; role: string }) {
      requireAdmin(actor.role);
      return dependencies.transaction(async repository => {
        await currentAdmin(repository, actor.id);
        return repository.listWorkshopOperators();
      });
    },

    accounts(actor: { id: string; role: string }, options: PageOptions) {
      requireAdmin(actor.role);
      return dependencies.transaction(async repository => {
        await currentAdmin(repository, actor.id);
        return { ...await repository.listAccounts(options), requireVerifiedEmail: dependencies.requireVerifiedEmail() };
      });
    },

    async assign(actor: { id: string; role: string }, input: AssignAccountRole) {
      requireAdmin(actor.role);
      if (actor.id === input.userId) throw new AppError('Bạn chỉ được thay đổi quyền của tài khoản khác.', 403);
      if (!isRoleCode(input.role) || !Array.isArray(input.expectedRoles) || input.expectedRoles.length > 6 ||
        input.expectedRoles.some(role => !isRoleCode(role)) || new Set(input.expectedRoles).size !== input.expectedRoles.length) {
        throw new AppError('Danh sách vai trò không hợp lệ.');
      }
      const reason = input.reason.trim();
      if (!reason || reason.length > 2000) throw new AppError('Cần lý do thay đổi quyền, tối đa 2.000 ký tự.');
      return dependencies.transaction(async repository => {
        await currentAdmin(repository, actor.id);
        const account = await repository.findAccountById(input.userId);
        if (!account) throw new AppError('Không tìm thấy tài khoản.', 404);
        const privileged = input.role !== 'CUSTOMER';
        if (privileged && account.status !== 'ACTIVE') throw new AppError('Chỉ cấp quyền nhân sự cho tài khoản đang hoạt động.', 409);
        if (privileged && dependencies.requireVerifiedEmail() && !account.emailVerified) throw new AppError('Tài khoản cần xác minh thư điện tử trước khi được cấp quyền.', 409);
        const wanted: RoleCode[] = privileged ? ['CUSTOMER', input.role] : ['CUSTOMER'];
        if (sameRoles(account.roles, wanted)) return { account, unchanged: true };
        if (!sameRoles(account.roles, input.expectedRoles)) throw new AppError('Quyền tài khoản đã được thay đổi ở nơi khác. Tải lại trước khi lưu.', 409);
        if (account.effectiveRole === 'ADMIN' && input.role !== 'ADMIN' && account.status === 'ACTIVE' &&
          (!dependencies.requireVerifiedEmail() || account.emailVerified) && await repository.countActiveAdmins(dependencies.requireVerifiedEmail()) <= 1) {
          throw new AppError('Cần giữ ít nhất một quản trị viên đang hoạt động.', 409);
        }
        await repository.ensureRole('CUSTOMER');
        await repository.ensureRole(input.role);
        await repository.replaceAccountRoles(account.id, input.role);
        await repository.auditRoleChange(actor.id, account.id, 'ROLE_CHANGED', input.role, account.roles, reason);
        return { account: { ...account, roles: wanted, effectiveRole: input.role }, unchanged: false };
      });
    },

    async grant(actor: { id: string; role: string }, email: string) {
      requireAdmin(actor.role);
      const normalizedEmail = normalizeAccountEmail(email);
      if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        throw new AppError('Địa chỉ thư điện tử không hợp lệ.');
      }
      return dependencies.transaction(async (repository) => {
        await currentAdmin(repository, actor.id);
        const account = await repository.findAccountByEmail(normalizedEmail);
        if (!account) throw new AppError('Chưa tìm thấy tài khoản này. Người vận hành cần đăng ký trước.', 404);
        if (actor.id === account.id) throw new AppError('Bạn chỉ được thay đổi quyền của tài khoản khác.', 403);
        if (account.status !== 'ACTIVE') throw new AppError('Tài khoản chưa hoạt động.', 409);
        if (dependencies.requireVerifiedEmail() && !account.emailVerified) {
          throw new AppError('Tài khoản cần xác minh thư điện tử trước khi được cấp quyền.', 409);
        }
        await repository.ensureRole();
        const added = await repository.grantWorkshopOperator(account.id);
        if (added) await repository.auditRoleChange(actor.id, account.id, 'ROLE_GRANTED');
        return { account, alreadyAssigned: !added, roleName: ROLES.WORKSHOP_OPERATOR.name };
      });
    },

    async revoke(actor: { id: string; role: string }, email: string) {
      requireAdmin(actor.role);
      const normalizedEmail = normalizeAccountEmail(email);
      if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        throw new AppError('Địa chỉ thư điện tử không hợp lệ.');
      }
      return dependencies.transaction(async (repository) => {
        await currentAdmin(repository, actor.id);
        const account = await repository.findAccountByEmail(normalizedEmail);
        if (!account) throw new AppError('Chưa tìm thấy tài khoản này.', 404);
        if (actor.id === account.id) throw new AppError('Bạn chỉ được thay đổi quyền của tài khoản khác.', 403);
        const removed = await repository.revokeWorkshopOperator(account.id);
        if (removed) await repository.auditRoleChange(actor.id, account.id, 'ROLE_REVOKED');
        return { account, removed };
      });
    },
  };
}

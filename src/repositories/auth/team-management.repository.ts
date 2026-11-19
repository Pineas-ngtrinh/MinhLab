import type { QueryResult, QueryResultRow } from 'pg';
import type { TeamManagementRepository } from '../../services/auth/team-management.service';
import type { WorkshopOperatorAccount, ManagedAccount } from '../../contracts/team';
import type { PageOptions } from '../../contracts/pagination';
import { pageInfo } from '../../lib/pagination';
import { AppError } from '../../lib/errors';
import { ROLES, ROLE_PRIORITY, isRoleCode, type RoleCode } from '../../lib/auth-roles';

interface TeamDatabase {
  query<Row extends QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<Row>>;
}

interface TeamAccountRow {
  id: string;
  email: string;
  full_name: string;
  status: string;
  email_verified_at: Date | string | null;
}

interface ManagedAccountRow extends TeamAccountRow { role_codes: string[]; active_role_codes: string[]; telegram_user_id: string | null }
function mapManagedAccount(row: ManagedAccountRow): ManagedAccount {
  const roles = row.role_codes.filter(isRoleCode);
  return { ...mapAccount(row), telegramUserId: row.telegram_user_id ?? null, roles, effectiveRole: ROLE_PRIORITY.find(role => row.active_role_codes.includes(role)) ?? null };
}
const accountColumns = `u.id,u.email,u.full_name,u.status,u.email_verified_at,u.telegram_user_id,
  ARRAY(SELECT r.code FROM user_roles ur JOIN roles r ON r.id=ur.role_id
    WHERE ur.user_id=u.id ORDER BY r.code) AS role_codes,
  ARRAY(SELECT r.code FROM user_roles ur JOIN roles r ON r.id=ur.role_id
    WHERE ur.user_id=u.id AND r.is_active=true ORDER BY r.code) AS active_role_codes`;

function mapAccount(row: TeamAccountRow): WorkshopOperatorAccount {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    status: row.status,
    emailVerified: row.email_verified_at !== null,
  };
}

export class PostgresTeamManagementRepository implements TeamManagementRepository {
  constructor(private readonly database: TeamDatabase) {}

  async setTelegramIdentity(userId: string, telegramUserId: string | null): Promise<void> {
    try { await this.database.query('UPDATE users SET telegram_user_id=$2,updated_at=now() WHERE id=$1', [userId, telegramUserId]); }
    catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') throw new AppError('Telegram ID đã liên kết với tài khoản khác. Hãy gỡ liên kết cũ trước.', 409);
      throw error;
    }
    await this.database.query('DELETE FROM telegram_link_requests WHERE user_id=$1', [userId]);
  }

  async auditTelegramIdentity(actorId: string, userId: string, previous: string | null, next: string | null, reason: string): Promise<void> {
    await this.database.query(`INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,old_values,new_values)
      VALUES($1,'ACCOUNT_TELEGRAM_LINK_CHANGED','USER',$2,$3::jsonb,$4::jsonb)`,
      [actorId,userId,JSON.stringify({telegramUserId:previous}),JSON.stringify({telegramUserId:next,reason})]);
  }

  async ensureRole(code: RoleCode = 'WORKSHOP_OPERATOR'): Promise<void> {
    const role = ROLES[code];
    await this.database.query(
      'INSERT INTO roles (code,name,description) VALUES ($1,$2,$3) ON CONFLICT (code) DO NOTHING',
      [role.code, role.name, role.description],
    );
  }

  async isActiveAdmin(userId: string, requireVerified = false): Promise<boolean> {
    return Boolean((await this.database.query(`SELECT u.id FROM users u WHERE u.id=$1 AND u.status='ACTIVE'
      AND u.deleted_at IS NULL AND ($2::boolean=false OR u.email_verified_at IS NOT NULL)
      AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id
        WHERE ur.user_id=u.id AND r.code='ADMIN' AND r.is_active=true) FOR UPDATE OF u`, [userId, requireVerified])).rowCount);
  }

  async listAccounts(options: PageOptions) {
    const search = options.search?.trim() ?? '';
    const condition = `u.deleted_at IS NULL AND ($1::text='' OR position(lower($1) in lower(u.email||' '||u.full_name))>0)`;
    const total = Number((await this.database.query<{ total: string }>(`SELECT count(*) AS total FROM users u WHERE ${condition}`, [search])).rows[0].total);
    const result = await this.database.query<ManagedAccountRow>(`SELECT ${accountColumns} FROM users u WHERE ${condition}
      ORDER BY u.created_at DESC,u.id DESC LIMIT $2 OFFSET $3`, [search, options.pageSize, (options.page - 1) * options.pageSize]);
    return { data: result.rows.map(mapManagedAccount), pagination: pageInfo(options, total) };
  }

  async findAccountById(userId: string) {
    const result = await this.database.query<ManagedAccountRow>(`SELECT ${accountColumns} FROM users u
      WHERE u.id=$1 AND u.deleted_at IS NULL FOR UPDATE OF u`, [userId]);
    return result.rows[0] ? mapManagedAccount(result.rows[0]) : null;
  }

  async countActiveAdmins(requireVerified: boolean) {
    return Number((await this.database.query<{ total: string }>(`SELECT count(*) AS total FROM users u
      WHERE u.status='ACTIVE' AND u.deleted_at IS NULL AND ($1::boolean=false OR u.email_verified_at IS NOT NULL)
      AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id
        WHERE ur.user_id=u.id AND r.code='ADMIN' AND r.is_active=true)`, [requireVerified])).rows[0].total);
  }

  async replaceAccountRoles(userId: string, role: RoleCode) {
    await this.database.query('DELETE FROM user_roles WHERE user_id=$1', [userId]);
    const result = await this.database.query(`INSERT INTO user_roles(user_id,role_id)
      SELECT $1,id FROM roles WHERE code IN ('CUSTOMER',$2) AND is_active=true RETURNING user_id`, [userId, role]);
    if (result.rowCount !== (role === 'CUSTOMER' ? 1 : 2)) throw new AppError('Vai trò đang tạm ngừng hoặc chưa được cấu hình.', 409);
  }

  async listWorkshopOperators(): Promise<WorkshopOperatorAccount[]> {
    const result = await this.database.query<TeamAccountRow>(
      `SELECT u.id,u.email,u.full_name,u.status,u.email_verified_at
         FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
        WHERE r.code='WORKSHOP_OPERATOR' AND u.deleted_at IS NULL
        ORDER BY u.full_name,u.email`,
    );
    return result.rows.map(mapAccount);
  }

  async findAccountByEmail(normalizedEmail: string): Promise<WorkshopOperatorAccount | null> {
    const result = await this.database.query<TeamAccountRow>(
      `SELECT id,email,full_name,status,email_verified_at
         FROM users WHERE email_normalized=$1 AND deleted_at IS NULL LIMIT 1 FOR UPDATE`,
      [normalizedEmail],
    );
    return result.rows[0] ? mapAccount(result.rows[0]) : null;
  }

  async grantWorkshopOperator(userId: string): Promise<boolean> {
    const result = await this.database.query<{ user_id: string }>(
      `INSERT INTO user_roles (user_id,role_id)
       SELECT $1,id FROM roles WHERE code='WORKSHOP_OPERATOR'
       ON CONFLICT (user_id,role_id) DO NOTHING RETURNING user_id`,
      [userId],
    );
    return Boolean(result.rows[0]);
  }

  async revokeWorkshopOperator(userId: string): Promise<boolean> {
    const result = await this.database.query<{ user_id: string }>(
      `DELETE FROM user_roles ur USING roles r
        WHERE ur.user_id=$1 AND ur.role_id=r.id AND r.code='WORKSHOP_OPERATOR'
        RETURNING ur.user_id`,
      [userId],
    );
    return Boolean(result.rows[0]);
  }

  async auditRoleChange(actorId: string, userId: string, action: 'ROLE_GRANTED' | 'ROLE_REVOKED' | 'ROLE_CHANGED', role: RoleCode = 'WORKSHOP_OPERATOR', previousRoles?: RoleCode[], reason?: string): Promise<void> {
    await this.database.query(
      `INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,old_values,new_values)
       VALUES($1,$2,'USER',$3,$4::jsonb,$5::jsonb)`,
      [actorId, action === 'ROLE_CHANGED' ? 'ACCOUNT_ROLE_CHANGED' : `WORKSHOP_OPERATOR_${action}`, userId,
        previousRoles ? JSON.stringify({ roles: previousRoles }) : null,
        JSON.stringify({ role, roles: action === 'ROLE_CHANGED' ? role === 'CUSTOMER' ? ['CUSTOMER'] : ['CUSTOMER', role] : undefined, reason })],
    );
  }
}

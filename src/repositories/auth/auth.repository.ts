import type { QueryResult, QueryResultRow } from 'pg';
import { ROLE_PRIORITY, type RoleCode, type RoleInfo } from '../../lib/auth-roles';
import { SESSION_MAX_AGE_SECONDS, type AccountActionPurpose, type AccountContact } from '../../domain/auth/account';
import type { AuthRepository, NewAccount } from '../../services/auth/auth.ports';
import { authTimestamp, mapAccount, mapSession, type AccountRow, type SessionRow } from './auth-mapping';

const USER_SELECT = `
  SELECT u.id, u.email, u.phone, u.password_hash, u.full_name, u.status,
         u.email_verified_at, r.code AS role_code, u.created_at, u.updated_at
    FROM users u
    JOIN user_roles ur ON ur.user_id = u.id
    JOIN roles r ON r.id = ur.role_id AND r.is_active = true`;

interface AuthDatabase {
  query<Row extends QueryResultRow>(text: string, values?: unknown[]): Promise<QueryResult<Row>>;
}

/** All authentication persistence uses either a pool or the caller's transaction client. */
export class PostgresAuthRepository implements AuthRepository {
  constructor(private readonly database: AuthDatabase) {}

  async ensureRole(role: RoleInfo): Promise<void> {
    await this.database.query(
      'INSERT INTO roles (code,name,description) VALUES ($1,$2,$3) ON CONFLICT (code) DO NOTHING',
      [role.code, role.name, role.description],
    );
  }

  async createBootstrapAccount(input: NewAccount): Promise<string | null> {
    const result = await this.database.query<{ id: string }>(
      `INSERT INTO users (email,email_normalized,password_hash,full_name,status,email_verified_at)
       VALUES ($1,$2,$3,$4,'ACTIVE',now()) ON CONFLICT (email_normalized) DO NOTHING RETURNING id`,
      [input.email, input.normalizedEmail, input.passwordHash, input.fullName],
    );
    return result.rows[0]?.id ?? null;
  }

  async hasRole(normalizedEmail: string, role: RoleCode): Promise<boolean> {
    const result = await this.database.query<{ has_role: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
          WHERE u.email_normalized=$1 AND r.code=$2
       ) AS has_role`, [normalizedEmail, role],
    );
    return result.rows[0]?.has_role === true;
  }

  async grantRole(id: string, role: RoleCode): Promise<void> {
    await this.database.query(
      `INSERT INTO user_roles (user_id,role_id) SELECT $1,id FROM roles WHERE code=$2
       ON CONFLICT (user_id,role_id) DO NOTHING`, [id, role],
    );
  }

  async createAccount(input: NewAccount) {
    const result = await this.database.query<Omit<AccountRow, 'role_code'>>(
      `INSERT INTO users (email,email_normalized,phone,password_hash,full_name,status)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id,email,phone,password_hash,full_name,status,email_verified_at,created_at,updated_at`,
      [input.email, input.normalizedEmail, input.phone, input.passwordHash, input.fullName, input.status],
    );
    return mapAccount({ ...result.rows[0], role_code: input.role });
  }

  async findAccount(normalizedEmail: string) {
    const result = await this.database.query<AccountRow>(
      `${USER_SELECT} WHERE u.email_normalized=$1 AND u.deleted_at IS NULL AND r.code=ANY($2::varchar[])
       ORDER BY array_position($2::varchar[],r.code) LIMIT 1`, [normalizedEmail, ROLE_PRIORITY],
    );
    return result.rows[0] ? mapAccount(result.rows[0]) : null;
  }

  async lockAccountContact(normalizedEmail: string): Promise<AccountContact | null> {
    const result = await this.database.query<{ id: string; email: string; email_verified_at: Date | string | null }>(
      `SELECT id,email,email_verified_at FROM users
        WHERE email_normalized=$1 AND deleted_at IS NULL AND status IN ('ACTIVE','PENDING') FOR UPDATE`,
      [normalizedEmail],
    );
    const row = result.rows[0];
    return row ? { id: row.id, email: row.email, emailVerifiedAt: row.email_verified_at ? authTimestamp(row.email_verified_at) : null } : null;
  }

  async recordAttempt(keyHash: string): Promise<number> {
    const result = await this.database.query<{ attempts: number }>(
      `INSERT INTO auth_login_attempts (key_hash) VALUES ($1)
       ON CONFLICT (key_hash) DO UPDATE SET
         attempts=CASE WHEN auth_login_attempts.window_start<now()-interval '15 minutes' THEN 1 ELSE auth_login_attempts.attempts+1 END,
         window_start=CASE WHEN auth_login_attempts.window_start<now()-interval '15 minutes' THEN now() ELSE auth_login_attempts.window_start END
       RETURNING attempts`, [keyHash],
    );
    return result.rows[0].attempts;
  }

  async clearAttempts(keyHash: string): Promise<void> {
    await this.database.query('DELETE FROM auth_login_attempts WHERE key_hash=$1', [keyHash]);
  }

  async recordLogin(id: string): Promise<void> {
    await this.database.query('UPDATE users SET last_login_at=now() WHERE id=$1', [id]);
  }

  async replaceAccountToken(id: string, purpose: AccountActionPurpose, hash: string): Promise<void> {
    await this.consumeAccountTokens(id, purpose);
    await this.database.query(
      `INSERT INTO account_tokens (user_id,purpose,token_hash,expires_at)
       VALUES ($1,$2,$3,now()+interval '30 minutes')`, [id, purpose, hash],
    );
  }

  async hasUsableToken(hash: string, purpose: AccountActionPurpose): Promise<boolean> {
    const result = await this.database.query<{ usable: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM account_tokens t JOIN users u ON u.id=t.user_id
          WHERE t.token_hash=$1 AND t.purpose=$2 AND t.used_at IS NULL AND t.expires_at>now()
            AND u.deleted_at IS NULL AND u.status IN ('ACTIVE','PENDING')
       ) AS usable`, [hash, purpose],
    );
    return result.rows[0]?.usable === true;
  }

  async hasUsableTokenAtCurrentTime(hash: string, purpose: AccountActionPurpose): Promise<boolean> {
    const result = await this.database.query<{ usable: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM account_tokens t JOIN users u ON u.id=t.user_id
          WHERE t.token_hash=$1 AND t.purpose=$2 AND t.used_at IS NULL AND t.expires_at>clock_timestamp()
            AND u.deleted_at IS NULL AND u.status IN ('ACTIVE','PENDING')
       ) AS usable`, [hash, purpose],
    );
    return result.rows[0]?.usable === true;
  }

  async lockTokenAccount(hash: string, purpose: AccountActionPurpose): Promise<string | null> {
    const result = await this.database.query<{ user_id: string }>(
      `SELECT t.user_id FROM account_tokens t JOIN users u ON u.id=t.user_id
        WHERE t.token_hash=$1 AND t.purpose=$2 AND t.used_at IS NULL AND t.expires_at>now()
          AND u.deleted_at IS NULL AND u.status IN ('ACTIVE','PENDING') FOR UPDATE OF t,u`, [hash, purpose],
    );
    return result.rows[0]?.user_id ?? null;
  }

  async consumeAccountTokens(id: string, purpose: AccountActionPurpose): Promise<void> {
    await this.database.query('UPDATE account_tokens SET used_at=now() WHERE user_id=$1 AND purpose=$2 AND used_at IS NULL', [id, purpose]);
  }

  async verifyEmail(id: string): Promise<void> {
    await this.database.query("UPDATE users SET email_verified_at=now(),status='ACTIVE',updated_at=now() WHERE id=$1", [id]);
  }

  async updatePassword(id: string, hash: string): Promise<void> {
    await this.database.query('UPDATE users SET password_hash=$2,updated_at=now() WHERE id=$1', [id, hash]);
  }

  async revokeAccountSessions(id: string): Promise<void> {
    await this.database.query('UPDATE auth_sessions SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL', [id]);
  }

  async createSession(id: string, hash: string): Promise<void> {
    await this.database.query(
      `INSERT INTO auth_sessions (user_id,refresh_token_hash,expires_at)
       VALUES ($1,$2,now()+$3*interval '1 second')`, [id, hash, SESSION_MAX_AGE_SECONDS],
    );
  }

  async findSession(hash: string, requireVerifiedEmail: boolean) {
    const result = await this.database.query<SessionRow>(
      `SELECT u.id,u.email,u.full_name,u.phone,r.code,s.expires_at FROM auth_sessions s
       JOIN users u ON u.id=s.user_id JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id
       WHERE s.refresh_token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at>now()
         AND u.status='ACTIVE' AND u.deleted_at IS NULL AND r.is_active=true AND r.code=ANY($3::varchar[])
         AND ($2::boolean=false OR u.email_verified_at IS NOT NULL)
       ORDER BY array_position($3::varchar[],r.code) LIMIT 1`,
      [hash, requireVerifiedEmail, ROLE_PRIORITY],
    );
    return result.rows[0] ? mapSession(result.rows[0]) : null;
  }

  async revokeSession(hash: string): Promise<void> {
    await this.database.query('UPDATE auth_sessions SET revoked_at=now() WHERE refresh_token_hash=$1 AND revoked_at IS NULL', [hash]);
  }
}

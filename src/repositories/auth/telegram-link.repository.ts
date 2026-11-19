import type { PoolClient } from 'pg';
import { AppError } from '../../lib/errors';
import type { TelegramLinkRepository } from '../../services/auth/telegram-link.service';
import type { TelegramLinkStatus, TelegramStartIdentity } from '../../contracts/telegram-link';

interface LinkRow { telegram_user_id: string | null; request_id: string | null; candidate_id: string | null; candidate_name: string | null }
export class PostgresTelegramLinkRepository implements TelegramLinkRepository {
  constructor(private readonly transaction: <T>(operation: (client: PoolClient) => Promise<T>) => Promise<T>, private readonly requireVerified: () => boolean) {}
  // All identity writers lock the user first, including admin/manual linking.
  private async lock(client: PoolClient, userId: string) {
    const result = await client.query<{ telegram_user_id: string | null }>(`SELECT telegram_user_id FROM users WHERE id=$1 AND status='ACTIVE' AND deleted_at IS NULL
      AND ($2::boolean=false OR email_verified_at IS NOT NULL) FOR UPDATE`, [userId, this.requireVerified()]);
    if (!result.rows[0]) throw new AppError('Tài khoản không còn hoạt động. Vui lòng đăng nhập lại.', 401);
    return result.rows[0].telegram_user_id;
  }
  async status(userId: string): Promise<TelegramLinkStatus> {
    return this.transaction(async client => {
      await this.lock(client, userId);
      const { rows } = await client.query<LinkRow>(`SELECT u.telegram_user_id,t.request_id,t.candidate_id,t.candidate_name FROM users u
        LEFT JOIN telegram_link_requests t ON t.user_id=u.id AND t.expires_at>clock_timestamp() WHERE u.id=$1`, [userId]);
      const row = rows[0];
      return { linkedId: row.telegram_user_id, waiting: Boolean(row.request_id), pending: row.candidate_id && row.request_id
        ? { requestId: row.request_id, telegramId: row.candidate_id, name: row.candidate_name || 'Tài khoản Telegram' } : null };
    });
  }
  async start(userId: string, requestId: string, hash: string) {
    await this.transaction(async client => {
      const previous = await this.lock(client, userId);
      await client.query(`INSERT INTO telegram_link_requests(user_id,request_id,token_hash,expires_at,previous_telegram_user_id)
        VALUES($1,$2,$3,clock_timestamp()+interval '10 minutes',$4) ON CONFLICT(user_id) DO UPDATE SET
        request_id=$2,token_hash=$3,expires_at=clock_timestamp()+interval '10 minutes',previous_telegram_user_id=$4,candidate_id=NULL,candidate_name=NULL`, [userId, requestId, hash, previous]);
    });
  }
  async propose(hash: string, identity: TelegramStartIdentity) {
    return this.transaction(async client => {
      const owner = await client.query<{ user_id: string }>('SELECT user_id FROM telegram_link_requests WHERE token_hash=$1', [hash]);
      if (!owner.rows[0]) return false;
      try { await this.lock(client, owner.rows[0].user_id); }
      catch (error) { if (error instanceof AppError) return false; throw error; }
      const result = await client.query(`UPDATE telegram_link_requests SET candidate_id=$2,candidate_name=$3
        WHERE token_hash=$1 AND expires_at>clock_timestamp() AND (candidate_id IS NULL OR candidate_id=$2) RETURNING user_id`, [hash, identity.telegramId, identity.name]);
      return Boolean(result.rowCount);
    });
  }
  async confirm(userId: string, requestId: string) {
    try {
      await this.transaction(async client => {
        const previous = await this.lock(client, userId);
        const result = await client.query<{ candidate_id: string }>(`SELECT candidate_id FROM telegram_link_requests WHERE user_id=$1 AND request_id=$2
          AND expires_at>clock_timestamp() AND candidate_id IS NOT NULL AND previous_telegram_user_id IS NOT DISTINCT FROM $3::varchar FOR UPDATE`, [userId, requestId, previous]);
        const next = result.rows[0]?.candidate_id;
        if (!next) throw new AppError('Liên kết đã thay đổi hoặc hết hạn. Hãy tạo liên kết mới.', 409);
        await client.query('UPDATE users SET telegram_user_id=$2,updated_at=now() WHERE id=$1', [userId, next]);
        await this.audit(client, userId, previous, next);
        await client.query('DELETE FROM telegram_link_requests WHERE user_id=$1', [userId]);
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === '23505') throw new AppError('Telegram này đã liên kết với tài khoản website khác. Hãy gỡ liên kết cũ trước.', 409);
      throw error;
    }
  }
  async unlink(userId: string) {
    await this.transaction(async client => {
      const previous = await this.lock(client, userId);
      await client.query('UPDATE users SET telegram_user_id=NULL,updated_at=now() WHERE id=$1', [userId]);
      await client.query('DELETE FROM telegram_link_requests WHERE user_id=$1', [userId]);
      if (previous) await this.audit(client, userId, previous, null);
    });
  }
  private async audit(client: PoolClient, userId: string, previous: string | null, next: string | null) {
    await client.query(`INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,old_values,new_values)
      VALUES($1,'ACCOUNT_TELEGRAM_LINK_CHANGED','USER',$1,$2::jsonb,$3::jsonb)`, [userId, JSON.stringify({ telegramUserId: previous }), JSON.stringify({ telegramUserId: next, reason: 'Chủ tài khoản tự xác nhận liên kết Telegram trên website' })]);
  }
}

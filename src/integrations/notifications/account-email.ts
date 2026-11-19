import type { PoolClient } from 'pg';
import type { AccountNotifications } from '../../services/auth/auth.ports';

/** Enqueue in the same transaction as the token; return the exact row for immediate delivery. */
export function accountEmailNotifications(client: PoolClient, siteUrl: () => string | undefined): AccountNotifications {
  return {
    async accountAction(user, purpose, token, hash) {
      const url = purpose === 'PASSWORD_RESET' ? new URL('/dat-lai-mat-khau', siteUrl()) : null;
      if (url) url.searchParams.set('token', token);
      const subject = purpose === 'EMAIL_VERIFICATION' ? 'Xác minh email tài khoản MinhLab' : 'Đặt lại mật khẩu MinhLab';
      const body = purpose === 'EMAIL_VERIFICATION'
        ? `${subject}\n\nMã xác minh: ${token}\n\nQuay lại trang đăng ký hoặc mở mục Xác minh email trên website MinhLab để nhập mã này. Mã chỉ dùng một lần, có hiệu lực trong 30 phút. Không chia sẻ mã cho người khác.\n\nNếu bạn không gửi yêu cầu này, hãy bỏ qua email.`
        : `${subject}\n\nMở liên kết sau trong vòng 30 phút:\n${url}\n\nNếu bạn không gửi yêu cầu này, hãy bỏ qua email.`;
      const result = await client.query<{ id: string }>(
        `INSERT INTO email_outbox (dedup_key,recipient,subject,body_text,notification_type) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [`${purpose}-${hash}`, user.email, subject, body, purpose],
      );
      return result.rows[0].id;
    },
  };
}

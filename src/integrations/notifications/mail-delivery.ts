import type { Pool } from 'pg';

interface OutboxMail {
  id: string;
  recipient: string;
  subject: string;
  body_text: string;
}

export type MailDeliveryResult = 'empty' | 'sent' | 'failed';

/** Lock one committed outbox row so an immediate send and the retry worker cannot race. */
export async function deliverQueuedMail(pool: Pool, id?: string): Promise<MailDeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error('Chưa cấu hình RESEND_API_KEY và EMAIL_FROM.');

  const client = await pool.connect();
  let discardClient = false;
  try {
    await client.query('BEGIN');
    const result = await client.query<OutboxMail>(`SELECT id,recipient,subject,body_text FROM email_outbox
      WHERE status <> 'SENT' AND attempts < 5 AND retry_after <= now()
        AND ($1::uuid IS NULL OR id = $1::uuid)
      ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1`, [id ?? null]);
    const mail = result.rows[0];
    if (!mail) {
      await client.query('COMMIT');
      return 'empty';
    }

    let outcome: MailDeliveryResult = 'sent';
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST', signal: AbortSignal.timeout(15_000),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `minhlab-${mail.id}`,
        },
        body: JSON.stringify({ from, to: [mail.recipient], subject: mail.subject, text: mail.body_text }),
      });
      if (!response.ok) throw new Error(`Mail provider HTTP ${response.status}`);
      const payload: unknown = await response.json();
      const providerId = typeof payload === 'object' && payload !== null && 'id' in payload && typeof payload.id === 'string'
        ? payload.id : null;
      await client.query(`UPDATE email_outbox SET status='SENT', attempts=attempts+1,
        sent_at=now(), last_error=NULL, provider_message_id=$2 WHERE id=$1`, [mail.id, providerId]);
    } catch (error: unknown) {
      outcome = 'failed';
      const message = error instanceof Error ? error.message : 'Mail provider failed';
      await client.query(`UPDATE email_outbox SET status='FAILED', attempts=attempts+1,
        retry_after=now()+interval '5 minutes', last_error=$2 WHERE id=$1`, [mail.id, message]);
    }
    await client.query('COMMIT');
    return outcome;
  } catch (error: unknown) {
    try { await client.query('ROLLBACK'); } catch { discardClient = true; }
    throw error;
  } finally {
    client.release(discardClient);
  }
}

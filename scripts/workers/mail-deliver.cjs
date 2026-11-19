require('../lib/register-typescript.cjs');
const { createPool } = require('../lib/database.cjs');
const { deliverQueuedMail } = require('../../src/integrations/notifications/mail-delivery.ts');

async function main() {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    throw new Error('Chưa cấu hình RESEND_API_KEY và EMAIL_FROM; email vẫn nằm trong outbox, chưa gửi ra ngoài.');
  }
  const pool = createPool();
  try {
    // Bounded retry batch; schedule this command externally in production.
    for (let index = 0; index < 20; index += 1) {
      const result = await deliverQueuedMail(pool);
      if (result === 'empty') break;
      if (result === 'failed') process.exitCode = 1;
    }
  } finally { await pool.end(); }
}
main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });

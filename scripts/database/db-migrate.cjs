const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { projectRoot, createPool } = require('../lib/database.cjs');

async function main() {
  const pool = createPool(process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL);
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext('minhlab-migrations'))");
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY, checksum char(64) NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const directory = path.join(projectRoot, 'database/migrations');
    for (const filename of fs.readdirSync(directory).filter(n => /^\d+.*\.sql$/.test(n)).sort()) {
      const source = fs.readFileSync(path.join(directory, filename), 'utf8');
      const checksum = createHash('sha256').update(source).digest('hex');
      const existing = await client.query('SELECT checksum FROM schema_migrations WHERE filename=$1', [filename]);
      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== checksum) throw new Error(`Migration đã áp dụng bị thay đổi: ${filename}. Tạo migration mới thay vì sửa lịch sử.`);
        continue;
      }
      const legacy = filename === '001_init.sql' && (await client.query("SELECT to_regclass('public.users') IS NOT NULL AS present")).rows[0].present;
      await client.query('BEGIN');
      try {
        if (!legacy) await client.query(source);
        await client.query('INSERT INTO schema_migrations(filename,checksum) VALUES ($1,$2)', [filename, checksum]);
        await client.query('COMMIT');
        process.stdout.write(`${legacy ? 'Baseline' : 'Applied'}: ${filename}\n`);
      } catch (error) {
        await client.query('ROLLBACK'); throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('minhlab-migrations'))");
    client.release(); await pool.end();
  }
}
main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });

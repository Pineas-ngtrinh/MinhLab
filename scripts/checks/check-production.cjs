const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { projectRoot, createPool } = require('../lib/database.cjs');
require('../lib/register-typescript.cjs');
const { manualVietQrDestination } = require('../../src/server/payment-config.ts');
const { cloudinaryImageConfig } = require('../../src/server/cloudinary-config.ts');
const { privateFileConfig } = require('../../src/integrations/private-files/local-store.ts');
const { purgeJournalRoot } = require('../../src/integrations/private-files/purge-journal.ts');

function checkoutPaymentReadiness(environment = process.env) {
  const result = (state, detail, missingFields = []) => ({ state, passed: state === 'READY', detail, missingFields });
  if (environment.MINHLAB_MANUAL_VIETQR_ENABLED !== 'true') {
    return result('DISABLED', 'DISABLED: Checkout đang tắt vì VietQR cá nhân chưa được bật.');
  }
  const missingFields = [
    'MINHLAB_VIETQR_BANK_BIN', 'MINHLAB_VIETQR_BANK_NAME',
    'MINHLAB_VIETQR_ACCOUNT_NUMBER', 'MINHLAB_VIETQR_ACCOUNT_NAME',
  ].filter((key) => !environment[key]?.trim());
  if (missingFields.length > 0) {
    return result('MISSING_DESTINATION', `MISSING_DESTINATION: Thiếu cấu hình ${missingFields.join(', ')}.`, missingFields);
  }
  if (!manualVietQrDestination(environment)) {
    return result('INVALID_DESTINATION', 'INVALID_DESTINATION: Ngân hàng nhận không hợp lệ theo cùng quy tắc của checkout.');
  }
  return result('READY', 'READY: VietQR đã bật và destination hợp lệ; chưa xác minh quyền sở hữu ngân hàng hoặc nhận tiền thật.');
}

function checkoutReadinessCheck(checks) {
  const blocked = [
    'manual VietQR configuration', 'public HTTPS URL', 'migrations',
    'runtime database role', 'runtime database permissions', 'sellable catalogue',
  ].filter((name) => checks.find((check) => check.name === name)?.passed !== true);
  return {
    name: 'checkout operational readiness',
    passed: blocked.length === 0,
    detail: blocked.length > 0
      ? `Chưa đủ tiền điều kiện checkout: ${blocked.join(', ')}.`
      : 'Các tiền điều kiện checkout đã đạt; chưa tạo đơn, chuyển tiền hoặc kiểm thử giao dịch thật.',
  };
}

function configurationChecks(environment = process.env) {
  const checks = [];
  const add = (name, passed, detail) => checks.push({ name, passed, detail });
  let imagesConfigured = false;
  try { cloudinaryImageConfig(environment); imagesConfigured = true; } catch {}
  add('catalogue image uploads', imagesConfigured,
    'Cần đủ cấu hình Cloudinary hợp lệ để tải ảnh chính và ảnh góc sản phẩm; chưa gọi dịch vụ thật.');
  const privateFilesEnabled = environment.MINHLAB_PRIVATE_FILES_ENABLED === 'true';
  add('private file intake configuration', !privateFilesEnabled || Boolean(privateFileConfig(environment)),
    privateFilesEnabled
      ? 'Kho private đã bật: cần đường dẫn, scanner, định dạng, quota và thời gian lưu hợp lệ; vẫn cần chạy files:process trên VPS.'
      : 'Kho private đang tắt; upload file custom và ảnh biên lai sẽ chưa dùng được.');
  let journalConfigured = false;
  try { purgeJournalRoot(environment); journalConfigured = true; } catch {}
  add('private file cleanup journal', !privateFilesEnabled || journalConfigured,
    'Khi bật private intake, cấu hình volume nhật ký purge riêng ngoài private root/webroot; chưa kiểm chứng ghi/fsync hoặc backup.');
  add(
    'mail credentials',
    Boolean(environment.RESEND_API_KEY?.trim() && environment.EMAIL_FROM?.trim()),
    'Cấu hình khóa API và địa chỉ gửi đã xác minh; không kiểm chứng việc gửi bằng lệnh này.',
  );
  add(
    'Telegram store alerts',
    Boolean(environment.TELEGRAM_BOT_TOKEN?.trim() && environment.TELEGRAM_CHAT_ID?.trim()),
    'Cần bot token và chat ID; worker chỉ gửi sau khi DB commit.',
  );
  const validWebhookSecret = /^[A-Za-z0-9_-]{1,256}$/.test(environment.TELEGRAM_WEBHOOK_SECRET?.trim() || '');
  add(
    'Telegram payment confirmation',
    validWebhookSecret,
    'Cần webhook secret; liên kết Telegram trong Tài khoản & phân quyền trên website. Quyền được kiểm tra lại khi bấm.',
  );
  let https = false;
  try {
    https = new URL(environment.NEXT_PUBLIC_SITE_URL).protocol === 'https:';
  } catch {}
  add('public HTTPS URL', https, 'NEXT_PUBLIC_SITE_URL cần trỏ tới tên miền HTTPS thật.');
  add(
    'verification enabled',
    environment.MINHLAB_REQUIRE_EMAIL_VERIFICATION !== 'false',
    'Production mặc định yêu cầu xác minh email.',
  );
  const payment = checkoutPaymentReadiness(environment);
  add('manual VietQR configuration', payment.passed, payment.detail);
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  add(
    'production Node LTS',
    [22, 24].includes(nodeMajor),
    `Đang dùng Node ${process.versions.node}; dùng Node 22/24 LTS đã hỗ trợ tại mốc rà soát 24/10/2026. Đối chiếu https://nodejs.org/en/about/previous-releases trước phát hành.`,
  );
  const nextVersion = require('next/package.json').version;
  add(
    'framework support',
    Number(nextVersion.split('.')[0]) >= 15,
    `Đang dùng Next.js ${nextVersion}; nhánh 14 đã ngoài thời gian hỗ trợ. Đối chiếu https://nextjs.org/support-policy trước mỗi lần phát hành.`,
  );
  return checks;
}

async function main() {
  const checks = configurationChecks();
  const add = (name, passed, detail) => checks.push({ name, passed, detail });
  let pool;
  try {
    pool = createPool();
    const files = fs
      .readdirSync(path.join(projectRoot, 'database/migrations'))
      .filter((n) => /^\d+.*\.sql$/.test(n));
    const applied = new Map(
      (await pool.query('SELECT filename,checksum FROM schema_migrations')).rows.map((r) => [
        r.filename,
        r.checksum,
      ]),
    );
    add(
      'migrations',
      files.every(
        (f) =>
          applied.get(f) ===
          createHash('sha256')
            .update(fs.readFileSync(path.join(projectRoot, 'database/migrations', f)))
            .digest('hex'),
      ),
      'Áp dụng mọi migration bằng tài khoản migration riêng trước khi khởi chạy.',
    );
    const identityMigration = applied.has('026_account_telegram_identity.sql');
    if (identityMigration) {
      const linked = await pool.query(`SELECT count(DISTINCT u.id)::int AS count FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE u.telegram_user_id IS NOT NULL AND u.status='ACTIVE' AND u.deleted_at IS NULL AND ($1::boolean=false OR u.email_verified_at IS NOT NULL) AND r.is_active=true AND r.code IN ('ADMIN')`, [process.env.MINHLAB_REQUIRE_EMAIL_VERIFICATION !== 'false']);
      add('Telegram account permissions', linked.rows[0].count > 0, `${linked.rows[0].count} tài khoản đang hoạt động có quyền đối soát và liên kết Telegram; chưa kiểm thử nút thật.`);
    } else add('Telegram account permissions', false, 'Chạy migration 026 rồi liên kết Telegram cho ít nhất một tài khoản ADMIN.');
    const role = (await pool.query('SELECT rolsuper FROM pg_roles WHERE rolname=current_user'))
      .rows[0];
    add(
      'runtime database role',
      !role.rolsuper,
      'Tài khoản chạy app không được là PostgreSQL superuser.',
    );
    const permissions = (await pool.query(`SELECT
      has_table_privilege(current_user,'user_roles','DELETE') AS can_revoke_role,
      has_table_privilege(current_user,'categories','INSERT') AS can_create_category,
      has_table_privilege(current_user,'refunds','INSERT') AS can_record_refund,
      has_table_privilege(current_user,'orders','DELETE') AS can_delete_orders,
      has_table_privilege(current_user,'audit_logs','UPDATE') AS can_rewrite_audit,
      has_table_privilege(current_user,'audit_logs','DELETE') AS can_delete_audit`)).rows[0];
    add('runtime database permissions',
      permissions.can_revoke_role && permissions.can_create_category && permissions.can_record_refund
        && !permissions.can_delete_orders && !permissions.can_rewrite_audit && !permissions.can_delete_audit,
      'Runtime cần quyền tạo danh mục, ghi hoàn tiền và thu hồi vai trò; không được xóa đơn hoặc sửa/xóa audit.');
    const products = Number(
      (
        await pool.query(
          "SELECT count(*) FROM products p JOIN product_variants v ON v.product_id=p.id WHERE p.publication_status='PUBLISHED' AND p.compliance_status='APPROVED' AND v.status='ACTIVE'",
        )
      ).rows[0].count,
    );
    add(
      'sellable catalogue',
      products > 0,
      `${products} biến thể có sản phẩm được duyệt và xuất bản; không tự chuyển sản phẩm sang APPROVED.`,
    );
  } catch (error) {
    add('database readiness', false, error.code || 'Không thể kiểm tra schema.');
  } finally {
    if (pool) await pool.end();
  }
  checks.push(checkoutReadinessCheck(checks));
  for (const check of checks)
    process.stdout.write(`${check.passed ? 'PASS' : 'FAIL'} ${check.name}: ${check.detail}\n`);
  if (checks.some((c) => !c.passed)) process.exitCode = 1;
}
if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { configurationChecks, checkoutPaymentReadiness, checkoutReadinessCheck };

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost']);
const POSTGRES_PROTOCOLS = new Set(['postgres:', 'postgresql:']);

function parsePostgresUrl(name, value) {
  if (!value) throw new Error(`${name} phải được khai báo tường minh cho PostgreSQL kiểm thử.`);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} không phải URL PostgreSQL hợp lệ.`);
  }
  if (!POSTGRES_PROTOCOLS.has(url.protocol)) throw new Error(`${name} phải dùng giao thức PostgreSQL.`);
  if (!LOOPBACK_HOSTS.has(url.hostname)) throw new Error(`${name} chỉ được trỏ đến endpoint loopback đã xác minh.`);
  return url;
}

function resolveProductionTestTarget(env = process.env) {
  if (env.MINHLAB_TEST_DATABASE_DISPOSABLE !== 'true') {
    throw new Error('Từ chối chạy: chỉ đặt MINHLAB_TEST_DATABASE_DISPOSABLE=true sau khi xác minh độc lập cụm PostgreSQL dùng riêng cho kiểm thử.');
  }

  const sourceUrl = parsePostgresUrl('TEST_DATABASE_URL', env.TEST_DATABASE_URL);
  const appUrl = parsePostgresUrl('TEST_RUNTIME_DATABASE_URL', env.TEST_RUNTIME_DATABASE_URL);
  if (sourceUrl.host !== appUrl.host) {
    throw new Error('TEST_DATABASE_URL và TEST_RUNTIME_DATABASE_URL phải trỏ cùng endpoint kiểm thử đã xác minh.');
  }
  if (appUrl.username !== 'minhlab_app') {
    throw new Error('TEST_RUNTIME_DATABASE_URL phải dùng role runtime minhlab_app để kiểm tra quyền hạn chế.');
  }

  return { sourceUrl, appUrl };
}

module.exports = { resolveProductionTestTarget };

import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

declare global {
  var minhlabPgPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('Thiếu DATABASE_URL. Hãy cấu hình chuỗi kết nối PostgreSQL trong .env.local.');
  }

  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    statement_timeout: 10_000,
    query_timeout: 12_000,
  });
  pool.on('error', () => { process.stderr.write('PostgreSQL: kết nối nhàn rỗi bị ngắt.\n'); });
  return pool;
}

export function getDbPool(): Pool {
  globalThis.minhlabPgPool ??= createPool();
  return globalThis.minhlabPgPool;
}

export async function query<Row extends QueryResultRow = QueryResultRow>(
  text: string,
  values: readonly unknown[] = [],
): Promise<QueryResult<Row>> {
  return getDbPool().query<Row>(text, [...values]);
}

export async function withTransaction<T>(
  operation: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getDbPool().connect();
  let discardClient = false;
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (error: unknown) {
    try {
      await client.query('ROLLBACK');
    } catch {
      discardClient = true;
    }
    throw error;
  } finally {
    client.release(discardClient);
  }
}

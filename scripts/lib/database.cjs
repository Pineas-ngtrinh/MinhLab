const path = require('node:path');
const { loadEnvConfig } = require('@next/env');
const { Pool } = require('pg');
const projectRoot = path.resolve(__dirname, '../..');
if (process.env.MINHLAB_ENV_FROM_PROCESS !== 'true') loadEnvConfig(projectRoot);
function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error('Thiếu DATABASE_URL.');
  return new Pool({ connectionString, connectionTimeoutMillis: 5000 });
}
module.exports = { projectRoot, createPool };

const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { projectRoot, createPool } = require('../lib/database.cjs');

async function main() {
  const ownerUrl = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_URL;
  const connection = new URL(ownerUrl);
  if (!['localhost','127.0.0.1'].includes(connection.hostname) || connection.pathname !== '/minhlab') {
    throw new Error('Lệnh này chỉ thiết lập role cho database minhlab local.');
  }
  const role = 'minhlab_app';
  const envPath = path.join(projectRoot,'.env.local');
  if (fs.existsSync(envPath) && fs.lstatSync(envPath).isSymbolicLink()) throw new Error('.env.local không được là symbolic link.');
  const before = fs.existsSync(envPath) ? fs.readFileSync(envPath,'utf8') : '';
  const backup = path.join(projectRoot,'.local/maintenance-2026-10-19/env-before-runtime-role.env');
  fs.mkdirSync(path.dirname(backup), { recursive: true, mode: 0o700 });
  if (!fs.existsSync(backup)) fs.writeFileSync(backup,before,{mode:0o600});
  const pool=createPool(ownerUrl);
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    const existing=(await client.query('SELECT rolname FROM pg_roles WHERE rolname=$1',[role])).rowCount;
    const current = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
    if(existing && current?.username !== role) throw new Error('Role minhlab_app đã tồn tại nhưng chưa thuộc cấu hình app này; không tự thay mật khẩu.');
    if(!existing) await client.query('CREATE ROLE minhlab_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS');
    const password=randomBytes(32).toString('base64url');
    const statement=(await client.query("SELECT format('ALTER ROLE %I LOGIN PASSWORD %L', $1::text, $2::text) AS sql",[role,password])).rows[0].sql;
    await client.query(statement);
    await require('../lib/grant-runtime.cjs').grantRuntimePrivileges(client);
    await client.query('COMMIT');
    const runtimeUrl=new URL(ownerUrl);runtimeUrl.username=role;runtimeUrl.password=password;
    let after=before;
    for(const [key,value] of [['DATABASE_URL',runtimeUrl.toString()],['MIGRATION_DATABASE_URL',ownerUrl]]){
      const pattern=new RegExp(`^${key}=.*$`,'m');after=pattern.test(after)?after.replace(pattern,`${key}=${value}`):after+`\n${key}=${value}\n`;
    }
    fs.writeFileSync(envPath,after,{mode:0o600});fs.chmodSync(envPath,0o600);
    process.stdout.write('Đã tạo role runtime hạn quyền và cập nhật .env.local; credential không được in ra. Khởi động lại Next.js để dùng pool mới.\n');
  } catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();await pool.end();}
}
main().catch(error=>{process.stderr.write(`${error.message}\n`);process.exitCode=1;});

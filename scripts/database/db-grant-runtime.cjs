const {createPool}=require('../lib/database.cjs');
const {grantRuntimePrivileges}=require('../lib/grant-runtime.cjs');
async function main(){
  if(!process.env.MIGRATION_DATABASE_URL)throw new Error('MIGRATION_DATABASE_URL is required; runtime credentials are never promoted.');
  const pool=createPool(process.env.MIGRATION_DATABASE_URL);
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    await grantRuntimePrivileges(client);
    await client.query('COMMIT');
    process.stdout.write('Runtime grants applied; passwords were not changed.\n');
  } catch(error){await client.query('ROLLBACK');throw error;}
  finally {client.release();await pool.end();}
}
main().catch(()=>{process.stderr.write('Could not apply runtime grants. Check schema owner and migrations.\n');process.exitCode=1;});

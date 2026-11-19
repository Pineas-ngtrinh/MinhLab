const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { authPasswords, authTokens } = require('../../src/integrations/auth/credentials.ts');

const INVALID_RESET = 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.';
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

module.exports = async function testAuthResetPostgres({ check, pool, authService }) {
  const initialPassword = 'Sec01a-fixture-password-2026';
  const initialPasswordHash = await authPasswords.hash(initialPassword);
  const email = `sec01a-${randomUUID()}@example.test`;
  const user = (await pool.query(`
    INSERT INTO users(email,email_normalized,password_hash,full_name,status,email_verified_at)
    VALUES($1,$1,$2,'SEC-01A PostgreSQL fixture','ACTIVE',clock_timestamp())
    RETURNING id`, [email, initialPasswordHash])).rows[0];
  assert(user?.id, 'SEC-01A fixture user was not created');
  const role = await pool.query(`
    INSERT INTO user_roles(user_id,role_id)
    SELECT $1,id FROM roles WHERE code='CUSTOMER'`, [user.id]);
  assert.equal(role.rowCount, 1, 'SEC-01A fixture customer role was not created');

  async function createToken({ expired = false, lifetimeSeconds = 60 } = {}) {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = authTokens.hash(token);
    if (expired) {
      await pool.query(`
        INSERT INTO account_tokens(user_id,purpose,token_hash,created_at,expires_at)
        VALUES($1,'PASSWORD_RESET',$2,clock_timestamp()-interval '2 hours',clock_timestamp()-interval '1 hour')`,
      [user.id, tokenHash]);
    } else {
      await pool.query(`
        INSERT INTO account_tokens(user_id,purpose,token_hash,expires_at)
        VALUES($1,'PASSWORD_RESET',$2,clock_timestamp()+($3::integer*interval '1 second'))`,
      [user.id, tokenHash, lifetimeSeconds]);
    }
    return { token, tokenHash };
  }

  async function state(tokenHash, sessionTokenHash) {
    const [account, token, session] = await Promise.all([
      pool.query('SELECT password_hash FROM users WHERE id=$1', [user.id]),
      pool.query('SELECT used_at FROM account_tokens WHERE token_hash=$1', [tokenHash]),
      pool.query('SELECT revoked_at FROM auth_sessions WHERE refresh_token_hash=$1', [sessionTokenHash]),
    ]);
    return {
      passwordHash: account.rows[0]?.password_hash,
      usedAt: token.rows[0]?.used_at ?? null,
      revokedAt: session.rows[0]?.revoked_at ?? null,
    };
  }

  function isInvalidReset(error) {
    return error instanceof Error && error.message === INVALID_RESET && error.status === 400;
  }

  await check('PostgreSQL rejects an expired reset token without changing password or sessions', async () => {
    const [{ token, tokenHash }, sessionToken] = await Promise.all([
      createToken({ expired: true }),
      authService.createSession({ id: user.id }),
    ]);
    const sessionTokenHash = authTokens.hash(sessionToken);
    const before = await state(tokenHash, sessionTokenHash);
    await assert.rejects(authService.resetPassword(token, 'New-sec01a-password-2026'), isInvalidReset);
    assert.deepEqual(await state(tokenHash, sessionTokenHash), before);
    assert.ok(await authService.readSession(sessionToken));
  });

  await check('PostgreSQL rolls password, token and session changes back together', async () => {
    const [{ token, tokenHash }, sessionToken] = await Promise.all([
      createToken(),
      authService.createSession({ id: user.id }),
    ]);
    const sessionTokenHash = authTokens.hash(sessionToken);
    const before = await state(tokenHash, sessionTokenHash);
    await pool.query(`
      CREATE FUNCTION test_fail_sec01a_session_revoke() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL THEN
          RAISE EXCEPTION 'SEC01A_FIXTURE_REVOKE_FAILURE';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER test_fail_sec01a_session_revoke
      BEFORE UPDATE ON auth_sessions FOR EACH ROW
      EXECUTE FUNCTION test_fail_sec01a_session_revoke()`);
    try {
      await assert.rejects(authService.resetPassword(token, 'New-sec01a-password-2026'));
    } finally {
      await pool.query('DROP TRIGGER test_fail_sec01a_session_revoke ON auth_sessions');
      await pool.query('DROP FUNCTION test_fail_sec01a_session_revoke()');
    }
    assert.deepEqual(await state(tokenHash, sessionTokenHash), before);
    assert.ok(await authService.readSession(sessionToken));
  });

  await check('PostgreSQL rejects a token that expires while reset waits for its row lock', async () => {
    const [{ token, tokenHash }, sessionToken] = await Promise.all([
      createToken({ lifetimeSeconds: 5 }),
      authService.createSession({ id: user.id }),
    ]);
    const sessionTokenHash = authTokens.hash(sessionToken);
    const before = await state(tokenHash, sessionTokenHash);
    const lockClient = await pool.connect();
    let transactionOpen = false;
    let resetPromise;
    try {
      await lockClient.query('BEGIN');
      transactionOpen = true;
      await lockClient.query('SELECT id FROM account_tokens WHERE token_hash=$1 FOR UPDATE', [tokenHash]);
      await lockClient.query(
        "UPDATE account_tokens SET expires_at=clock_timestamp()+interval '5 seconds' WHERE token_hash=$1",
        [tokenHash],
      );

      resetPromise = authService.resetPassword(token, 'New-sec01a-password-2026');
      const databaseName = new URL(process.env.DATABASE_URL).pathname.slice(1);
      const deadline = Date.now() + 2000;
      let waitingForRowLock = false;
      while (Date.now() < deadline) {
        const activity = await pool.query(`
          SELECT count(*)::integer AS waiting FROM pg_stat_activity
          WHERE datname=$1 AND state='active' AND wait_event_type='Lock'
            AND query LIKE '%FOR UPDATE OF t,u%'`, [databaseName]);
        if (activity.rows[0]?.waiting > 0) {
          waitingForRowLock = true;
          break;
        }
        await delay(20);
      }
      assert.equal(waitingForRowLock, true, 'Reset request did not reach the PostgreSQL row-lock wait');

      const remaining = await lockClient.query(`
        SELECT GREATEST(0,EXTRACT(EPOCH FROM expires_at-clock_timestamp())) AS seconds
        FROM account_tokens WHERE token_hash=$1`, [tokenHash]);
      await lockClient.query('SELECT pg_sleep($1::double precision)', [Number(remaining.rows[0].seconds) + 0.2]);
      await lockClient.query('COMMIT');
      transactionOpen = false;

      await assert.rejects(resetPromise, isInvalidReset);
      assert.deepEqual(await state(tokenHash, sessionTokenHash), before);
      assert.ok(await authService.readSession(sessionToken));
    } finally {
      if (transactionOpen) await lockClient.query('ROLLBACK').catch(() => {});
      if (resetPromise) await resetPromise.catch(() => {});
      lockClient.release();
    }
  });

  await check('two PostgreSQL connections cannot consume the same reset token twice', async () => {
    const [{ token, tokenHash }, sessionToken] = await Promise.all([
      createToken(),
      authService.createSession({ id: user.id }),
    ]);
    const sessionTokenHash = authTokens.hash(sessionToken);
    const attempts = await Promise.allSettled([
      authService.resetPassword(token, 'First-sec01a-password-2026'),
      authService.resetPassword(token, 'Second-sec01a-password-2026'),
    ]);
    assert.equal(attempts.filter((attempt) => attempt.status === 'fulfilled').length, 1);
    const rejected = attempts.filter((attempt) => attempt.status === 'rejected');
    assert.equal(rejected.length, 1);
    assert.ok(isInvalidReset(rejected[0].reason));

    const final = await state(tokenHash, sessionTokenHash);
    assert.ok(final.usedAt);
    assert.ok(final.revokedAt);
    assert.notEqual(final.passwordHash, initialPasswordHash);
    const matchesFirst = await authPasswords.verify('First-sec01a-password-2026', final.passwordHash);
    const matchesSecond = await authPasswords.verify('Second-sec01a-password-2026', final.passwordHash);
    assert.notEqual(matchesFirst, matchesSecond);
    assert.equal(await authService.readSession(sessionToken), null);
  });
};

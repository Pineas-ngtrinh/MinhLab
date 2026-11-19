const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');

function runWorker(mailStatus, telegramStatus) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'minhlab-worker-test-'));
  try {
    fs.mkdirSync(path.join(root, 'deploy'));
    fs.mkdirSync(path.join(root, 'bin'));
    const source = fs.readFileSync(path.join(__dirname, '../../deploy/worker.sh'), 'utf8');
    assert(source.includes('/var/lock/minhlab-maintenance.lock'));
    fs.writeFileSync(path.join(root, 'deploy/worker.sh'), source.replace('/var/lock/minhlab-maintenance.lock', path.join(root, 'test.lock')));
    fs.writeFileSync(path.join(root, 'bin/flock'), '#!/bin/sh\nexit 0\n', {mode: 0o700});
    fs.writeFileSync(path.join(root, 'bin/docker'), `#!/bin/bash
for command in "$@"; do
  case "$command" in
    mail:deliver) printf '%s\\n' "$command" >> "$MINHLAB_WORKER_TEST_LOG"; exit "$MINHLAB_WORKER_TEST_MAIL_STATUS" ;;
    telegram:deliver) printf '%s\\n' "$command" >> "$MINHLAB_WORKER_TEST_LOG"; exit "$MINHLAB_WORKER_TEST_TELEGRAM_STATUS" ;;
  esac
done
exit 99
`, {mode: 0o700});
    const log = path.join(root, 'calls.log');
    const result = spawnSync('bash', [path.join(root, 'deploy/worker.sh'), 'notifications'], {
      encoding: 'utf8', env: {...process.env, PATH: path.join(root, 'bin')+path.delimiter+process.env.PATH,
        MINHLAB_WORKER_TEST_LOG: log, MINHLAB_WORKER_TEST_MAIL_STATUS: String(mailStatus),
        MINHLAB_WORKER_TEST_TELEGRAM_STATUS: String(telegramStatus)},
    });
    assert.ifError(result.error);
    return {status: result.status, calls: fs.readFileSync(log, 'utf8').trim().split('\n')};
  } finally {fs.rmSync(root, {recursive: true, force: true});}
}

test('failed mail delivery cannot prevent Telegram delivery', () => {
  const result = runWorker(1, 0);
  assert.deepEqual(result.calls, ['telegram:deliver', 'mail:deliver']);
  assert.equal(result.status, 1);
});

test('failed Telegram delivery is reported after mail succeeds', () => {
  const result = runWorker(0, 1);
  assert.deepEqual(result.calls, ['telegram:deliver', 'mail:deliver']);
  assert.equal(result.status, 1);
});

test('notification worker succeeds only when both channels succeed', () => {
  assert.equal(runWorker(0, 0).status, 0);
  const result = runWorker(1, 1);
  assert.deepEqual(result.calls, ['telegram:deliver', 'mail:deliver']);
  assert.equal(result.status, 1);
});

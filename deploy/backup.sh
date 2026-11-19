#!/bin/bash
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
: "${MINHLAB_BACKUP_DIR:?Set destination outside the release directory}"
: "${MINHLAB_BACKUP_RECIPIENTS_FILE:?Set an age public recipients file outside the release directory}"
test -r "$MINHLAB_BACKUP_RECIPIENTS_FILE"
command -v age >/dev/null
exec 9>/var/lock/minhlab-maintenance.lock
flock -n 9 || { echo 'Another maintenance task is running.' >&2; exit 1; }
compose=(docker compose --env-file deploy/.env.compose -f compose.yaml)
mkdir -p "$MINHLAB_BACKUP_DIR"
work=$(mktemp -d)
restart_web=0
cleanup() {
  local result=$?
  if [[ "$restart_web" == 1 ]]; then "${compose[@]}" start web >/dev/null || result=1; fi
  rm -rf "$work"
  exit "$result"
}
trap cleanup EXIT
# All writes enter through web or workers sharing the maintenance lock.
if [[ -n "$("${compose[@]}" ps --status running -q web)" ]]; then
  restart_web=1
  "${compose[@]}" stop web
fi
"${compose[@]}" exec -T db pg_dump -U minhlab_owner -d minhlab --format=custom > "$work/database.dump"
"${compose[@]}" run --rm --no-deps -T web tar -C /var/lib/minhlab/private-files -cf - . > "$work/private-files.tar"
output="$MINHLAB_BACKUP_DIR/minhlab-$(date -u +%Y%m%dT%H%M%SZ).tar.age"
tar -C "$work" -cf - database.dump private-files.tar |
  age --encrypt --recipients-file "$MINHLAB_BACKUP_RECIPIENTS_FILE" --output "$output.partial"
mv "$output.partial" "$output"
echo 'Encrypted database/private-file backup created. Copy off-host and verify restore separately.'
# Never prune backups without a separately approved retention policy.

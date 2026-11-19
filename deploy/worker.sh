#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
exec 9>/var/lock/minhlab-maintenance.lock
flock -n 9 || exit 0
compose=(docker compose --env-file deploy/.env.compose -f compose.yaml)
case "${1:-}" in
  files) "${compose[@]}" exec -T web npm run files:process
         "${compose[@]}" exec -T web npm run files:expire-requests ;;
  preview) "${compose[@]}" exec -T web npm run files:cleanup ;;
  cleanup) test -f deploy/.cleanup-enabled || { echo 'Cleanup apply is not enabled.' >&2; exit 1; }
           "${compose[@]}" exec -T web npm run files:cleanup -- --apply ;;
  notifications) status=0
                 "${compose[@]}" exec -T web npm run telegram:deliver || status=1
                 "${compose[@]}" exec -T web npm run mail:deliver || status=1
                 exit "$status" ;;
  signatures) "${compose[@]}" exec -T --user clamav web freshclam --stdout ;;
  *) echo 'Usage: worker.sh files|preview|cleanup|notifications|signatures' >&2; exit 2 ;;
esac

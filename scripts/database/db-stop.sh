#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DATA_DIR="$PROJECT_ROOT/.local/postgres"
PG_CTL="$(command -v pg_ctl || true)"
if [[ -z "$PG_CTL" && -x /opt/homebrew/opt/postgresql@18/bin/pg_ctl ]]; then
  PG_CTL=/opt/homebrew/opt/postgresql@18/bin/pg_ctl
fi
if [[ -z "$PG_CTL" ]]; then
  echo "Không tìm thấy pg_ctl." >&2
  exit 1
fi
"$PG_CTL" -D "$DATA_DIR" -m fast -w stop

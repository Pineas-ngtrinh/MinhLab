#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DATA_DIR="$PROJECT_ROOT/.local/postgres"
PG_CTL="$(command -v pg_ctl || true)"
PSQL="$(command -v psql || true)"
if [[ -z "$PG_CTL" && -x /opt/homebrew/opt/postgresql@18/bin/pg_ctl ]]; then
  PG_CTL=/opt/homebrew/opt/postgresql@18/bin/pg_ctl
  PSQL=/opt/homebrew/opt/postgresql@18/bin/psql
fi
if [[ -z "$PG_CTL" || -z "$PSQL" ]]; then
  echo "Không tìm thấy công cụ PostgreSQL (pg_ctl/psql)." >&2
  exit 1
fi
"$PSQL" -h 127.0.0.1 -p 5433 -U minhlab_dev -d minhlab -c \
  "SELECT current_database() AS database, count(*) AS table_count FROM information_schema.tables WHERE table_schema = 'public'"

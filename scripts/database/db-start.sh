#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DATA_DIR="$PROJECT_ROOT/.local/postgres"
LOG_FILE="$PROJECT_ROOT/.local/postgres.log"

find_pg_bin() {
  if command -v pg_ctl >/dev/null 2>&1; then
    dirname "$(command -v pg_ctl)"
    return
  fi
  for candidate in \
    /opt/homebrew/opt/postgresql@18/bin \
    /opt/homebrew/opt/postgresql@17/bin \
    /opt/homebrew/opt/postgresql@16/bin \
    /usr/local/opt/postgresql@18/bin \
    /usr/local/opt/postgresql@17/bin \
    /usr/local/opt/postgresql@16/bin
  do
    if [[ -x "$candidate/pg_ctl" ]]; then
      printf '%s\n' "$candidate"
      return
    fi
  done
  if command -v brew >/dev/null 2>&1; then
    local prefix
    prefix="$(brew --prefix postgresql@18 2>/dev/null || true)"
    if [[ -x "$prefix/bin/pg_ctl" ]]; then
      printf '%s\n' "$prefix/bin"
      return
    fi
  fi
  return 1
}

PG_BIN="$(find_pg_bin)" || {
  echo "Không tìm thấy pg_ctl. Cài PostgreSQL 16+ trước rồi thử lại." >&2
  exit 1
}
mkdir -p "$PROJECT_ROOT/.local"

if [[ ! -f "$DATA_DIR/PG_VERSION" ]]; then
  if [[ -e "$DATA_DIR" ]]; then
    echo "Thư mục $DATA_DIR chưa phải PostgreSQL data directory; giữ nguyên để tránh ghi đè." >&2
    exit 1
  fi
  "$PG_BIN/initdb" -D "$DATA_DIR" -U minhlab_dev --auth-local=trust --auth-host=trust --encoding=UTF8
fi

if ! "$PG_BIN/pg_isready" -h 127.0.0.1 -p 5433 >/dev/null 2>&1; then
  "$PG_BIN/pg_ctl" -D "$DATA_DIR" -l "$LOG_FILE" -o "-p 5433 -h 127.0.0.1" -w start
fi

SERVER_DATA_DIR="$("$PG_BIN/psql" -h 127.0.0.1 -p 5433 -U minhlab_dev -d postgres -Atqc 'SHOW data_directory')"
if [[ "$SERVER_DATA_DIR" != "$DATA_DIR" ]]; then
  echo "Cổng 5433 đang thuộc PostgreSQL khác: $SERVER_DATA_DIR. Không tự sửa database đó." >&2
  exit 1
fi

if ! "$PG_BIN/psql" -h 127.0.0.1 -p 5433 -U minhlab_dev -d postgres -Atqc \
  "SELECT 1 FROM pg_database WHERE datname = 'minhlab'" | grep -q 1; then
  "$PG_BIN/createdb" -h 127.0.0.1 -p 5433 -U minhlab_dev minhlab
fi

if [[ -f "$PROJECT_ROOT/.env.local" ]]; then
  if ! grep -q '^DATABASE_URL=' "$PROJECT_ROOT/.env.local"; then
    printf '\nDATABASE_URL=postgresql://minhlab_dev@127.0.0.1:5433/minhlab\n' >> "$PROJECT_ROOT/.env.local"
  fi
else
  printf 'DATABASE_URL=postgresql://minhlab_dev@127.0.0.1:5433/minhlab\n' > "$PROJECT_ROOT/.env.local"
fi

DATABASE_URL=postgresql://minhlab_dev@127.0.0.1:5433/minhlab MIGRATION_DATABASE_URL=postgresql://minhlab_dev@127.0.0.1:5433/minhlab node "$PROJECT_ROOT/scripts/database/db-migrate.cjs"
DATABASE_URL=postgresql://minhlab_dev@127.0.0.1:5433/minhlab MIGRATION_DATABASE_URL=postgresql://minhlab_dev@127.0.0.1:5433/minhlab node "$PROJECT_ROOT/scripts/database/db-seed-catalog.cjs"

echo "PostgreSQL sẵn sàng tại 127.0.0.1:5433/minhlab"
echo "Ứng dụng Next.js đọc DATABASE_URL từ $PROJECT_ROOT/.env.local"

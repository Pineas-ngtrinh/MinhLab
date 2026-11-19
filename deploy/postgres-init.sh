#!/bin/sh
set -eu
# Only invoked by the official image on an empty data volume; existing passwords are never rotated.
case "$MINHLAB_DB_APP_PASSWORD" in ''|*[!0-9a-fA-F]*) echo 'App password must be nonempty hex.' >&2; exit 1;; esac
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=app_password="$MINHLAB_DB_APP_PASSWORD" <<'SQL'
CREATE ROLE minhlab_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'app_password';
GRANT CONNECT ON DATABASE minhlab TO minhlab_app;
GRANT USAGE ON SCHEMA public TO minhlab_app;
SQL

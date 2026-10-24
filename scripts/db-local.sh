#!/usr/bin/env bash
# Sobe um Postgres local para os testes de integração e aplica as migrations do zero.
# Uso: npm run db:local   → depois: DATABASE_URL=postgres://lab:lab@localhost:5432/lab_teste npm test
set -euo pipefail
cd "$(dirname "$0")/.."
if command -v pg_ctlcluster >/dev/null; then
  pg_ctlcluster 16 main start 2>/dev/null || true
fi
SU="su postgres -c"
$SU "psql -qtAc \"select 1 from pg_roles where rolname='lab'\"" | grep -q 1 || $SU "psql -qc \"create role lab login password 'lab' superuser\""
$SU "psql -qc 'drop database if exists lab_teste'"
$SU "psql -qc 'create database lab_teste owner lab'"
for f in supabase/migrations/*.sql; do
  PGPASSWORD=lab psql -q -v ON_ERROR_STOP=1 -h localhost -U lab -d lab_teste -f "$f"
  echo "aplicada: $f"
done
echo "pronto: DATABASE_URL=postgres://lab:lab@localhost:5432/lab_teste"

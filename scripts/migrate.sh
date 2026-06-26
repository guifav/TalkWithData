#!/bin/sh
# Prisma migration script for Cloud Build.
# Detects database state and resolves baselines for legacy db-push databases
# before running prisma migrate deploy.
set -e

apk add --no-cache postgresql-client >/dev/null 2>&1
npm ci --ignore-scripts
npx prisma generate

echo "--- Detecting database state for migration strategy ---"

HAS_MIGRATIONS=$(psql "$DATABASE_URL" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_name='_prisma_migrations'" 2>/dev/null || echo "0")

if [ "$HAS_MIGRATIONS" -gt 0 ] 2>/dev/null; then
  echo "Migrations table exists, running deploy directly"
else
  HAS_FIELDS=$(psql "$DATABASE_URL" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_name='DashboardFieldSchema'" 2>/dev/null || echo "0")
  if [ "$HAS_FIELDS" -gt 0 ] 2>/dev/null; then
    echo "Legacy db-push schema detected, resolving baseline..."
    npx prisma migrate resolve --applied 0_baseline
    HAS_APPDB=$(psql "$DATABASE_URL" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_name='AppDbInstance'" 2>/dev/null || echo "0")
    if [ "$HAS_APPDB" -gt 0 ] 2>/dev/null; then
      echo "AppDb tables also exist, resolving 1_app_db..."
      npx prisma migrate resolve --applied 1_app_db
    fi
  else
    echo "Fresh database, no resolve needed"
  fi
fi

npx prisma migrate deploy
echo "--- Migration complete ---"

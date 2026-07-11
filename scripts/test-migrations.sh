#!/bin/sh
# Verify the checked-in Prisma migration history against a fresh PostgreSQL database.
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is required for migration verification" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required for migration verification" >&2
  exit 1
fi

applied_migration_count() {
  psql "$DATABASE_URL" --no-password --no-psqlrc --tuples-only --no-align \
    --set ON_ERROR_STOP=1 \
    --command 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL'
}

echo "Applying checked-in migrations to the empty database"
npm run db:migrate

echo "Querying the expected schema"
psql "$DATABASE_URL" --no-password --no-psqlrc --set ON_ERROR_STOP=1 <<'SQL'
SELECT "id", "dashboardId" FROM "DashboardFieldSchema" LIMIT 0;
SELECT "id", "fieldId" FROM "DashboardFieldValue" LIMIT 0;
SELECT "id", "dashboardId" FROM "DashboardFieldAudit" LIMIT 0;
SELECT "id", "dashboardId" FROM "AppDbInstance" LIMIT 0;
SELECT "id", "instanceId" FROM "AppDbTable" LIMIT 0;
SELECT "id", "instanceId" FROM "AppDbMigration" LIMIT 0;
SELECT "id", "instanceId" FROM "AppDbAudit" LIMIT 0;
SQL

before_second_deploy=$(applied_migration_count)

echo "Re-running migrations to verify idempotency"
npm run db:migrate

after_second_deploy=$(applied_migration_count)
if [ "$before_second_deploy" != "$after_second_deploy" ]; then
  echo "Migration verification failed: the second deploy changed the applied migration count" >&2
  exit 1
fi

echo "Migration history is deployable, queryable, and idempotent"

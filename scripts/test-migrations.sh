#!/bin/sh
# Verify the checked-in Prisma migration history against a fresh PostgreSQL database.
set -eu

correlation_id="migration-$(date -u +%s)-$$"
stage="preflight"

configured_log_level="$(printf '%s' "${TWD_LOG_LEVEL:-info}" | tr '[:upper:]' '[:lower:]')"
case "$configured_log_level" in
  info|warn|error) ;;
  *) configured_log_level="info" ;;
esac

should_log() {
  case "$configured_log_level:$1" in
    info:*|warn:warn|warn:error|error:error) return 0 ;;
    *) return 1 ;;
  esac
}

log_event() {
  level="$1"
  event="$2"
  outcome="$3"
  event_stage="$4"
  should_log "$level" || return 0
  timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  printf '{"timestamp":"%s","level":"%s","event":"%s","correlationId":"%s","outcome":"%s","operation":"verify_migrations","stage":"%s"}\n' \
    "$timestamp" "$level" "$event" "$correlation_id" "$outcome" "$event_stage"
}

on_exit() {
  status="$?"
  if [ "$status" -ne 0 ]; then
    log_event "error" "migration.verification.failed" "failed" "$stage" >&2
  fi
}

trap on_exit EXIT
log_event "info" "migration.verification.started" "started" "$stage"

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

stage="initial_deploy"
npm run db:migrate

stage="schema_probe"
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

stage="idempotency_deploy"
npm run db:migrate

after_second_deploy=$(applied_migration_count)
if [ "$before_second_deploy" != "$after_second_deploy" ]; then
  echo "Migration verification failed: the second deploy changed the applied migration count" >&2
  exit 1
fi

stage="complete"
log_event "info" "migration.verification.succeeded" "succeeded" "$stage"

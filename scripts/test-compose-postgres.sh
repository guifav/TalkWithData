#!/bin/sh
# Verify PostgreSQL startup, one-shot migrations, persistence, and failure gating.
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
COMPOSE_FILE="$ROOT/docker-compose.yml"
PROJECT="twd-compose-smoke-$$"
TMP_DIR=$(mktemp -d)
ENV_FILE="$TMP_DIR/app.env"
FAIL_OVERRIDE="$TMP_DIR/fail-migration.yml"
DB_USER=talkwithdata
DB_PASSWORD=talkwithdata
DB_NAME=talkwithdata
INTERNAL_DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@db:5432/$DB_NAME"

compose() {
  POSTGRES_USER="$DB_USER" POSTGRES_PASSWORD="$DB_PASSWORD" \
    POSTGRES_DB="$DB_NAME" COMPOSE_DATABASE_URL="$INTERNAL_DATABASE_URL" \
    TWD_APP_PORT=0 TWD_ENV_FILE="$ENV_FILE" \
    docker compose --project-name "$PROJECT" --file "$COMPOSE_FILE" "$@"
}

compose_with_failure() {
  POSTGRES_USER="$DB_USER" POSTGRES_PASSWORD="$DB_PASSWORD" \
    POSTGRES_DB="$DB_NAME" COMPOSE_DATABASE_URL="$INTERNAL_DATABASE_URL" \
    TWD_APP_PORT=0 TWD_ENV_FILE="$ENV_FILE" \
    docker compose --project-name "$PROJECT" \
      --file "$COMPOSE_FILE" --file "$FAIL_OVERRIDE" "$@"
}

cleanup() {
  compose_with_failure down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT INT TERM

umask 077
cat >"$ENV_FILE" <<'EOF'
NEXT_PUBLIC_ALLOWED_AUTH_DOMAIN=compose.example
NEXT_PUBLIC_FIREBASE_API_KEY=compose-public-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=compose.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=compose-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=compose-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:compose
ALLOWED_AUTH_DOMAIN=compose.example
FIREBASE_PROJECT_ID=compose-project
STORAGE_BUCKET_NAME=compose-project.appspot.com
DATABASE_URL=postgresql://ignored:ignored@host.invalid:5432/ignored
DASHBOARD_SESSION_SECRET=compose-session-secret-with-at-least-32-bytes
ANTHROPIC_API_KEY=compose-provider-placeholder
APP_URL=http://localhost:3000
STORAGE_PROVIDER=gcs
EOF

cat >"$FAIL_OVERRIDE" <<'EOF'
services:
  migrate:
    command:
      - sh
      - -c
      - echo 'Intentional migration failure for Compose smoke test' >&2; exit 42
EOF

services=$(compose config --services)
for required_service in db migrate app; do
  if ! printf '%s\n' "$services" | grep -qx "$required_service"; then
    echo "Compose service is missing: $required_service" >&2
    exit 1
  fi
done

expected_migrations=$(find "$ROOT/app/prisma/migrations" \
  -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')

echo "Starting Compose from an empty PostgreSQL volume"
compose down --volumes --remove-orphans >/dev/null 2>&1 || true
compose up --build --wait --wait-timeout 240

app_address=$(compose port app 8080 | tail -n 1)
curl --fail --silent --show-error "http://$app_address/api/health" >/dev/null

migrations_before=$(compose exec -T db \
  psql -U "$DB_USER" -d "$DB_NAME" --tuples-only --no-align \
    --set ON_ERROR_STOP=1 \
    --command 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')

if [ "$migrations_before" != "$expected_migrations" ]; then
  echo "Expected $expected_migrations applied migrations, found $migrations_before" >&2
  exit 1
fi

compose exec -T db \
  psql -U "$DB_USER" -d "$DB_NAME" --set ON_ERROR_STOP=1 \
    --command 'CREATE TABLE IF NOT EXISTS compose_smoke_sentinel (id integer PRIMARY KEY); INSERT INTO compose_smoke_sentinel (id) VALUES (1) ON CONFLICT (id) DO NOTHING;' \
    >/dev/null

echo "Restarting the same Compose project without deleting its volumes"
compose stop >/dev/null
compose up --wait --wait-timeout 240

migrations_after=$(compose exec -T db \
  psql -U "$DB_USER" -d "$DB_NAME" --tuples-only --no-align \
    --set ON_ERROR_STOP=1 \
    --command 'SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL')
sentinel_count=$(compose exec -T db \
  psql -U "$DB_USER" -d "$DB_NAME" --tuples-only --no-align \
    --set ON_ERROR_STOP=1 \
    --command 'SELECT count(*) FROM compose_smoke_sentinel WHERE id = 1')
migration_runs=$(compose logs migrate | grep -c '^migrate-.*TWD migration run$' || true)

if [ "$migrations_after" != "$migrations_before" ]; then
  echo "The second startup changed the applied migration count" >&2
  exit 1
fi
if [ "$sentinel_count" != "1" ]; then
  echo "The second startup did not preserve the sentinel row" >&2
  exit 1
fi
if [ "$migration_runs" != "2" ]; then
  echo "Expected one migration run per startup, found $migration_runs runs" >&2
  exit 1
fi

echo "Verifying that a failed migration prevents application startup"
compose stop >/dev/null
if compose_with_failure up --wait --wait-timeout 60; then
  echo "Compose unexpectedly succeeded with a failing migration" >&2
  exit 1
fi

app_container=$(compose_with_failure ps --all --quiet app)
if [ -n "$app_container" ] && [ "$(docker inspect --format '{{.State.Running}}' "$app_container")" = "true" ]; then
  echo "The application started even though migration failed" >&2
  exit 1
fi

migrate_container=$(compose_with_failure ps --all --quiet migrate)
if [ -z "$migrate_container" ]; then
  echo "The failed migration container was not created" >&2
  exit 1
fi
if [ "$(docker inspect --format '{{.State.ExitCode}}' "$migrate_container")" != "42" ]; then
  echo "The migration container did not preserve the expected failure" >&2
  exit 1
fi

echo "Compose PostgreSQL startup, idempotency, persistence, and failure gating passed"

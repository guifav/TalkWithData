#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
APP_DIR="$ROOT_DIR/app"

TWD_E2E_NPM_SCRIPT="${TWD_E2E_NPM_SCRIPT:-test:e2e:run}"
case "$TWD_E2E_NPM_SCRIPT" in
  test:e2e:run|test:e2e:screenshots) ;;
  *)
    echo "Unsupported E2E npm script: $TWD_E2E_NPM_SCRIPT" >&2
    exit 2
    ;;
esac

# The isolated runner must not inherit credentials or outbound integrations
# from the caller's shell. Every dependency used below is local or emulated.
unset SA_KEY_JSON GOOGLE_APPLICATION_CREDENTIALS
unset THUMBNAIL_FUNCTION_URL THUMBNAIL_SECRET
unset MCP_URL MCP_API_KEY MCP_ALLOWED_HOSTS
unset ANTHROPIC_API_KEY OPENAI_API_KEY GOOGLE_AI_API_KEY KIMI_API_KEY GLM_API_KEY

node --test "$APP_DIR/e2e/support/artifact-redaction.node.mjs"

if [ -z "${CI:-}" ]; then
  cleanup() {
    docker compose -p talkwithdata-e2e -f "$ROOT_DIR/docker-compose.e2e.yml" down -v >/dev/null 2>&1 || true
  }
  trap cleanup EXIT INT TERM
  export TWD_E2E_POSTGRES_PORT="${TWD_E2E_POSTGRES_PORT:-55556}"
  docker compose -p talkwithdata-e2e -f "$ROOT_DIR/docker-compose.e2e.yml" up -d --wait postgres
  export DATABASE_URL="postgresql://talkwithdata:talkwithdata@127.0.0.1:${TWD_E2E_POSTGRES_PORT}/talkwithdata"
fi

export FIREBASE_PROJECT_ID="demo-talkwithdata"
export NEXT_PUBLIC_FIREBASE_API_KEY="demo-api-key"
export NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="demo-talkwithdata.firebaseapp.com"
export NEXT_PUBLIC_FIREBASE_PROJECT_ID="demo-talkwithdata"
export NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="demo-talkwithdata.appspot.com"
export NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="123456789012"
export NEXT_PUBLIC_FIREBASE_APP_ID="1:123456789012:web:e2e"
export NEXT_PUBLIC_ALLOWED_AUTH_DOMAIN="example.com"
export NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"
export NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
export ALLOWED_AUTH_DOMAIN="example.com"
export STORAGE_PROVIDER="local"
export LOCAL_STORAGE_ROOT="$ROOT_DIR/.tmp/e2e/uploads"
export STORAGE_BUCKET_NAME="demo-dashboard-bucket"
export STORAGE_EMULATOR_HOST="http://127.0.0.1:4443"
export DATABASE_URL="${DATABASE_URL:-postgresql://talkwithdata:talkwithdata@127.0.0.1:5432/talkwithdata}"
export DASHBOARD_SESSION_SECRET="e2e-dashboard-session-secret-with-no-production-value"
export APP_URL="http://127.0.0.1:3100"
export TWD_CREDENTIAL_ENC_KEY="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="

rm -rf "$ROOT_DIR/.tmp/e2e"
mkdir -p "$LOCAL_STORAGE_ROOT"

cd "$APP_DIR"
npm run db:generate
npm run db:migrate
set +e
npx -y firebase-tools@15.23.0 emulators:exec \
  --config "$ROOT_DIR/firebase.json" \
  --project "$FIREBASE_PROJECT_ID" \
  --only auth,firestore \
  "npm run $TWD_E2E_NPM_SCRIPT"
test_status=$?
set -e

node "$APP_DIR/e2e/support/sanitize-artifacts.mjs"
exit "$test_status"

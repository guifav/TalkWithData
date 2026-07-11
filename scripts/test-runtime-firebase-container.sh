#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${TWD_RUNTIME_CONFIG_IMAGE:-talkwithdata-runtime-config-smoke}"
RUN_ID="$$"
TMP_DIR="$(mktemp -d)"
CONTAINERS=()
BUILD_ARGS=()

if [[ "${TWD_RUNTIME_CONFIG_NO_CACHE:-0}" == "1" ]]; then
  BUILD_ARGS+=(--no-cache)
fi

cleanup() {
  if [ "${#CONTAINERS[@]}" -gt 0 ]; then
    docker rm -f "${CONTAINERS[@]}" >/dev/null 2>&1 || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

write_env() {
  local file="$1"
  local suffix="$2"
  cat >"$file" <<EOF
ALLOWED_AUTH_DOMAIN=${suffix}.example.com
NEXT_PUBLIC_ALLOWED_AUTH_DOMAIN=${suffix}.example.com
NEXT_PUBLIC_FIREBASE_API_KEY=public-key-${suffix}
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${suffix}.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=runtime-project-${suffix}
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${suffix}.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:${suffix}
FIREBASE_PROJECT_ID=runtime-project-${suffix}
STORAGE_BUCKET_NAME=${suffix}-uploads
DATABASE_URL=postgresql://user:password@host.invalid:5432/talkwithdata
DASHBOARD_SESSION_SECRET=runtime-smoke-secret-${suffix}
ANTHROPIC_API_KEY=runtime-smoke-provider-${suffix}
EOF
}

wait_for_html() {
  local container="$1"
  local output="$2"
  local port
  port="$(docker port "$container" 8080/tcp | sed -E 's/.*:([0-9]+)$/\1/')"

  for _ in $(seq 1 60); do
    if curl --silent --fail "http://127.0.0.1:${port}/login" >"$output"; then
      return
    fi
    if [ "$(docker inspect --format '{{.State.Running}}' "$container")" != "true" ]; then
      docker logs "$container" >&2
      return 1
    fi
    sleep 1
  done

  echo "Container $container did not become ready" >&2
  docker logs "$container" >&2
  return 1
}

docker build "${BUILD_ARGS[@]}" -t "$IMAGE" \
  -f "$ROOT_DIR/app/Dockerfile" "$ROOT_DIR/app"

for suffix in one two; do
  env_file="$TMP_DIR/${suffix}.env"
  html_file="$TMP_DIR/${suffix}.html"
  container="twd-runtime-config-${suffix}-${RUN_ID}"
  write_env "$env_file" "$suffix"
  docker run --detach --name "$container" --env-file "$env_file" \
    --publish 127.0.0.1::8080 "$IMAGE" >/dev/null
  CONTAINERS+=("$container")
  wait_for_html "$container" "$html_file"
done

grep -Fq "runtime-project-one" "$TMP_DIR/one.html"
! grep -Fq "runtime-project-two" "$TMP_DIR/one.html"
grep -Fq "one.example.com" "$TMP_DIR/one.html"
! grep -Fq "two.example.com" "$TMP_DIR/one.html"
grep -Fq "runtime-project-two" "$TMP_DIR/two.html"
! grep -Fq "runtime-project-one" "$TMP_DIR/two.html"
grep -Fq "two.example.com" "$TMP_DIR/two.html"
! grep -Fq "one.example.com" "$TMP_DIR/two.html"
! grep -Fq "runtime-smoke-secret" "$TMP_DIR/one.html"
! grep -Fq "runtime-smoke-secret" "$TMP_DIR/two.html"
! grep -Fq "runtime-smoke-provider" "$TMP_DIR/one.html"
! grep -Fq "runtime-smoke-provider" "$TMP_DIR/two.html"

echo "One image served two distinct runtime Firebase configurations"

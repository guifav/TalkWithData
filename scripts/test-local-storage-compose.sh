#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.storage-smoke.yml"
PROJECT_NAME="twd-storage-smoke-${RANDOM}-$$"

cleanup() {
  docker compose --project-name "$PROJECT_NAME" --file "$COMPOSE_FILE" down --volumes --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

docker compose --project-name "$PROJECT_NAME" --file "$COMPOSE_FILE" build storage-smoke
docker compose --project-name "$PROJECT_NAME" --file "$COMPOSE_FILE" run --rm storage-smoke write
docker compose --project-name "$PROJECT_NAME" --file "$COMPOSE_FILE" run --rm storage-smoke read

echo "Local storage Docker Compose smoke passed"

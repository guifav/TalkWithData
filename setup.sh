#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$ROOT_DIR/app"
ENV_EXAMPLE="$APP_DIR/.env.example"
ENV_FILE="$APP_DIR/.env"

if [ ! -f "$ENV_FILE" ]; then
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  echo "Created app/.env from app/.env.example. Replace the placeholders before running the application."
else
  echo "app/.env already exists. Leaving it unchanged."
fi

node "$ROOT_DIR/scripts/check-env.mjs" "$ENV_FILE"

cd "$APP_DIR"
npm ci
npm run db:generate

echo "Setup complete. For Docker, run: docker compose up --build"
echo "For local dev, run: cd app && npm run dev"

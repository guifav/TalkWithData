#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$ROOT_DIR/app"

if [ ! -f "$ROOT_DIR/.env" ]; then
  cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
  echo "Created .env from .env.example. Update it with your Firebase, database, and AI settings."
else
  echo ".env already exists. Leaving it unchanged."
fi

cd "$APP_DIR"
npm install
npx prisma generate

echo "Setup complete. For Docker, run: docker compose up --build"
echo "For local dev, run: cd app && npm run dev"

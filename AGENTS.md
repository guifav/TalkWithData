# Talk With Data - Agent Guide

This file is the operational wrapper for AI agents working on this project.
For canonical rules (design system, code conventions), see CLAUDE.md.

## Quick Start

```bash
./setup.sh                   # Create and validate app/.env, install dependencies
cd app && npm run dev        # Start dev server (http://localhost:3000)
cd app && npm test           # Run tests (vitest)
cd app && npm run lint       # ESLint
cd app && npm run build      # Production build
```

## What NOT to Do

- Never commit `.env` files (they contain secrets)
- Never deploy before merge to main
- Never commit directly to main (always branch + PR)
- Never add emojis to UI or documentation
- Never use em-dash or en-dash in text (use comma, period, or parentheses)

## Branch Naming

- `feat/description` for features
- `fix/description` for bug fixes
- `refactor/description` for refactors
- `docs/description` for documentation

## Commit Convention

Use Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`

## Environment Setup

1. Copy `app/.env.example` to `app/.env`
2. Fill in Firebase config (create a Firebase project at https://console.firebase.google.com)
3. Set `ALLOWED_AUTH_DOMAIN` to your domain (e.g., `yourdomain.com`)
4. Choose dashboard storage: set `STORAGE_PROVIDER=gcs` with `STORAGE_BUCKET_NAME`, or `STORAGE_PROVIDER=local` with a persistent `LOCAL_STORAGE_ROOT`
5. Set `DATABASE_URL` to your PostgreSQL connection string. PostgreSQL is required, including for local development.
6. Set at least one AI provider API key

## Tech Stack

- Next.js 16 (App Router)
- React 19
- Firebase (Auth, Firestore, Storage)
- Prisma (per-dashboard databases)
- shadcn/ui (Neutral theme)
- Tailwind CSS 4
- TypeScript (strict)

## Project Structure

```
talkwithdata/
  app/              # Next.js application
    src/
      app/          # App Router pages and API routes
      components/   # React components
      hooks/        # Custom React hooks
      lib/          # Core libraries (firebase, ai, db, etc)
    prisma/         # Prisma schema
    public/         # Static assets
    .env.example    # Canonical environment variable template
  functions/        # Cloud Functions (thumbnail generation)
  scripts/          # Utility scripts
  CLAUDE.md         # Canonical rules (design system, conventions)
  AGENTS.md         # This file (operational guide)
```

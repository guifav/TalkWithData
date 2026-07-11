# Talk With Data - Project Rules

This file is the canonical source of rules for the Talk With Data project.
AGENTS.md is the operational wrapper; this file defines the design system and code conventions.

## Design System

### Theme
- shadcn/ui with Neutral theme (black, white, gray)
- Zero emojis in any UI or documentation
- Icons: black and white only (lucide-react). Text labels are preferred over icons.

### Typography
- Font: Inter
- Base text size: 10-11px
- Colors: black, white, gray. Color only in subtle details.

### Components
- Clean cards, subtle borders
- Buttons: black/white, no gradients
- Tables: zebra with black header

## Code Conventions

### Language and Style
- PT-BR for code comments and internal documentation
- EN for opensource-facing docs (README, CONTRIBUTING, ARCHITECTURE, DEPLOYMENT)
- No em-dash or en-dash in text. Use comma, period, or parentheses.
- Treatment: "voce" always (never "tu")

### TypeScript
- Strict mode is on
- Path alias `@/*` maps to `app/src/`
- Always use `@/lib/...`, `@/components/...` over relative paths
- Shared types go in dedicated type files; inline when local

### Firebase
- Admin init (`lib/firebase/admin.ts`) reads SA from credentials file if present (local dev), otherwise falls back to ADC
- Firestore writes always use server timestamps; reads convert to ISO strings on the way out
- Auth domain lock via `ALLOWED_AUTH_DOMAIN` env var (fail-closed if not set)

### Storage
- Dashboard storage is selected by `STORAGE_PROVIDER`: GCS uses `STORAGE_BUCKET_NAME`, while local storage uses persistent `LOCAL_STORAGE_ROOT`
- HTML files stored with version prefixes
- Max 10 versions per dashboard (FIFO cleanup)

### Prisma
- Used for per-dashboard app databases, NOT for the main app data (that is Firestore)
- Do not confuse the two

### UI
- shadcn/ui components in `components/ui/` - do not refactor them by hand
- No emojis in UI
- B&W icons only (lucide-react)
- Labels > icons when possible

## Critical Guardrails

- Domain lock enforced via Google OAuth `hd` param and Firebase Auth
- Embed tokens are 7-day auth-free tokens for external sharing. Validate token expiry and dashboard ownership
- `searchableText` field is populated server-side via cheerio HTML text extraction on upload. Do not skip this step
- Service account must match the Firebase project (not cross-project)

## Development Workflow

All code changes follow this flow. No exceptions.

1. Branch: `feat/xxx` or `fix/xxx` (never work on main)
2. Implement and commit (Conventional Commits)
3. Open PR on GitHub
4. Review and merge (never merge own PR without authorization)
5. Build and deploy (only after merge)

### Gates (inviolable)
- Nothing goes directly to main - always branch + PR
- Never merge own PR without authorization
- Never deploy before merge
- Never commit `.env` files

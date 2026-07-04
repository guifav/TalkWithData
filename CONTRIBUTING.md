# Contributing to Talk With Data

Thank you for helping improve Talk With Data. This guide explains how to set up the project, follow the code standards, and submit changes that are easy to review.

## Development setup

### Prerequisites

- Node.js 22 or newer.
- npm.
- Docker, optional but recommended for production parity.
- A Firebase project with Authentication, Firestore, and Storage enabled.
- A PostgreSQL database. PostgreSQL is required, including for local development. The Prisma schema targets PostgreSQL and does not work with SQLite.
- At least one AI provider API key for AI features.

### Local setup

```bash
git clone https://github.com/guifav/TalkWithData.git
cd TalkWithData
cp .env.example .env
cd app
npm install
npm run db:generate
npm run dev
```

Start a local PostgreSQL that matches the DATABASE_URL in .env.example:

```bash
docker run -d --name talkwithdata-db -e POSTGRES_USER=user -e POSTGRES_PASSWORD=password -e POSTGRES_DB=talkwithdata -p 5432:5432 -v talkwithdata-db-data:/var/lib/postgresql/data postgres:16-alpine
```

Open http://localhost:3000.

Before testing authenticated flows, edit `.env` and set the Firebase values, `ALLOWED_AUTH_DOMAIN`, `STORAGE_BUCKET_NAME`, `DATABASE_URL`, `DASHBOARD_SESSION_SECRET`, and an AI provider key.

### Docker setup

```bash
cp .env.example .env
docker build -t talk-with-data -f app/Dockerfile app
docker run --rm --env-file .env -p 3000:8080 talk-with-data
```

## Code standards

### TypeScript and structure

- TypeScript strict mode is required.
- Prefer explicit domain types over `any`.
- Use the `@/*` path alias for imports from `app/src`.
- Keep server-only code in API routes or server libraries.
- Keep reusable UI in `app/src/components`.
- Keep core services in `app/src/lib`.
- Do not commit generated secrets, `.env` files, or service account files.

### Design system

- Use shadcn/ui with the Neutral theme.
- Use black, white, and gray as the primary UI palette.
- Use the Inter font.
- Do not add emojis to UI, documentation, logs intended for users, or seed content.
- Do not use long dash characters in prose. Use commas, periods, parentheses, or a normal hyphen when a compound word needs one.
- Prefer text labels over decorative icons.
- Icons must be black and white and should come from `lucide-react`.

### Accessibility and UX

- Use semantic HTML where possible.
- Keep button and form states clear.
- Preserve keyboard navigation.
- Avoid color-only meaning.
- Keep empty, loading, and error states readable.

## Branch and PR workflow

1. Create a branch from the target base branch.
2. Use a clear branch name.
3. Make focused commits.
4. Run tests, lint, and build checks before opening a PR.
5. Push your branch and open a pull request.
6. Link the related issue in the PR description.
7. Wait for review before merge.

Branch naming examples:

- `feat/dashboard-filters`
- `fix/embed-token-expiry`
- `docs/deployment-guide`
- `refactor/storage-adapter`
- `test/admin-rbac`

Use Conventional Commits:

- `feat: add dashboard filters`
- `fix: validate embed token expiry`
- `docs: document Cloud Run deployment`
- `refactor: isolate storage adapter`
- `test: cover admin route access`

PR checklist:

- The PR has a clear description.
- The PR links an issue or explains why no issue is needed.
- `npm test` passes from `app`.
- `npm run lint` passes from `app`.
- `npm run build` passes from `app` when the change can affect production behavior.
- Documentation is updated for behavior, configuration, or deployment changes.
- No `.env`, service account, or private key files are committed.
- No emojis or long dash characters were added.

## Running tests

From `app`:

```bash
npm test
```

Run watch mode while developing:

```bash
npm run test:watch
```

Run lint:

```bash
npm run lint
```

Run a production build:

```bash
npm run build
```

Run Prisma generation after schema changes:

```bash
npm run db:generate
```

Run migrations in environments that use deployed migrations:

```bash
npm run db:migrate
```

## Adding a new AI provider

Read [Architecture, AI providers](docs/ARCHITECTURE.md#ai-providers) before changing provider code.

General steps:

1. Add the provider type to the model resolver in `app/src/lib/ai-model.ts`.
2. Add supported model IDs and a human-readable label.
3. Add the provider API key environment variable to `.env.example`.
4. Implement a request adapter for the provider response shape, headers, tool calls, and streaming behavior if streaming is used.
5. Update AI routes that call the provider, including chat, data chat, dashboard save, and refresh paths when relevant.
6. Ensure prompt construction stays provider-neutral.
7. Add tests for model resolution, missing API keys, invalid model config, and route behavior.
8. Update README and DEPLOYMENT if new environment variables or setup steps are required.

Provider adapters must not leak API keys to clients. All provider calls must stay server-side.

## Reporting bugs and suggesting features

When reporting a bug, include:

- What you expected to happen.
- What happened instead.
- Steps to reproduce.
- Browser, operating system, and deployment context when relevant.
- Logs or screenshots when they do not contain secrets.

When suggesting a feature, include:

- The user problem.
- The proposed workflow.
- Any configuration or security implications.
- Alternatives you considered.

## Code of conduct

Be respectful, constructive, and direct. Assume good intent, but prioritize user safety and project quality. Do not harass, insult, threaten, or exclude contributors. Keep discussions focused on the work and document decisions in issues or pull requests.

Maintainers may close issues, moderate comments, or block participation when behavior harms the project or its contributors.

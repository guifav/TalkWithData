<p align="center">
  <img src="docs/banner.svg" alt="Talk With Data" width="100%">
</p>

# Talk With Data

[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-black.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-black.svg)](app/Dockerfile)

[Leia em portugues](README.pt-BR.md)

Open-source dashboard hub with AI. Upload, organize, search, and embed dashboards, then talk with your own data through governed, row-scoped data sources.

Talk With Data helps teams publish dashboard HTML packages, search across content, explore data with AI, connect MCP tools, and share dashboards through authenticated or embedded views. Superadmins can also connect CSV buckets as governed data sources, so users ask questions in natural language and every answer stays scoped to the rows they are allowed to see.

## Prerequisites

- Node.js 22 or newer for local development without Docker.
- Docker, optional, used by the quickstart and recommended for production parity.
- A PostgreSQL database. PostgreSQL is required, including for local development.
- A Firebase project with Authentication and Firestore enabled. Firebase Storage is needed only when using GCS dashboard storage.
- Persistent dashboard storage: a Google Cloud Storage bucket, or a local filesystem volume for single-instance deployments.
- At least one AI provider API key for AI features.

## Quickstart with Docker

Run the complete local stack with Docker Compose:

```bash
cp app/.env.example app/.env
docker compose up --build
```

Replace the application placeholders in `app/.env`, then open
http://localhost:3000. Compose provisions PostgreSQL in a named volume, waits
for its bounded healthcheck, applies the checked-in Prisma migrations once, and
starts the app only after the migration job succeeds.

The copied `app/.env` file contains placeholders. A running instance still
needs a Firebase project, persistent dashboard storage, and at least one AI
provider. Compose supplies persistent local dashboard storage and the local
PostgreSQL dependency, and overrides the
host-oriented `DATABASE_URL` for its containers. The server reads the
allowlisted `NEXT_PUBLIC_*` Firebase and authentication values at runtime and
bootstraps them to the browser, so one prebuilt image can run with different
public configuration (see [DEPLOYMENT.md](docs/DEPLOYMENT.md)).

## Features

- Governed data sources: superadmins connect Google Cloud Storage buckets of CSV files as organization data sources, with per-source encrypted credentials, owner-column mapping, and user or department grants.
- Chat with your data: natural-language questions become read-only SQL executed in an in-memory DuckDB sandbox against per-request viewer-filtered views, so each user only sees the rows they are allowed to see.
- Dashboard upload for single HTML files and packaged multi-file dashboards.
- AI chat for dashboard creation, editing, explanations, and data exploration.
- Search and navigation across dashboards, categories, owners, departments, and shared folders.
- Data exploration APIs for dashboard-specific structured data managed through Prisma.
- MCP integration for controlled calls to external data tools and live data refresh.
- Embed tokens for external sharing without exposing the full app session.
- Multi-model AI configuration foundation with per-user model selection.
- Admin panel for users, roles, categories, departments, prompts, MCP access, data sources, storage, and usage metrics.

## Tech stack

- Next.js 16 with the App Router.
- React 19.
- Firebase Authentication and Firestore, plus GCS or persistent local dashboard storage.
- Prisma for dashboard-specific structured databases.
- DuckDB in-process engine for data-source queries.
- shadcn/ui with the Neutral theme.
- Tailwind CSS 4.
- TypeScript in strict mode.
- Vitest for tests and ESLint for linting.

## Configuration

Copy `app/.env.example` to `app/.env`, then replace placeholders with project values. Next.js, Prisma, Docker Compose, and the setup script all use this location.

| Variable | Required | Purpose |
| --- | --- | --- |
| `ALLOWED_AUTH_DOMAIN` | Yes | Restricts Google sign-in to a single email domain. Also required in `firestore.rules` before deploying rules. |
| `NEXT_PUBLIC_ALLOWED_AUTH_DOMAIN` | Yes | Browser-side copy of `ALLOWED_AUTH_DOMAIN`. Set both to the same value; the server includes this value in the runtime public bootstrap. |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes | Firebase client API key. |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes | Firebase client auth domain. |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Yes | Firebase client project ID. |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Yes | Firebase client storage bucket. |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Yes | Firebase client messaging sender ID. |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Yes | Firebase client app ID. |
| `FIREBASE_PROJECT_ID` | Yes | Firebase Admin project ID. |
| `SA_KEY_JSON` | Local/non-GCP | Service account JSON for local or non-GCP environments when Application Default Credentials are not available. |
| `STORAGE_BUCKET_NAME` | GCS storage | Bucket used to store dashboard HTML packages and assets when `STORAGE_PROVIDER=gcs`. |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by Prisma. PostgreSQL is required, including for local development. |
| `DASHBOARD_SESSION_SECRET` | Yes | Secret used to sign dashboard and embed session tokens. |
| `TWD_CREDENTIAL_ENC_KEY` | Data sources | 32-byte base64 AES-256-GCM key for external data-source credentials, which are stored encrypted at rest. Required in production when a data source stores a credential. |
| `TWD_INSPECTION_TOKEN_SECRET` | Optional | Dedicated secret for signed admin data-source inspection tokens. Falls back to `DASHBOARD_SESSION_SECRET`. |
| `TWD_ORG_ID` | Optional | Organization id tagged onto data sources created through the admin UI. |
| `TWD_QUERY_TIMEOUT_MS`, `TWD_MAX_ROWS`, `TWD_ENGINE_LRU_BYTES` | Optional | Data-source query guardrails (timeout, row cap, engine cache size). Sensible defaults apply if unset. |
| `APP_URL` | Recommended | Public base URL used for links and token generation. |
| `ANTHROPIC_API_KEY` | AI features | API key for Anthropic models. |
| `OPENAI_API_KEY` | Optional | API key for the OpenAI provider. |
| `GOOGLE_AI_API_KEY` | Optional | API key for the Google AI provider. |
| `KIMI_API_KEY` | Optional | API key for the Kimi provider (OpenAI-compatible). |
| `GLM_API_KEY` | Optional | API key for the GLM provider (OpenAI-compatible). |
| `TWD_AI_CONFIG_ENC_KEY` | Custom AI providers | 32-byte base64 AES-256-GCM key for custom provider keys configured in the admin UI. Required in production before saving custom provider keys. |
| `TWD_AI_CONFIG_LEGACY_READ` | Migration only | Temporary opt-in fallback for reading legacy `users/{uid}.aiConfig.apiKey`. Leave unset after migrating. |
| `AI_DEFAULT_PROVIDER` | Optional | Default AI provider when supported by the runtime. |
| `AI_DEFAULT_MODEL` | Optional | Default AI model when supported by the runtime. |
| `MCP_ALLOWED_HOSTS` | Optional | Comma-separated allowlist of MCP hosts. Empty disables MCP calls. |
| `MCP_API_KEY` | Optional | API key sent to approved MCP hosts. |
| `MCP_URL` | Optional | Default MCP endpoint for deployments that use a shared MCP server. |
| `THUMBNAIL_FUNCTION_URL` | Optional | Cloud Function URL for thumbnail generation. |
| `THUMBNAIL_SECRET` | Optional | Shared secret for thumbnail generation. |
| `STORAGE_PROVIDER` | Optional | Dashboard storage adapter: `gcs` (default) or `local`. Both adapters support upload, serving, replacement, deletion, and version copies. |
| `LOCAL_STORAGE_ROOT` | Local storage | Persistent directory used when `STORAGE_PROVIDER=local`. Defaults to `/data/uploads`; Docker Compose mounts it from `app_data`. |
| `TWD_LOG_LEVEL` | Optional | Minimum structured log level: `info` (default), `warn`, or `error`. |

See [app/.env.example](app/.env.example) for the current template.

## Development

```bash
./setup.sh
# Replace the placeholders in app/.env, then:
cd app
npm run dev
```

Useful commands:

```bash
npm test
npm run lint
npm run build
```

Run the primary browser journeys from `app` with Docker available:

```bash
npx playwright install chromium
npm run test:e2e
```

The command provisions an isolated PostgreSQL 16 container, Firebase Auth and
Firestore emulators, local dashboard storage, and a neutral local CSV fixture.
It never uses production Firebase or GCP credentials. Traces and screenshots
are retained only when a test fails, then session and credential values are
redacted before artifacts can be uploaded.

## Deployment

Docker is the recommended portable runtime. Build from `app/Dockerfile`, provide the same variables from `app/.env.example`, and expose container port `8080` through your platform.

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for Docker, Google Cloud Run, Firebase setup, storage, AI providers, and optional MCP setup.

See [Operational Observability](docs/OBSERVABILITY.md) for structured event names, redaction guarantees, log levels, correlation IDs, and sanitized troubleshooting.

Firestore security rules and indexes are deployed separately with the Firebase CLI, and `firestore.rules` requires your `ALLOWED_AUTH_DOMAIN` in place of the placeholder domain. See [Deploy Firestore rules and indexes](docs/DEPLOYMENT.md#4-deploy-firestore-rules-and-indexes).

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue or pull request.

Project policy documents:

- [GOVERNANCE.md](GOVERNANCE.md), maintainer ownership, decision making, issue triage, deprecation, breaking changes, and the E4 gate.
- [SUPPORT.md](SUPPORT.md), public support channels and unsupported requests.
- [ROADMAP.md](ROADMAP.md), committed release-readiness work and ideas that are not yet commitments.
- [SECURITY.md](SECURITY.md), private vulnerability reporting and security support policy.

## License

Talk With Data is licensed under the [MIT License](LICENSE).

## Credits

Talk With Data is maintained by Guilherme Favaron and the open-source contributor community.

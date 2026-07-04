<p align="center">
  <img src="docs/banner.svg" alt="Talk With Data" width="100%">
</p>

# Talk With Data

[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg)](LICENSE)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-black.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-black.svg)](app/Dockerfile)

[Leia em portugues](README.pt-BR.md)

Open-source dashboard hub with AI. Upload, organize, search, chat, and embed dashboards.

Talk With Data helps teams publish dashboard HTML packages, search across content, explore data with AI, connect MCP tools, and share dashboards through authenticated or embedded views.

## Screenshots

Screenshots will be added after the public UI assets are finalized. The app uses the shadcn/ui Neutral theme, black, white, gray, and the Inter font.

## Prerequisites

- Node.js 22 or newer for local development without Docker.
- Docker, optional, used by the quickstart and recommended for production parity.
- A PostgreSQL database. PostgreSQL is required, including for local development.
- A Firebase project with Authentication, Firestore, and Storage enabled.
- A Google Cloud Storage bucket, or set `STORAGE_PROVIDER=local` to store uploads on the local filesystem.
- At least one AI provider API key for AI features.

## Quickstart with Docker

Run the app locally with Docker in three commands:

```bash
cp .env.example .env
docker build -t talk-with-data -f app/Dockerfile app
docker run --rm --env-file .env -p 3000:8080 talk-with-data
```

The container listens on port `8080`. The `-p 3000:8080` flag maps it to port 3000 on your machine. Open http://localhost:3000.

The copied `.env` file contains placeholders. Configure Firebase, storage, and at least one AI provider before using authenticated and AI features.

## Features

- Dashboard upload for single HTML files and packaged multi-file dashboards.
- AI chat for dashboard creation, editing, explanations, and data exploration.
- Search and navigation across dashboards, categories, owners, departments, and shared folders.
- Data exploration APIs for dashboard-specific structured data managed through Prisma.
- MCP integration for controlled calls to external data tools and live data refresh.
- Embed tokens for external sharing without exposing the full app session.
- Multi-model AI configuration foundation with per-user model selection.
- Admin panel for users, roles, categories, departments, prompts, MCP access, storage, and usage metrics.

## Tech stack

- Next.js 16 with the App Router.
- React 19.
- Firebase Authentication, Firestore, and Firebase Storage on Google Cloud Storage.
- Prisma for dashboard-specific structured databases.
- shadcn/ui with the Neutral theme.
- Tailwind CSS 4.
- TypeScript in strict mode.
- Vitest for tests and ESLint for linting.

## Configuration

Copy `.env.example` to `.env`, then replace placeholders with project values.

| Variable | Required | Purpose |
| --- | --- | --- |
| `ALLOWED_AUTH_DOMAIN` | Yes | Restricts Google sign-in to a single email domain. Also required in `firestore.rules` before deploying rules. |
| `NEXT_PUBLIC_ALLOWED_AUTH_DOMAIN` | Yes | Browser-side copy of `ALLOWED_AUTH_DOMAIN`. Client code cannot read `ALLOWED_AUTH_DOMAIN`, so set both to the same value at build time. |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes | Firebase client API key. |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes | Firebase client auth domain. |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Yes | Firebase client project ID. |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Yes | Firebase client storage bucket. |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Yes | Firebase client messaging sender ID. |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Yes | Firebase client app ID. |
| `FIREBASE_PROJECT_ID` | Yes | Firebase Admin project ID. |
| `SA_KEY_JSON` | Local only | Service account JSON for local development when Application Default Credentials are not available. |
| `STORAGE_BUCKET_NAME` | Yes | Bucket used to store dashboard HTML packages and assets. |
| `DATABASE_URL` | Yes | PostgreSQL connection string used by Prisma. PostgreSQL is required, including for local development. |
| `DASHBOARD_SESSION_SECRET` | Yes | Secret used to sign dashboard and embed session tokens. |
| `APP_URL` | Recommended | Public base URL used for links and token generation. |
| `ANTHROPIC_API_KEY` | AI features | API key for Anthropic models. |
| `OPENAI_API_KEY` | Optional | Reserved for OpenAI provider support. |
| `GOOGLE_AI_API_KEY` | Optional | Reserved for Google AI provider support. |
| `KIMI_API_KEY` | Optional | Reserved for Kimi provider support. |
| `GLM_API_KEY` | Optional | Reserved for GLM provider support. |
| `AI_DEFAULT_PROVIDER` | Optional | Default AI provider when supported by the runtime. |
| `AI_DEFAULT_MODEL` | Optional | Default AI model when supported by the runtime. |
| `MCP_ALLOWED_HOSTS` | Optional | Comma-separated allowlist of MCP hosts. Empty disables MCP calls. |
| `MCP_API_KEY` | Optional | API key sent to approved MCP hosts. |
| `MCP_URL` | Optional | Default MCP endpoint for deployments that use a shared MCP server. |
| `THUMBNAIL_FUNCTION_URL` | Optional | Cloud Function URL for thumbnail generation. |
| `THUMBNAIL_SECRET` | Optional | Shared secret for thumbnail generation. |
| `STORAGE_PROVIDER` | Optional | Storage adapter selector. GCS is the default runtime path. |
| `LOCAL_STORAGE_ROOT` | Optional | Directory for uploaded files when `STORAGE_PROVIDER` is `local`. Defaults to `/data/uploads`. Set automatically by `docker-compose.yml`. |

See [.env.example](.env.example) for the current template.

## Development

```bash
cd app
npm install
npm run db:generate
npm run dev
```

Useful commands:

```bash
npm test
npm run lint
npm run build
```

## Deployment

Docker is the recommended portable runtime. Build from `app/Dockerfile`, provide the same variables from `.env.example`, and expose container port `8080` through your platform.

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for Docker, Google Cloud Run, Firebase setup, storage, AI providers, and optional MCP setup.

Firestore security rules and indexes are deployed separately with the Firebase CLI, and `firestore.rules` requires your `ALLOWED_AUTH_DOMAIN` in place of the placeholder domain. See [Deploy Firestore rules and indexes](docs/DEPLOYMENT.md#4-deploy-firestore-rules-and-indexes).

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue or pull request.

## License

Talk With Data is licensed under the [MIT License](LICENSE).

## Credits

Talk With Data is maintained by Guilherme Favaron and the open-source contributor community.

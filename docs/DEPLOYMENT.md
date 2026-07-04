# Deployment

This guide explains how to deploy Talk With Data with Docker, Google Cloud Run, Firebase, storage, AI providers, and optional MCP servers.

## Runtime requirements

- Node.js 22 or newer when running without Docker.
- Docker for containerized deployment.
- Firebase project with Authentication, Firestore, and Storage enabled.
- A PostgreSQL database reachable through `DATABASE_URL`. PostgreSQL is required, including for local development.
- A storage bucket for dashboard HTML files and assets.
- At least one AI provider API key for AI features.
- HTTPS for production, especially for auth, embed views, and MCP calls.

## Docker

The production container is built from `app/Dockerfile`. It exposes port `8080` inside the container.

### Build and run with Docker

```bash
cp .env.example .env
docker build -t talk-with-data -f app/Dockerfile app
docker run --rm --env-file .env -p 3000:8080 talk-with-data
```

Open http://localhost:3000.

Edit `.env` before using real auth, storage, and AI features.

### Docker Compose

Use Docker Compose when you want a repeatable local or VM deployment. Create a `docker-compose.yml` file in the repository root with this service definition:

```yaml
services:
  app:
    build:
      context: ./app
      dockerfile: Dockerfile
    env_file:
      - .env
    ports:
      - "3000:8080"
    restart: unless-stopped
```

Then run:

```bash
docker compose up --build
```

If your Docker installation uses the legacy binary, the equivalent command is:

```bash
docker-compose up --build
```

### Production container notes

- Keep `.env` out of the image. Inject variables through the platform.
- Use platform secrets for API keys and service account data.
- Set `PORT=8080` unless your platform overrides it.
- Ensure `DATABASE_URL` points to a persistent database.
- Ensure `STORAGE_BUCKET_NAME` points to a persistent bucket.

## Google Cloud Run

Cloud Run is the recommended GCP deployment target when you want a managed container runtime.

### 1. Prepare GCP

```bash
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com firestore.googleapis.com storage.googleapis.com
```

Create an Artifact Registry repository:

```bash
gcloud artifacts repositories create talk-with-data \
  --repository-format=docker \
  --location=us-central1
```

### 2. Build and push the image

```bash
gcloud builds submit app \
  --tag us-central1-docker.pkg.dev/YOUR_PROJECT_ID/talk-with-data/app:latest
```

### 3. Deploy

```bash
gcloud run deploy talk-with-data \
  --image us-central1-docker.pkg.dev/YOUR_PROJECT_ID/talk-with-data/app:latest \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080
```

Then set environment variables in Cloud Run. Use Secret Manager for secrets such as provider API keys, `SA_KEY_JSON`, and `DASHBOARD_SESSION_SECRET`.

### 4. Service account

Prefer Application Default Credentials in Cloud Run by granting the Cloud Run service account access to Firebase, Firestore, and the storage bucket.

Minimum recommended permissions:

- Firestore access for application metadata.
- Storage Object Admin for the dashboard asset bucket.
- Firebase Authentication Admin capability through the Firebase Admin SDK.
- Secret Manager Secret Accessor if secrets are mounted from Secret Manager.

## Environment variables

Use `.env.example` as the source template. The table below describes deployment behavior.

| Variable | Required | Example | Notes |
| --- | --- | --- | --- |
| `ALLOWED_AUTH_DOMAIN` | Yes | `example.com` | Only users with this email domain can authenticate. |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes | `AIza...` | Public Firebase client config. |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes | `project.firebaseapp.com` | Public Firebase client config. |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Yes | `project` | Public Firebase client config. |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Yes | `project.appspot.com` | Public Firebase client config. |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Yes | `123456789012` | Public Firebase client config. |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Yes | `1:123:web:abc` | Public Firebase client config. |
| `FIREBASE_PROJECT_ID` | Yes | `project` | Firebase Admin project ID. |
| `SA_KEY_JSON` | Local or non-GCP | JSON string | Optional on GCP when the runtime service account has access. |
| `STORAGE_BUCKET_NAME` | Yes | `project-uploads` | Bucket used for dashboard files. |
| `DATABASE_URL` | Yes | `postgresql://...` | PostgreSQL connection string used by Prisma. PostgreSQL is required, including for local development. |
| `DASHBOARD_SESSION_SECRET` | Yes | generated secret | Generate with `openssl rand -hex 32`. |
| `APP_URL` | Recommended | `https://app.example.com` | Used for public links and token generation. |
| `ANTHROPIC_API_KEY` | AI features | secret | Required for current AI model calls. |
| `OPENAI_API_KEY` | Optional | secret | Reserved for OpenAI provider support. |
| `GOOGLE_AI_API_KEY` | Optional | secret | Reserved for Google AI provider support. |
| `KIMI_API_KEY` | Optional | secret | Reserved for Kimi provider support. |
| `GLM_API_KEY` | Optional | secret | Reserved for GLM provider support. |
| `AI_DEFAULT_PROVIDER` | Optional | `anthropic` | Default provider where supported. |
| `AI_DEFAULT_MODEL` | Optional | model ID | Default model where supported. |
| `MCP_ALLOWED_HOSTS` | Optional | `mcp.example.com` | Comma-separated HTTPS host allowlist. Empty disables MCP calls. |
| `MCP_API_KEY` | Optional | secret | Sent only to allowlisted MCP hosts. |
| `MCP_URL` | Optional | `https://mcp.example.com/api/mcp/full` | Shared MCP endpoint for deployments that use one. |
| `THUMBNAIL_FUNCTION_URL` | Optional | URL | Cloud Function endpoint for thumbnail generation. |
| `THUMBNAIL_SECRET` | Optional | secret | Shared secret for thumbnail generation. |
| `STORAGE_PROVIDER` | Optional | `gcs` | GCS is the default runtime path. |

## Firebase setup

### 1. Create a Firebase project

1. Open the Firebase console.
2. Create a project or select an existing GCP-backed project.
3. Register a web app.
4. Copy the Firebase web app config into the `NEXT_PUBLIC_FIREBASE_*` variables.

### 2. Enable Authentication

1. Go to Authentication.
2. Enable the Google provider.
3. Add authorized domains for local and production use.
4. Set `ALLOWED_AUTH_DOMAIN` to the organization email domain you want to allow.

The application also validates the domain server-side. Do not rely only on Firebase console settings.

### 3. Enable Firestore

1. Create a Firestore database.
2. Choose the region closest to your users.
3. Start with locked-down rules for production.
4. Let API routes perform privileged operations through Firebase Admin.
5. Create composite indexes as Firestore requests them during staging tests.

Recommended production posture:

- Deny direct client writes to privileged collections.
- Route dashboard, user, prompt, MCP, department, and sharing changes through API routes.
- Keep service account credentials in Secret Manager or platform secrets.

### 4. Enable Storage or GCS

1. Create a bucket for dashboard HTML files and assets.
2. Set `STORAGE_BUCKET_NAME` to that bucket name.
3. Grant the runtime service account permission to read, write, and delete objects.
4. Use lifecycle policies if you need retention limits for old assets.

The app stores dashboard files under `dashboards/{userId}/{dashboardId}/`.

## Storage provider

### GCS

GCS is the production path and the current default. Use it for shared deployments, Cloud Run, and any environment with multiple app instances.

Set:

```bash
STORAGE_BUCKET_NAME=your-project-uploads
STORAGE_PROVIDER=gcs
```

`STORAGE_PROVIDER` can be omitted when using the default behavior.

### Local storage

Use local storage only for single-instance development or experimental deployments that provide a compatible adapter. A local adapter must persist files outside the container filesystem, for example through a mounted volume, and must preserve the same logical paths used by GCS.

Do not use ephemeral container storage for production dashboard assets.

## Database and Prisma

The Prisma schema targets PostgreSQL. PostgreSQL is required in every environment, including local development. SQLite URLs such as `file:./dev.db` do not work and fail during `prisma generate` and `prisma db push`.

`.env.example` ships with a local PostgreSQL example:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/talkwithdata
```

To run a matching local PostgreSQL instance with Docker:

```bash
docker run -d --name talkwithdata-db -e POSTGRES_USER=user -e POSTGRES_PASSWORD=password -e POSTGRES_DB=talkwithdata -p 5432:5432 -v talkwithdata-db-data:/var/lib/postgresql/data postgres:16-alpine
```

For production, use a managed or persistent PostgreSQL instance.

After schema changes, generate the Prisma client:

```bash
cd app
npm run db:generate
```

Apply deployed migrations where your environment uses migration files:

```bash
npm run db:migrate
```

## AI provider setup

### Anthropic

Set:

```bash
ANTHROPIC_API_KEY=your-anthropic-api-key
AI_DEFAULT_PROVIDER=anthropic
AI_DEFAULT_MODEL=claude-sonnet-4-20250514
```

The current resolver supports Anthropic model configuration and can be extended for other providers.

### Additional providers

The environment template reserves keys for OpenAI, Google AI, Kimi, and GLM. Before enabling one of those providers in production, implement and test its server-side adapter.

Provider setup checklist:

- Store API keys in platform secrets.
- Keep provider calls server-side only.
- Verify rate limits and billing settings.
- Add missing models to the resolver.
- Add tests for fallback and missing key behavior.
- Update contributor and deployment docs.

## MCP server setup, optional

MCP is disabled unless allowed hosts and credentials are configured.

### 1. Deploy or choose an MCP server

The MCP endpoint must use HTTPS and support JSON-RPC `tools/call`.

Example endpoint:

```text
https://mcp.example.com/api/mcp/full
```

### 2. Configure the application

```bash
MCP_ALLOWED_HOSTS=mcp.example.com
MCP_API_KEY=your-mcp-api-key
MCP_URL=https://mcp.example.com/api/mcp/full
```

`MCP_ALLOWED_HOSTS` accepts hostnames only, separated by commas. Do not include schemes or paths in that variable.

### 3. Register servers and access

Use the admin panel or admin API routes to:

- Register MCP servers.
- Sync tool metadata.
- Grant access by user or department.
- Review MCP stats.

### 4. Security checks

- Keep `MCP_ALLOWED_HOSTS` as small as possible.
- Use HTTPS only.
- Rotate `MCP_API_KEY` when a server or deployment is compromised.
- Do not let users provide arbitrary MCP endpoints.
- Audit tools that can mutate external systems.

## Thumbnail function, optional

Dashboard thumbnail generation is optional.

Set:

```bash
THUMBNAIL_FUNCTION_URL=https://your-function-url
THUMBNAIL_SECRET=your-shared-secret
```

The app can run without this feature. Thumbnails will be disabled when the URL is not configured.

## Post-deployment checks

After deployment, verify:

- `/api/health` returns success.
- Google sign-in works for an allowed domain user.
- A disallowed domain user is rejected.
- Dashboard upload stores files in the configured bucket.
- Search can find uploaded dashboard text.
- AI chat returns a provider response.
- Embed token generation and viewing work.
- Admin routes reject standard users.
- MCP calls are blocked when the host is not allowlisted.

## Operational guidance

- Rotate API keys and session secrets on a regular schedule.
- Keep Firebase and cloud audit logs enabled.
- Back up Firestore and the Prisma database.
- Use a separate Firebase project for staging.
- Keep production service account privileges minimal.
- Review dependency updates with tests and a production build.

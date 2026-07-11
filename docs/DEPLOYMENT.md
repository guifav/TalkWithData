# Deployment

This guide explains how to deploy Talk With Data with Docker, Google Cloud Run, Firebase, storage, AI providers, and optional MCP servers.

## Runtime requirements

- Node.js 22 or newer when running without Docker.
- Docker for containerized deployment.
- Firebase project with Authentication and Firestore enabled. Firebase Storage is required only when the deployment uses GCS dashboard storage.
- A PostgreSQL database reachable through `DATABASE_URL`. PostgreSQL is required, including for local development.
- Persistent dashboard storage: a GCS bucket or a local filesystem volume.
- At least one AI provider API key for AI features.
- HTTPS for production, especially for auth, embed views, and MCP calls.

## Docker

The production container is built from `app/Dockerfile`. It exposes port `8080` inside the container.

### Build and run with Docker

```bash
cp app/.env.example app/.env
docker build -t talk-with-data -f app/Dockerfile app
docker run --rm --env-file app/.env -p 3000:8080 talk-with-data
```

Open http://localhost:3000.

Edit `app/.env` before using real auth, storage, and AI features.

### Docker Compose

The checked-in `docker-compose.yml` provides the application, PostgreSQL 16,
and a one-shot Prisma migration job. Docker Compose v2 is required for the
health and successful-completion dependency conditions.

Prepare the application configuration and start the stack:

```bash
cp app/.env.example app/.env
# Replace the application placeholders in app/.env.
docker compose up --build
```

Compose uses local development database defaults (`talkwithdata` for the user,
password, and database), stores PostgreSQL data in the `postgres_data` named
volume, and stores local dashboard files in the `app_data` named volume when
`STORAGE_PROVIDER=local`. It follows this startup order:

1. `db` must pass its bounded `pg_isready` healthcheck.
2. `migrate` runs `prisma migrate deploy` once and exits successfully.
3. `app` starts and exposes http://localhost:3000.

The Compose `environment` block overrides the host-oriented `DATABASE_URL` from
`app/.env` with the internal `db` hostname. The migration container receives
only that database URL, not the unrelated secrets from `app/.env`.

Inspect status and migration logs with:

```bash
docker compose ps --all
docker compose logs db migrate
```

Stop containers while preserving application and database data:

```bash
docker compose down
```

Reset all Compose-managed data and apply every migration to a new empty volume:

```bash
docker compose down --volumes
docker compose up --build
```

`down --volumes` permanently removes the Compose PostgreSQL and application data
volumes. A normal `down` preserves them, and the next `up` reruns the idempotent
migration job without reapplying completed migrations.

For custom development credentials, set `POSTGRES_USER`, `POSTGRES_PASSWORD`,
`POSTGRES_DB`, and `COMPOSE_DATABASE_URL` together in the invoking shell or an
ignored root `.env` file. URL-encode reserved password characters inside
`COMPOSE_DATABASE_URL`. Do not use the documented development password for an
internet-exposed or production database.

If migration fails, Compose intentionally leaves `app` stopped. Read
`docker compose logs migrate`, correct the database configuration or migration,
and run `docker compose up --build` again. Do not bypass the migration service by
starting the application container manually.

### Production container notes

- Keep `app/.env` out of the image. Inject variables through the platform.
- Use platform secrets for API keys and service account data.
- Public Firebase and authentication values are read at server runtime and
  bootstrapped through an exact allowlist. One image can be reused across
  environments without placing secrets in the client payload or image layers.
- Set `PORT=8080` unless your platform overrides it.
- Ensure `DATABASE_URL` points to a persistent database.
- For GCS storage, ensure `STORAGE_BUCKET_NAME` points to a persistent bucket.
- For local storage, mount a persistent writable volume at `LOCAL_STORAGE_ROOT`.

## Google Cloud Run

Cloud Run is the recommended GCP deployment target when you want a managed container runtime.

Cloud Run deployments use two images from the same source revision. The
application image serves requests and never runs Prisma migrations. The
`migrator` target runs `prisma migrate deploy` as a single-task Cloud Run Job.
Always create a release tag from one source revision, resolve both pushed tags
to immutable registry digests, and execute the steps below in this order: build
and push both images, deploy and execute the migration job by digest, then roll
out the service by digest. Never put `prisma migrate deploy` in the service
command, startup script, or replica lifecycle.

### 1. Prepare GCP

```bash
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com firestore.googleapis.com storage.googleapis.com
```

Create an Artifact Registry repository:

```bash
gcloud artifacts repositories create talk-with-data \
  --repository-format=docker \
  --location=us-central1
```

Set deployment identifiers. `RELEASE` must identify one immutable source
revision, normally the full Git commit SHA.

```bash
export PROJECT_ID=YOUR_PROJECT_ID
export REGION=us-central1
export RELEASE="$(git rev-parse HEAD)"
export REGISTRY="$REGION-docker.pkg.dev/$PROJECT_ID/talk-with-data"
export APP_IMAGE="$REGISTRY/app:$RELEASE"
export MIGRATOR_IMAGE="$REGISTRY/migrator:$RELEASE"
export SERVICE_NAME=talk-with-data
export MIGRATION_JOB_NAME=talk-with-data-migrate
export RUNTIME_SERVICE_ACCOUNT=talk-with-data-runtime@$PROJECT_ID.iam.gserviceaccount.com
export DATABASE_URL_SECRET=talk-with-data-database-url
export DATABASE_URL_SECRET_VERSION=1
export SESSION_SECRET=talk-with-data-session-secret
export SESSION_SECRET_VERSION=1
export ANTHROPIC_SECRET=talk-with-data-anthropic-api-key
export ANTHROPIC_SECRET_VERSION=1
```

The runtime service account needs access to the configured Firebase, Firestore,
Storage, and Secret Manager resources. The PostgreSQL endpoint must be reachable
from both the Cloud Run service and migration job. Add the same Cloud SQL or VPC
flags to both commands when the database requires them.

### 2. Build and push both images

```bash
gcloud auth configure-docker "$REGION-docker.pkg.dev"
docker build --pull --tag "$APP_IMAGE" --file app/Dockerfile app
docker build --pull --target migrator --tag "$MIGRATOR_IMAGE" --file app/Dockerfile app
docker push "$APP_IMAGE"
docker push "$MIGRATOR_IMAGE"

export APP_DIGEST="$(docker buildx imagetools inspect "$APP_IMAGE" --format '{{.Manifest.Digest}}')"
export MIGRATOR_DIGEST="$(docker buildx imagetools inspect "$MIGRATOR_IMAGE" --format '{{.Manifest.Digest}}')"
export APP_IMAGE_REF="$REGISTRY/app@$APP_DIGEST"
export MIGRATOR_IMAGE_REF="$REGISTRY/migrator@$MIGRATOR_DIGEST"
```

Confirm that both digest variables start with `sha256:`. Do not rebuild or retag
either image between migration and service rollout. The digest references, not
the movable tags, are the deployment contract.

### 3. Deploy and execute the migration job

The job receives only `DATABASE_URL`, runs one task with no automatic retry, and
must complete successfully before the service rollout begins:

```bash
gcloud run jobs deploy "$MIGRATION_JOB_NAME" \
  --image "$MIGRATOR_IMAGE_REF" \
  --region "$REGION" \
  --service-account "$RUNTIME_SERVICE_ACCOUNT" \
  --tasks 1 \
  --parallelism 1 \
  --max-retries 0 \
  --task-timeout 10m \
  --set-secrets "DATABASE_URL=$DATABASE_URL_SECRET:$DATABASE_URL_SECRET_VERSION"

gcloud run jobs execute "$MIGRATION_JOB_NAME" \
  --region "$REGION" \
  --wait
```

Stop if either command fails. Do not deploy the service revision and do not run
a second migration job concurrently. Prisma records completed migrations, so a
later deliberate retry of the same single job is idempotent.

### 4. Roll out the service with dependency probes

Copy the checked-in non-secret environment contract, replace every placeholder,
and keep the edited file outside the repository:

```bash
cp docs/cloud-run.env.yaml.example /tmp/talk-with-data-cloud-run.env.yaml
export RUNTIME_ENV_FILE=/tmp/talk-with-data-cloud-run.env.yaml
```

The environment file and `--set-secrets` list below are authoritative for the
new revision. Add every optional variable and secret used by your deployment to
these inputs before running the command; omitted previous configuration is not
part of the canonical revision contract.

Deploy only after the migration execution succeeds:

```bash
gcloud beta run deploy "$SERVICE_NAME" \
  --image "$APP_IMAGE_REF" \
  --region "$REGION" \
  --service-account "$RUNTIME_SERVICE_ACCOUNT" \
  --allow-unauthenticated \
  --port 8080 \
  --env-vars-file "$RUNTIME_ENV_FILE" \
  --set-secrets "DATABASE_URL=$DATABASE_URL_SECRET:$DATABASE_URL_SECRET_VERSION,DASHBOARD_SESSION_SECRET=$SESSION_SECRET:$SESSION_SECRET_VERSION,ANTHROPIC_API_KEY=$ANTHROPIC_SECRET:$ANTHROPIC_SECRET_VERSION" \
  --startup-probe "httpGet.path=/api/ready,httpGet.port=8080,timeoutSeconds=10,periodSeconds=10,failureThreshold=12" \
  --readiness-probe "httpGet.path=/api/ready,httpGet.port=8080,timeoutSeconds=10,periodSeconds=10,failureThreshold=2,successThreshold=1" \
  --liveness-probe "httpGet.path=/api/health,httpGet.port=8080,timeoutSeconds=2,periodSeconds=10,failureThreshold=3"
```

`/api/health` is a cheap process-local liveness check and never queries the
database. `/api/ready` executes `SELECT 1` against PostgreSQL with the timeout
from `TWD_READINESS_TIMEOUT_MS`, returns `503` without connection details when
PostgreSQL is unavailable, and returns `200` again after it recovers. Cloud Run
startup and readiness probes use `/api/ready`; only liveness uses `/api/health`.
The readiness probe is a Cloud Run Preview feature, so the example deliberately
uses `gcloud beta run deploy`. Confirm Preview availability in the selected
region before the first production release. The 10-second probe timeout covers
the full accepted `TWD_READINESS_TIMEOUT_MS` range.

Verify the deployed endpoints without printing configuration values:

```bash
export SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format 'value(status.url)')"
curl --fail --silent --show-error "$SERVICE_URL/api/health"
curl --fail --silent --show-error "$SERVICE_URL/api/ready"
```

### 5. Forward-only rollback policy

Prisma migrations are forward-only in this deployment workflow. A failed
migration blocks rollout and leaves the currently serving revision unchanged.
Correct the migration or database configuration, build a new immutable release,
and rerun the single migration job.

The previous service revision continues serving between migration success and
the new revision becoming ready. Every migration must therefore remain backward
compatible with the currently serving application for that entire window. Use
expand-and-contract changes across separate releases for destructive renames,
column removals, and incompatible type changes.

After a migration succeeds, never attempt to undo it by running down migrations
or restoring an old schema in place. An earlier application image may receive
traffic only when the applied schema is explicitly backward compatible with it.
Otherwise, fix forward with a new migration and application image. Database
restoration is a separately authorized disaster-recovery operation and must use
a tested backup in a new database before any traffic change.

### 6. Service account

Prefer Application Default Credentials in Cloud Run by granting the Cloud Run service account access to Firebase, Firestore, and the storage bucket.

Minimum recommended permissions:

- Firestore access for application metadata.
- Storage Object Admin for the dashboard asset bucket when using the GCS provider.
- Firebase Authentication Admin capability through the Firebase Admin SDK.
- Secret Manager Secret Accessor if secrets are mounted from Secret Manager.

## Environment variables

Use `app/.env.example` as the source template. The table below describes deployment behavior.

| Variable | Required | Example | Notes |
| --- | --- | --- | --- |
| `ALLOWED_AUTH_DOMAIN` | Yes | `example.com` | Only users with this email domain can authenticate. |
| `NEXT_PUBLIC_ALLOWED_AUTH_DOMAIN` | Yes | `example.com` | Browser-side copy of `ALLOWED_AUTH_DOMAIN`, set to the same value. Read by the server at runtime and included in the public bootstrap. |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Yes | `AIza...` | Public Firebase client config, read at server runtime. |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Yes | `project.firebaseapp.com` | Public Firebase client config, read at server runtime. |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Yes | `project` | Public Firebase client config, read at server runtime. |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Yes | `project.appspot.com` | Public Firebase client config, read at server runtime. |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Yes | `123456789012` | Public Firebase client config, read at server runtime. |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Yes | `1:123:web:abc` | Public Firebase client config, read at server runtime. |
| `FIREBASE_PROJECT_ID` | Yes | `project` | Firebase Admin project ID. |
| `SA_KEY_JSON` | Local or non-GCP | JSON string | Optional on GCP when the runtime service account has access. |
| `STORAGE_BUCKET_NAME` | GCS storage | `project-uploads` | Bucket used for dashboard files when `STORAGE_PROVIDER=gcs`. |
| `DATABASE_URL` | Yes | `postgresql://...` | PostgreSQL connection string used by Prisma. PostgreSQL is required, including for local development. |
| `TWD_READINESS_TIMEOUT_MS` | Optional | `2000` | PostgreSQL readiness timeout in milliseconds. Accepted range is 100 through 10000; invalid values use 2000. |
| `DASHBOARD_SESSION_SECRET` | Yes | generated secret | Generate with `openssl rand -hex 32`. |
| `APP_URL` | Recommended | `https://app.example.com` | Used for public links and token generation. |
| `ANTHROPIC_API_KEY` | AI features | secret | Required for current AI model calls. |
| `OPENAI_API_KEY` | Optional | secret | API key for the OpenAI provider. |
| `GOOGLE_AI_API_KEY` | Optional | secret | API key for the Google AI provider. |
| `KIMI_API_KEY` | Optional | secret | API key for the Kimi provider (OpenAI-compatible). |
| `GLM_API_KEY` | Optional | secret | API key for the GLM provider (OpenAI-compatible). |
| `TWD_AI_CONFIG_ENC_KEY` | Custom AI providers | 32-byte base64 | AES-256-GCM key for custom provider keys configured in the admin UI. Required in production before saving custom provider keys. |
| `TWD_AI_CONFIG_LEGACY_READ` | Migration only | `1` | Temporary opt-in fallback for reading legacy `users/{uid}.aiConfig.apiKey`. Leave unset after migration. |
| `AI_DEFAULT_PROVIDER` | Optional | `anthropic` | Default provider where supported. |
| `AI_DEFAULT_MODEL` | Optional | model ID | Default model where supported. |
| `MCP_ALLOWED_HOSTS` | Optional | `mcp.example.com` | Comma-separated HTTPS host allowlist. Empty disables MCP calls. |
| `MCP_API_KEY` | Optional | secret | Sent only to allowlisted MCP hosts. |
| `MCP_URL` | Optional | `https://mcp.example.com/api/mcp/full` | Shared MCP endpoint for deployments that use one. |
| `THUMBNAIL_FUNCTION_URL` | Optional | URL | Cloud Function endpoint for thumbnail generation. |
| `THUMBNAIL_SECRET` | Optional | secret | Shared secret for thumbnail generation. |
| `STORAGE_PROVIDER` | Optional | `gcs` | Dashboard storage adapter: `gcs` or `local`. Defaults to `gcs`. |
| `LOCAL_STORAGE_ROOT` | Local storage | `/data/uploads` | Persistent writable directory used when `STORAGE_PROVIDER=local`. |
| `TWD_CREDENTIAL_ENC_KEY` | Data sources | 32-byte base64 | AES-256-GCM key for external data-source credentials, which are stored encrypted at rest. Required in production when a data source stores a credential. |
| `TWD_INSPECTION_TOKEN_SECRET` | Optional | secret | Signs admin data-source inspection tokens. Falls back to `DASHBOARD_SESSION_SECRET`. |
| `TWD_ORG_ID` | Optional | id | Organization id tagged onto data sources created through the admin UI. |
| `TWD_QUERY_TIMEOUT_MS`, `TWD_MAX_ROWS`, `TWD_ENGINE_LRU_BYTES` | Optional | `10000`, `1000`, `67108864` | Data-source query guardrails (timeout, row cap, engine cache bytes). |

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

### Custom AI provider key migration and rotation

Custom provider API keys configured in the admin UI are stored in the server-only `ai_config_secrets` collection and encrypted with `TWD_AI_CONFIG_ENC_KEY`. The browser-visible `users/{uid}.aiConfig` document stores only provider metadata and `apiKeyConfigured`.

Before upgrading an instance that previously stored custom keys in `users/{uid}.aiConfig.apiKey`, generate `TWD_AI_CONFIG_ENC_KEY` and store it in your platform secret store:

```bash
openssl rand -base64 32
```

Run the migration from `app/` with application credentials that can use the Firebase Admin SDK:

```bash
npm run migrate:ai-config-secrets -- --dry-run
npm run migrate:ai-config-secrets
```

The migration is idempotent and reports counts only. It does not print plaintext keys or ciphertext values. After migration, deploy `firestore.rules`; legacy user documents that still contain `aiConfig.apiKey`, `aiConfig.apiKeyEnc`, or `aiConfig.credentialEnc` are not client-readable.

If you must keep a short compatibility window before migration, set `TWD_AI_CONFIG_LEGACY_READ=1` temporarily so server-side model resolution can read the old field. Remove it immediately after migration. Rollback should restore the previous application version while keeping `TWD_AI_CONFIG_ENC_KEY` available; do not reintroduce plaintext keys into `users/{uid}`. Losing `TWD_AI_CONFIG_ENC_KEY` makes stored custom provider keys unrecoverable. There is no automatic encryption-key rewrap workflow yet, so rotate previously exposed provider keys at the provider, update them through the admin UI, and then revoke the old provider keys.

### 3. Enable Firestore

1. Create a Firestore database.
2. Choose the region closest to your users.
3. Deploy the rules and indexes from this repository, see the next step.
4. Let API routes perform privileged operations through Firebase Admin.

Recommended production posture:

- Deny direct client writes to privileged collections.
- Route dashboard, user, prompt, MCP, department, and sharing changes through API routes.
- Keep service account credentials in Secret Manager or platform secrets.

### 4. Deploy Firestore rules and indexes

The repository ships the Firestore security rules and composite indexes the app depends on:

- `firestore.rules` defines client access rules.
- `firestore.indexes.json` defines composite indexes and field overrides.
- `firebase.json` wires both files for the Firebase CLI.

> [!WARNING]
> `firestore.rules` ships with a placeholder domain. Before deploying, edit the `isAuthorizedUser()` function in `firestore.rules` and replace `example[.]com` with the same domain you set in `ALLOWED_AUTH_DOMAIN`. Keep the brackets around each dot, for example `mycompany[.]com`, because the value is a regular expression. If you deploy the placeholder, all client reads fail for your real users, and accounts on the placeholder domain would be authorized instead. Update and redeploy the rules whenever `ALLOWED_AUTH_DOMAIN` changes.

Install and authenticate the Firebase CLI once:

```bash
npm install -g firebase-tools
firebase login
```

Deploy from the repository root, where `firebase.json` is located:

```bash
firebase deploy --only firestore:rules,firestore:indexes --project YOUR_PROJECT_ID
```

Notes:

- The repository does not include a `.firebaserc`, so pass `--project` explicitly, or run `firebase use --add` once. Do not commit the generated `.firebaserc`.
- Index builds run in the background and can take several minutes. Queries that need an index fail with a `FAILED_PRECONDITION` error until the build completes.
- If the Firebase project contains indexes that are not in `firestore.indexes.json`, the CLI asks whether to delete them. Treat the file as the source of truth.
- The configuration targets the default Firestore database.
- Server API routes use the Firebase Admin SDK, which bypasses these rules. The rules gate client SDK access only, so a wrong domain shows up as empty lists and failed reads in the browser while server routes keep working.

### 5. Enable Storage or GCS when using the GCS provider

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

Local storage supports dashboard uploads, serving, replacement, deletion, and version copies without `STORAGE_BUCKET_NAME`. Set:

```bash
STORAGE_PROVIDER=local
LOCAL_STORAGE_ROOT=/data/uploads
```

The checked-in Docker Compose stack mounts `/data` from the persistent `app_data` named volume. A normal `docker compose down` preserves uploaded dashboards; `docker compose down --volumes` deletes them.

Use local storage only for a single application instance, or with a filesystem that is genuinely shared and provides the required consistency. Do not use ephemeral container storage or independent per-instance disks. Cloud Run deployments should use GCS because the container filesystem is ephemeral and not shared across instances.

## Database and Prisma

The Prisma schema targets PostgreSQL. PostgreSQL is required in every environment, including local development. The database provider is not switchable: the schema sets `provider = "postgresql"` and uses PostgreSQL-only `String[]` scalar list fields. SQLite URLs such as `file:./dev.db` do not work and fail during `prisma generate` and `prisma db push`.

`app/.env.example` ships with a local PostgreSQL example:

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/talkwithdata
```

That hostname is correct when the app runs directly on your host. If the app
runs in a container, `localhost` resolves to the app container itself, not the
database. The checked-in Compose stack handles this automatically by replacing
the application and migration URLs with its internal `db` service URL.

To run a matching local PostgreSQL instance with Docker:

```bash
docker run -d --name talkwithdata-db -e POSTGRES_USER=user -e POSTGRES_PASSWORD=password -e POSTGRES_DB=talkwithdata -p 5432:5432 -v talkwithdata-db-data:/var/lib/postgresql/data postgres:16-alpine@sha256:57c72fd2a128e416c7fcc499958864df5301e940bca0a56f58fddf30ffc07777
```

For a containerized app outside the checked-in Compose stack, use one of these
connection patterns instead:

- `host.docker.internal` on Docker Desktop, for example `postgresql://user:password@host.docker.internal:5432/talkwithdata`
- a shared Docker network and the database container name as the host
- a compose-managed `db` service name when the app and PostgreSQL are started together

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

The resolver supports Anthropic, OpenAI, Google AI, Kimi, and GLM, plus a custom OpenAI-compatible endpoint.

### Additional providers

OpenAI, Google AI, Kimi, and GLM have implemented server-side adapters (Kimi and GLM reuse the OpenAI-compatible adapter). Provide the matching API key to enable one.

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
- The dashboard list loads for an allowed domain user, which confirms the deployed Firestore rules use the correct domain.
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

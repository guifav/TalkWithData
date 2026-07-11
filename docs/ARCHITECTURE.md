# Architecture

Talk With Data is a Next.js application that combines dashboard publishing, AI-assisted data exploration, Firebase services, Prisma-managed structured data, and optional MCP tool access.

## Layer overview

The system is organized into three layers.

```text
Browser and embedded views
  |
  v
App Shell, Next.js App Router, React, shadcn/ui
  |
  v
API Routes, auth gates, upload handlers, AI routes, admin routes
  |
  v
Data Sources, Firestore, Google Cloud Storage, Prisma databases, AI providers, MCP servers
```

### 1. App Shell

The App Shell is the user-facing Next.js and React layer under `app/src/app` and `app/src/components`.

Responsibilities:

- Render authenticated pages for dashboards, search, upload, chat, data exploration, and administration.
- Use Firebase client Authentication for Google sign-in.
- Follow the design system, shadcn/ui Neutral theme, Inter font, black, white, and gray.
- Keep long-running or privileged work on the server through API routes.
- Render embedded dashboard views through token-based access.

### 2. API Routes

API routes live under `app/src/app/api`. They are the boundary between the browser and privileged services.

Responsibilities:

- Verify Firebase ID tokens and enforce the allowed email domain.
- Enforce RBAC for admin and superadmin routes.
- Upload, replace, archive, refresh, and serve dashboards.
- Manage dashboard versions, views, thumbnails, embed tokens, categories, departments, shared folders, and user records.
- Orchestrate AI chat, data chat, dashboard save, prompt governance, and optional MCP calls.
- Keep API keys, service accounts, database credentials, and storage credentials server-side.

### 3. Data Sources

Data sources are services called by API routes and server libraries.

- Firestore stores application metadata, user records, dashboard records, sharing data, prompt versions, MCP configuration, analytics, and embed token metadata.
- The selected dashboard storage provider, GCS or a persistent local filesystem, stores dashboard HTML files and assets.
- Prisma stores metadata for dashboard-specific structured databases and executes data operations where enabled.
- AI providers generate and edit dashboards, answer data questions, and summarize data.
- MCP servers expose external tools through allowlisted hosts and controlled access rules.

## Request flow

```text
User action
  -> React component
  -> Next.js API route
  -> verifyRequest, verifyAdmin, or verifySuperAdmin
  -> Firestore, Storage, Prisma, AI provider, or MCP
  -> JSON, HTML, or dashboard asset response
```

Embedded dashboard views use a token flow. The view route validates the token, loads dashboard metadata, fetches the HTML asset from storage, records view analytics, and returns the HTML response.

## Firestore

Firestore is the main application metadata store. Prisma is not used for core app metadata.

### Collections

| Collection | Purpose |
| --- | --- |
| `users` | User profiles, role, department, and AI model configuration. |
| `dashboards` | Dashboard metadata, owner, category, storage path, visibility, searchable text, AI recipe, refresh status, and app database summary. |
| `dashboards/{id}/versions` | Version history for uploaded or generated dashboards. |
| `dashboards/{id}/views` | Dashboard view analytics. |
| `dashboards/{id}/embedTokens` | Embed token metadata and expiry. |
| `dashboards/{id}/conversations` | Persisted dashboard conversation context and parsed file summaries. |
| `departments` | Department records and membership metadata. |
| `shared-folders` | Dashboard sharing rules for users and departments. |
| `mcp_servers` | Registered MCP endpoints and server metadata. |
| `mcp_access` | Access rules that map MCP servers to users and departments. |
| `app_prompts` | Prompt governance records, drafts, versions, and active prompt content. |
| `chat_sessions` | Saved chat sessions for data chat. |
| `slugs` | Unique dashboard slug reservations. |
| `pendingRoles` | Pending role assignments used during auth initialization. |

### Indexes

Firestore will prompt for missing composite indexes during development. Keep indexes in project infrastructure configuration when productionizing the app.

Common query patterns that may require indexes:

- `dashboards` by `ownerUid`, `archived`, and `createdAt`.
- `dashboards` by `category`, `archived`, and `createdAt`.
- `dashboards` by `departmentIds`, `archived`, and `updatedAt`.
- `shared-folders` by `createdBy`.
- `shared-folders` by `sharedWithEmails`.
- `shared-folders` by `sharedWithDepartments`.
- `departments` ordered by `name`.
- `dashboards/{id}/views` ordered by timestamp.
- `dashboards/{id}/versions` ordered by version or creation time.

### Rules and access model

The server uses Firebase Admin for privileged operations. Client access should be conservative.

Recommended Firestore rules for production:

- Deny client writes to privileged collections by default.
- Allow users to read their own profile data only when needed by the client.
- Route dashboard, sharing, department, MCP, prompt, and role mutations through API routes.
- Keep role checks in server code and back them with tests.
- Keep service account credentials outside the repository.

## Dashboard storage

Dashboard files use the provider selected by `STORAGE_PROVIDER`: Google Cloud Storage (`gcs`, the default) or a persistent local filesystem (`local`). `STORAGE_BUCKET_NAME` is required only for GCS; `LOCAL_STORAGE_ROOT` selects the local root and defaults to `/data/uploads`.

GCS is appropriate for shared and multi-instance deployments. Local storage is appropriate for a single instance with a persistent volume. Independent local disks must not be used across multiple application instances.

The GCS provider uses the Google Cloud Storage client and reads the bucket name from `STORAGE_BUCKET_NAME`. The local provider maps the same logical paths below `LOCAL_STORAGE_ROOT`.

Initial single-file dashboards use this logical path:

```text
dashboards/{userId}/{dashboardId}/{fileName}
```

Initial packaged dashboards are extracted under:

```text
dashboards/{userId}/{dashboardId}/{relativeAssetPath}
```

Replacements and version restores use immutable revision prefixes below `dashboards/{userId}/{dashboardId}/revisions/{revisionId}/`. The dashboard document stores the active entrypoint `storagePath`. Multi-file dashboards also keep the active storage prefix and entrypoint metadata, so a complete new package is uploaded before one Firestore update makes it visible. Legacy stable paths remain readable.

### Validation

Upload handlers enforce:

- HTML-only single-file upload for direct HTML dashboards.
- ZIP package limits for multi-file dashboards.
- Path traversal protection.
- Maximum file count and extracted size limits.
- Content type inference for dashboard assets.

### Versioning

Dashboard version data lives in Firestore under `dashboards/{id}/versions`. Storage objects keep the HTML or package assets for the active dashboard. Version records point to the relevant storage path and metadata.

### Local storage

Set `STORAGE_PROVIDER=local` to use the filesystem adapter without a bucket. The directory at `LOCAL_STORAGE_ROOT` must be writable and persistent. The local provider preserves the same logical paths, version metadata, and access checks as GCS; individual writes use a temporary sibling file followed by an atomic rename. Use GCS for multi-instance deployments unless the filesystem is genuinely shared and provides the required consistency.

## Prisma

Prisma is used for dashboard-specific structured databases and the app database registry. It is not the source of truth for users, dashboard metadata, roles, or sharing.

### Per-dashboard database model

A dashboard can have a structured database scope:

- One user schema per owner.
- One immutable table prefix per dashboard.
- Multiple tables within the dashboard prefix.
- Registry metadata tracked with Prisma models.
- Firestore stores a dashboard summary for UI display.

The registry tracks lifecycle states:

```text
draft -> active -> deleting -> deleted
draft -> orphaned
```

### Schema manager

The schema manager creates tables, updates columns, records migrations, and keeps audit data for operations performed by AI tools or API routes.

Important constraints:

- Dashboard data access must be scoped to the dashboard owner and dashboard ID.
- Physical table names must use generated prefixes, not user-provided raw names.
- Schema changes must be recorded in migration and audit tables.
- Data routes must validate dashboard ownership or a signed dashboard session token.

## AI pipeline

AI features are implemented through server-side API routes and helper libraries.

### Flow

```text
User prompt or uploaded data
  -> API route validates auth and permissions
  -> Prompt builder loads governed prompt content
  -> Model resolver selects provider and model
  -> Provider adapter sends server-side request
  -> Tool calls may read files, query MCP, or write dashboard HTML
  -> Save route persists dashboard metadata and storage assets
```

### Prompt governance

Prompt content is centrally managed through the prompt registry and prompt governance routes. Active prompt versions can be stored in Firestore and fallback content exists in code for resilience.

Prompt areas include:

- Dashboard builder instructions.
- MCP freshness instructions.
- Dynamic dashboard instructions.
- Brand and visual rules.
- Dashboard database instructions.
- Refresh instructions.
- Data chat instructions.

### AI providers

The current model resolver lives in `app/src/lib/ai-model.ts`. It maps supported providers and models to environment variables and request settings.

To add a provider:

- Add the provider type.
- Add supported model IDs.
- Map the provider to its API key environment variable.
- Implement provider-specific headers, request body, response parsing, errors, and tool call support.
- Keep all provider calls server-side.
- Update route tests, deployment docs, and `app/.env.example`.

The app should keep prompts provider-neutral where possible. Provider-specific behavior belongs in adapters, not UI components.

## MCP integration

MCP integration lets the AI layer call external tools with controlled access.

### Hosts

`MCP_ALLOWED_HOSTS` is a comma-separated allowlist. Calls are blocked when the endpoint is missing, invalid, not HTTPS, or not on the allowlist.

### Proxy and calls

The shared MCP caller sends JSON-RPC `tools/call` requests with `MCP_API_KEY` to approved endpoints. AI routes and refresh workers use this caller to query external data.

### Access control

MCP access is stored in Firestore:

- `mcp_servers` stores endpoint and server metadata.
- `mcp_access` stores which users or departments can use each server.
- User department is read from the `users` collection.
- Admin routes manage server registration and access mappings.

MCP calls should be unavailable by default. Empty `MCP_ALLOWED_HOSTS` disables host access.

## Auth flow

Authentication uses Firebase Authentication with Google sign-in.

1. The browser signs in through Firebase client Auth.
2. The app sends a Firebase ID token to API routes or stores it in the auth cookie path used by the application.
3. `verifyRequest` verifies the token with Firebase Admin.
4. The email domain is checked against `ALLOWED_AUTH_DOMAIN`.
5. API routes load the user document when role, department, or AI model configuration is needed.
6. Admin routes call `verifyAdmin` or `verifySuperAdmin`.

### Domain lock

The allowed domain is required and fail-closed. A token without an email or with an email outside the configured domain is rejected.

### Embed tokens

Embed tokens allow external dashboard viewing without a full app session. The token metadata is stored under `dashboards/{id}/embedTokens`, and token validation checks dashboard ownership, token expiry, and dashboard access rules before serving content.

### Dashboard data sessions

Dashboard data APIs accept a signed dashboard session token or a Firebase bearer token for the dashboard owner. The signing secret is `DASHBOARD_SESSION_SECRET`.

## RBAC

RBAC is role-based and backed by the `users` collection.

### Roles

| Role | Access |
| --- | --- |
| `user` | Standard dashboard usage, uploads, search, chat, and permitted shared content. |
| `admin` | Operational admin access for selected admin routes and dashboards. |
| `superadmin` | Full administrative access, including user roles, prompt governance, MCP management, and system settings. |

### Permissions

- `verifyRequest` checks authentication and domain lock.
- `verifyAdmin` allows `admin` and `superadmin`.
- `verifySuperAdmin` allows only `superadmin`.
- Route handlers must still validate ownership, department access, shared folder access, and dashboard-specific permissions.

### Admin panel

The admin panel covers:

- Users and roles.
- Dashboard inventory and analytics.
- Categories and departments.
- Storage usage.
- Prompt governance.
- MCP servers, MCP access, and MCP stats.

Admin UI visibility should match API route permissions. API route checks are the source of truth.

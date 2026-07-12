# Data, Privacy, and Retention

This document describes the data behavior implemented by the current Talk With
Data source tree. It is an operational inventory for self-hosters, not legal
advice and not a claim of compliance with any privacy framework.

Talk With Data is self-hosted. The project maintainers do not operate a shared
Talk With Data service and do not receive data from an operator's deployment.
The operator is the data controller for the deployment and chooses the Firebase
project, PostgreSQL service, dashboard storage, AI providers, MCP servers, log
backend, region, backups, retention periods, and deletion procedures.

## Data classification

| Class | Examples in this project | Handling expectation |
| --- | --- | --- |
| Credentials and capabilities | AI API keys, external bucket credentials, Firebase ID tokens, dashboard session capabilities, embed tokens, database URLs | Keep out of source control and logs. Store long-lived secrets in the deployment secret service or in the encrypted fields described below. Rotate after suspected exposure. |
| Personal data | Email, display name, avatar URL, department membership, user ID, chat messages, prompt author identity, dashboard sharing lists | Limit access to the deployment, apply an operator-defined retention period, and include in account deletion and access-request procedures. |
| Uploaded and generated content | Dashboard HTML packages, images, CSV-derived dashboard data, AI prompts and responses, dashboard conversations | Treat as potentially confidential. Store only in operator-controlled services and do not use real data in examples or screenshots. |
| Operational metadata | Object sizes, timestamps, status, counts, schema names, audit records, correlation IDs | May still identify activity or a user. Retain only as long as operationally necessary. |
| Public configuration | Firebase web configuration, allowed login domain, non-secret feature limits | May be exposed to the browser by design. It must not contain server secrets. |

## Store inventory

### Firebase Authentication and browser session state

Firebase Authentication is the identity provider. Firebase holds the provider
account, UID, email, display name, avatar, token state, and provider-specific
metadata according to the operator's Firebase configuration.

The browser Firebase SDK maintains its own client authentication persistence.
The application also copies the Firebase ID token to the client-readable
`twd_auth` cookie for server route authentication. That cookie has a one-hour
maximum age and is removed on sign-out. It is not HttpOnly, so arbitrary
dashboard HTML is always served with a CSP sandbox that prevents access to the
application origin and cookie.

Rendered dashboards use a separate signed `dash_session_<dashboardId>` cookie
and bearer capability. These capabilities expire after 10 minutes. Embed links
use random tokens that expire after 7 days.

The application has no account-deletion workflow for Firebase Authentication.
Operators must delete or disable identities in Firebase and separately handle
the persistent records listed below.

### Firestore

The Admin SDK is the primary server-side metadata store. The table lists the
implemented collection families. Fields may grow as features evolve, so inspect
the linked source before applying a destructive production operation.

| Collection or path | Data stored | Sensitivity and access | Default retention and deletion |
| --- | --- | --- | --- |
| `users/{uid}` | Email, name, avatar, role, department, login timestamps, non-secret AI provider configuration | Personal data. A user can read their own safe profile; server routes enforce admin roles. | Indefinite. There is no application account-delete endpoint. Clearing AI configuration deletes its separate encrypted secret, but not the user document. |
| `users/{uid}/favorites`, `recent`, `viewed`, `folders` | Dashboard IDs, user organization state, and activity timestamps | Personal usage metadata. Firestore rules restrict these paths to the owning user, with `viewed` written by the server. | Indefinite until the user removes the item where the UI supports it. Dashboard deletion best-effort removes references from personal folders, but does not recursively remove every user subcollection entry. |
| `dashboards/{id}` | Title, description, category, sharing lists, creator identity, storage paths, upload metadata, view counts, archive state, optional AI recipe and uploaded file names | Personal metadata and potentially confidential content metadata. Direct Firestore client reads enforce owner, team, email, and department grants. Shared-folder inheritance is evaluated only by authenticated server routes. | Indefinite until the owner deletes the dashboard. Archive is not deletion. The delete route removes the parent document first and performs storage and PostgreSQL cleanup on a best-effort basis. |
| `dashboards/{id}/conversations` | Dashboard chat messages and timestamps | Potentially confidential prompts and responses. Access is checked by server routes. | Indefinite. Deleting the parent dashboard document does not recursively delete Firestore subcollections. |
| `dashboards/{id}/views` | Viewer UID, email, display name, time, and source | Personal analytics data. Server-only writes and admin reporting. | Indefinite. No automatic TTL and no recursive deletion with the parent dashboard. |
| `dashboards/{id}/embedTokens` | Random token, dashboard binding, creator UID and email, creation and expiry time | Credential-like capability plus personal metadata. Server-only access. | Valid for 7 days. An expired token is deleted when it is next verified, but unused expired records have no scheduled cleanup. Parent deletion does not recursively remove them. |
| `dashboards/{id}/versions` | Version number, storage path, file metadata, replacer UID and email, replacement time | Personal metadata and pointers to prior dashboard content. Server-only access. | At most 10 version records are maintained during later version creation. Parent deletion does not recursively remove the records. |
| `chat_sessions/{id}` | User ID, title, messages, selected MCP IDs, used tools, timestamps | Personal and potentially confidential conversation content. Server routes restrict a session to its user. | Indefinite until the user invokes the chat-session delete endpoint. |
| `departments/{id}` | Name, description, member UIDs, creator, timestamps | Personal membership and authorization metadata. | Indefinite until a superadmin deletes it. Department deletion updates affected users according to the admin route. |
| `shared-folders/{id}` | Dashboard IDs, owner identity, shared email and department lists, timestamps | Personal sharing metadata. Server-only collection; routes apply owner and recipient checks. | Indefinite until the folder owner deletes it. Dashboard deletion does not currently remove IDs from server-side shared folders. |
| `data_sources/{id}` | External bucket and prefix, encrypted credential material or reference, owner column, grants, creator, configuration version | Credential material, access policy, and external location metadata. Firestore rules deny all client access; superadmin routes mediate access. | Indefinite until a superadmin deletes the data source. Deletion removes the Firestore configuration, not objects in the external bucket. |
| `ai_config_secrets/{uid}` | AES-256-GCM encrypted custom-provider API key | Credential. Client access is denied by Firestore rules. In production, the encryption key must come from deployment secrets and is not stored with the ciphertext. Non-production mode falls back to a public development key when the environment key is unset and must never contain real credentials. | Indefinite while configured. Deleted when the custom key is cleared or replaced by a provider that does not use it. Losing the encryption key makes ciphertext unrecoverable. |
| `mcp_servers/{id}` and `mcp_access/{serverId}` | MCP endpoint, tool metadata, status, user and department grants, updater identity | Endpoint configuration and personal authorization metadata. Server routes are superadmin-only. | Indefinite until changed or deleted through admin controls. Deleting an MCP server does not delete the corresponding access-grant document. Remote MCP systems have their own retention policies. |
| `app_prompts/{key}` and `app_prompts/{key}/versions/{versionId}` | Active and draft prompt text, immutable versions, change summaries, author identity, timestamps | Potentially confidential instructions and personal author metadata. Server-only collection. | Indefinite. Publishing and restoring preserve history; no automatic pruning is implemented. Deleting a prompt parent document would not recursively delete its version subcollection. |
| `settings/categories` | Category list | Configuration metadata. Authenticated users can read it; server-side admin routes write it. | Indefinite until changed by a superadmin. |
| `pendingRoles/{id}` | Bootstrap role assignment | Authorization metadata. Authorized users can read; only the server writes. | Deleted immediately after the server reads a valid pending role and before the role is written to the user document. A failed user update can therefore consume the assignment without applying it. Unused records have no automatic TTL. |
| `slugs/{slug}` | Dashboard slug reservation | Server-only routing metadata. | Released after successful dashboard deletion and when slug-management code replaces a reservation. Failed best-effort release can leave an orphan. |

Firestore document deletion does not delete subcollections. Operators that need
complete erasure must explicitly enumerate and delete child collections, verify
storage and PostgreSQL cleanup, and account for backups.

### PostgreSQL

PostgreSQL is required and contains two data groups.

| Models or objects | Data stored | Default retention and deletion |
| --- | --- | --- |
| `DashboardFieldSchema`, `DashboardFieldValue`, `DashboardFieldAudit` | Custom dashboard field definitions, current values, prior and new values, updater identity, timestamps | Indefinite. Dashboard deletion best-effort removes audit and schema rows; value rows cascade from schema deletion. A cleanup failure leaves rows for operator remediation. |
| `AppDbInstance`, `AppDbTable`, `AppDbMigration`, `AppDbAudit` | Per-dashboard database namespace, owner email and UID, table metadata, migration details, operation type, row count, bounded payload summary | Indefinite registry and audit metadata. Dashboard deletion drops physical dashboard tables and marks the instance `deleted`, but retains registry, migration, and audit records. |
| Per-dashboard physical tables | Data created by interactive dashboards, including inserted and updated row values | Retained while the dashboard database instance exists. Dashboard deletion attempts to drop all tables. Failed drops remain in `deleting` state for later operator cleanup. Draft tables older than 24 hours are dropped only when the protected cleanup endpoint is invoked; there is no bundled scheduler. |

Prisma migrations are forward-only. Database restoration is an operator-owned,
separately authorized disaster-recovery procedure, as described in
[Deployment](DEPLOYMENT.md).

### Dashboard, thumbnail, and external object storage

Dashboard HTML, ZIP package assets, and saved versions are stored through the
selected adapter:

- `gcs` stores objects in the configured Google Cloud Storage bucket.
- `local` stores files below `LOCAL_STORAGE_ROOT`. Docker Compose mounts
  `/data` from the persistent `app_data` volume.

Thumbnails do not use this adapter. Both the thumbnail API route and the
optional thumbnail Cloud Function read and write the configured GCS bucket.
A deployment using `STORAGE_PROVIDER=local` still needs
`STORAGE_BUCKET_NAME` and GCS credentials for thumbnail generation and storage.

Active dashboard deletion attempts to remove its current file or package
prefix. Cleanup is best-effort after the authoritative Firestore document is
deleted. Single-file historical versions under `versions/<dashboardId>/` are
not deleted by the dashboard delete route. Version creation keeps at most 10
versions by deleting the oldest version object and metadata when a later
version is created. Thumbnail replacement best-effort deletes the previous
thumbnail. Dashboard deletion does not delete the current
`thumbnailStoragePath`, so that GCS object remains orphaned until an operator
removes it or a bucket lifecycle rule expires it.

External CSV objects remain in the operator's external bucket. Talk With Data
reads them but does not delete or change them. Deleting a `data_sources`
document only removes the connection configuration.

There are no checked-in Firebase Storage rules because browser clients do not
directly read or write the dashboard bucket. The server adapter uses deployment
credentials. Protect GCS with IAM, uniform bucket-level access where
appropriate, least-privilege service accounts, and operator-defined lifecycle
rules. Protect local storage with host filesystem permissions and encrypted
volumes where required.

### Runtime memory, temporary files, and caches

- DuckDB databases are created in memory. Raw external source data is held in a
  process-local LRU cache, 64 MiB by default, and is evicted under byte pressure
  or lost when the process exits. There is no time-based cache expiry.
- Resolved external credentials are cached in process memory for 5 minutes by
  the credential service.
- The generic source sync cache is process-local and bounded to 256 MiB by
  default.
- Browser and server upload parsing uses request memory. Operators must size
  runtime memory and request limits for their threat model.
- Playwright uses `.tmp/e2e`, `test-results`, and `playwright-report`. The E2E
  runner deletes `.tmp/e2e`, sanitizes failure artifacts, and the paths are
  ignored by Git. CI retains only failure artifacts according to the GitHub
  Actions retention configured by the repository or organization.
- Development and verification scripts create temporary directories and Docker
  volumes and install cleanup traps. An interrupted host or failed cleanup can
  still leave local artifacts for the operator to remove.

### Logs and third-party processors

The application writes structured events to standard output and standard error.
It does not manage log retention. The container platform, host, or log backend
decides retention, replication, access, and deletion. The redaction contract in
[Operational Observability](OBSERVABILITY.md) removes known secret and personal
field families, request bodies, prompts, rows, HTML, storage paths, and error
details. Operators must not add raw payload logging when troubleshooting.

Data sent to configured AI providers or MCP servers is processed under those
services' terms and retention controls. External CSV storage, Firebase,
PostgreSQL, GCS, Secret Manager, AI providers, MCP servers, backup systems, and
log backends may be in different regions. Talk With Data does not select or
enforce a region across those systems.

## Access-control assumptions

- Deploy the checked-in `firestore.rules` and `firestore.indexes.json` after
  replacing the allowed-domain placeholder. Admin SDK routes bypass Firestore
  rules and must retain their server-side authentication and authorization
  checks.
- Firestore clients can read only paths explicitly allowed by the rules.
  Server-only collections deny all client access.
- Dashboard sharing relies on owner UID, team visibility, normalized email,
  department membership, and shared-folder checks. Do not weaken a route to
  trust a client-supplied role or sharing decision.
- GCS and local dashboard storage are server-side resources. Firebase Storage
  rules do not protect them. Use IAM or filesystem permissions.
- In production, `TWD_AI_CONFIG_ENC_KEY` and `TWD_CREDENTIAL_ENC_KEY` protect
  stored ciphertext and must be explicitly configured. Non-production fallback
  keys are public development fixtures and provide no protection for real
  credentials. Keep production keys in the platform secret service, back them
  up under the operator's key-management policy, and rotate exposed provider
  credentials.
- Database and object-store backups contain the same data classifications as
  the live stores and need equivalent access control and deletion procedures.

## Operator retention and deletion responsibilities

Before accepting real data, the operator should document and test:

1. The legal basis and retention period for identities, sharing lists,
   conversations, analytics, audit trails, uploaded content, and backups.
2. The region and replication policy for Firebase, PostgreSQL, object storage,
   secrets, logs, AI providers, and MCP services.
3. Backup frequency, encryption, restore tests, access controls, and the period
   after which deleted live data disappears from backups.
4. An account-erasure runbook that covers Firebase Authentication, Firestore
   parent and child documents, PostgreSQL records and physical tables, object
   storage, logs, provider data, and backups.
5. A periodic orphan scan for dashboard version objects, Firestore
   subcollections, shared-folder references, failed PostgreSQL table drops, and
   expired embed tokens.
6. A process for legal holds. A legal hold is an operator decision and must not
   be inferred from application archive status.

Never promise immediate or regulatory deletion without verifying every live
store, replica, third-party processor, and backup covered by the deployment.

## Privacy statement for self-hosters

Talk With Data is software that an operator installs and controls. The open
source project does not collect telemetry or receive deployment data by
default. A deployment processes the identities, content, credentials, and
metadata described above on infrastructure and third-party services selected
by its operator. Users should direct privacy, access, correction, retention,
and deletion requests to that operator. Operators are responsible for an
accurate public privacy notice for their deployment and for configuring the
software and connected services to honor it.

## Verification references

This inventory was checked against:

- `app/prisma/schema.prisma` for PostgreSQL models and cascades.
- `firestore.rules` and `firestore.indexes.json` for client access assumptions.
- `app/src/app/api`, `app/src/lib/firestore`, `app/src/lib/data-sources`, and
  `app/src/lib/storage.ts` for creation, sharing, deletion, caching, and
  credential behavior.
- `docker-compose.yml`, `app/.env.example`, and
  [Deployment](DEPLOYMENT.md) for volumes, credentials, regions, and backup
  responsibilities.
- [Operational Observability](OBSERVABILITY.md) for the logging and redaction
  contract.

Re-run this review whenever a persistent model, collection, external provider,
storage adapter, delete route, or log field changes.

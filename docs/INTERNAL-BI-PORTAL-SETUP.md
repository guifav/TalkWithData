# Internal BI portal setup

This guide configures Talk With Data for its primary supported use case: a
single organization distributes governed extracts of its business data to its
own team, with row-level security and natural-language chat.

The scenario, end to end: your company already produces reports in a BI
platform, a data warehouse, or an ERP. A scheduled job exports curated CSV
extracts to Google Cloud Storage. Talk With Data serves them to your team:
each person signs in with the company Google account, asks questions in
natural language, and only ever sees the rows they own.

Everything here uses the reserved `example.com` domain and synthetic names.
Replace them with your organization's values.

## Who this guide is for

The technology team of one organization deploying Talk With Data for that
organization's own users. One deployment serves one organization behind one
Google Workspace domain. Distribution to external clients is a different
problem and is intentionally out of scope today; see the
[use case roadmap](USE-CASES-ROADMAP.md).

## Architecture at a glance

1. An export job in your BI platform, warehouse, or ERP produces one curated
   CSV per dataset, on a schedule you control.
2. The job uploads each CSV to a dedicated Google Cloud Storage prefix.
3. A superadmin registers each prefix as a governed data source, choosing the
   owner column and granting access to users or departments.
4. Team members sign in with the company Google account and chat with the
   data. Each data access is a single-statement, read-only SQL query executed
   in an in-memory DuckDB sandbox against a view filtered to the viewer's
   rows; one question may trigger several such queries.
5. Optionally, the team publishes dashboards (single HTML files or ZIP
   packages) to the same hub, shared by team, email, or department.

The deployment's own stores are services you operate: your BI export, your
bucket, your deployment, your Firebase project, and your PostgreSQL
instance. Two kinds of external processors also receive data: the AI
provider you configure receives the conversation and the query results that
the signed-in viewer is allowed to see, and MCP servers, if you enable them,
receive the tool calls you route to them. What those processors retain is
governed by their terms, not by this application; account for them in your
privacy review ([DATA-PRIVACY.md](DATA-PRIVACY.md)).

## Prerequisites

- A Google Workspace domain for your organization. Sign-in is locked to one
  email domain.
- A Firebase project with Authentication (Google provider) and Firestore.
- A PostgreSQL database. It is required by the application.
- A Docker host or Google Cloud Run for the application, per
  [DEPLOYMENT.md](DEPLOYMENT.md).
- A Google Cloud Storage bucket for the CSV extracts. Governed data sources
  read from GCS even when dashboard storage uses the local adapter.
- At least one AI provider API key.

## Step 1: deploy the application

Follow [DEPLOYMENT.md](DEPLOYMENT.md) for Docker or Cloud Run. The variables
below deserve extra attention in this use case; the full contract lives in
[app/.env.example](../app/.env.example).

| Variable | Why it matters here |
| --- | --- |
| `ALLOWED_AUTH_DOMAIN`, `NEXT_PUBLIC_ALLOWED_AUTH_DOMAIN` | The single-organization lock. Only Google accounts of this email domain can sign in. Set both to the same value, and put the same domain in `firestore.rules` before deploying rules. |
| `TWD_CREDENTIAL_ENC_KEY` | Required in production before saving a data source credential. A 32-byte base64 AES-256-GCM key, for example from `openssl rand -base64 32`. Keep it in your deployment secret service. Losing it makes stored credentials unreadable, and every source credential must then be onboarded again. |
| `DATABASE_URL` | PostgreSQL connection string, required. |
| `DASHBOARD_SESSION_SECRET` | Signs dashboard and embed session tokens. |
| `STORAGE_PROVIDER`, plus `LOCAL_STORAGE_ROOT` or `STORAGE_BUCKET_NAME` | Dashboard HTML storage. `local` works for single-instance deployments; governed CSV sources still read GCS. |
| `ANTHROPIC_API_KEY` or another provider key | Enables chat. Defaults come from `AI_DEFAULT_PROVIDER` and `AI_DEFAULT_MODEL`; per-user configuration comes later in the admin panel. |
| `TWD_QUERY_TIMEOUT_MS`, `TWD_MAX_ROWS`, `TWD_READ_MAX_BYTES`, `TWD_ENGINE_LRU_BYTES` | Data source guardrails. Defaults: 10 second timeout, 1,000 row cap, 50 MiB object read limit, 64 MB in-memory source cache. |
| `TWD_ORG_ID` | Optional label recorded on data sources created through the admin UI. |

## Step 2: bootstrap the first superadmin

Roles are `user`, `admin`, and `superadmin`. They are assigned server-side:
clients cannot write the `role` field, and a first login receives `user`
unless a pending role pre-approves an elevation. Data sources, departments,
and the other governance features are superadmin-only, so create your first
superadmin deliberately:

1. Before that person's first login, create a document in the `pendingRoles`
   Firestore collection with the field `role` set to `superadmin`. The
   document ID is the email with `@` replaced by `_at_` and every `.`
   replaced by `_`. For `ops@example.com`, the ID is `ops_at_example_com`.
2. The person signs in. The application consumes the pending role, applies it
   to their user document, and deletes the pending record.

If the person has already signed in, edit their `users/{uid}` document in the
Firebase console and set `role` to `superadmin` instead.

From then on, promote and demote people in **Admin > Users**. Keep the number
of superadmins small: they manage data source configuration and grants for
everyone.

## Step 3: design the CSV extracts

This is where your team spends its judgment. The application governs access;
the export defines what exists to be accessed.

**One dataset per prefix.** Each governed source reads the first `.csv`
object found under its configured prefix, and admin header inspection looks
only at the first 25 objects while locating it. Give every dataset an
exclusive prefix so both selections stay deterministic:

```text
gs://example-twd-sources/sales-pipeline/pipeline.csv
gs://example-twd-sources/billing-summary/billing.csv
```

**Stable, unique headers.** Headers are normalized before comparison. At
onboarding, two headers that normalize to the same identity, such as
`owner-email` and `owner_email`, block saving the source, and at load time a
collision with the owner column identity fails closed. Keep header names
stable across export runs; renaming columns is a configuration change (see
the runbook).

**The owner column.** Choose the column that identifies who owns each row.
Sources created through the admin UI match owner values against the
signed-in user's email: both sides are lowercased and trimmed, so use the
exact corporate addresses that exist in your Google Workspace. (The engine
also defines a UID-based identity, but it is not configurable through the
admin UI today.)

Rules that follow from the engine's behavior:

- Every row needs an owner value. A viewer only receives rows whose owner
  matches their own identity. A viewer that matches nothing receives zero
  rows, never everything.
- The owner column is removed from the filtered view. Queries can neither
  select it nor return it.
- One owner per row. If several people must see the same fact, the export
  must repeat that row once per authorized viewer's owner key. Grants never
  widen rows: a management rollup dataset works because each rollup row is
  repeated per manager email, not because the source is granted to managers.

**Size the extracts deliberately.** Extracts should be curated slices, not
warehouse dumps. A single object read is capped at 50 MiB by default
(`TWD_READ_MAX_BYTES`). Each distinct content version of a CSV is parsed
into an in-memory DuckDB table and cached (64 MB total by default, tunable
with `TWD_ENGINE_LRU_BYTES`), and query results are capped at 1,000 rows by
default. The feature is built for answering questions over curated data, not
for bulk export.

**Freshness.** Replace the object in place (same object name) whenever your
export runs. The engine keys its cache by the object's content hash and the
source's configuration version, so the next query after a replacement loads
the new file automatically. No application restart is involved. The
application ships no scheduler: the export cadence is entirely your
pipeline's job (cron, a workflow orchestrator, or the scheduler inside your
BI platform).

## Step 4: provision the bucket and service account

1. Create or choose a bucket controlled by your organization, ideally
   dedicated to these extracts.
2. Create a dedicated service account with read-only object access to that
   bucket: object listing and object reads. In GCP terms,
   `roles/storage.objectViewer` on the bucket is sufficient.
3. Generate a JSON key for it. Keep the key outside the repository and
   outside shell history.

The key is pasted once into the admin UI during onboarding. The server
encrypts it with `TWD_CREDENTIAL_ENC_KEY` (AES-256-GCM), stores only
ciphertext, and the browser clears the pasted value after accepting the
encrypted inspection result. See the credential onboarding notes in
[DEPLOYMENT.md](DEPLOYMENT.md#external-data-source-credential-onboarding).

## Step 5: register the data source

Sign in as a superadmin and open **Admin > Data Sources**:

| Field | Example | Meaning |
| --- | --- | --- |
| Name | `Sales pipeline` | Operator-facing label |
| Bucket | `example-twd-sources` | Bucket name without `gs://` |
| Prefix | `sales-pipeline/` | Exclusive prefix of this dataset |
| Credential ref | `twd-sources-reader` | Opaque identifier for the stored credential |
| Service account JSON | Contents of the key file | Write-only onboarding input |

Select **Inspect headers**, confirm the returned headers, choose the owner
column, add grants (next step), then create the source.

The [governed CSV walkthrough](CSV-WALKTHROUGH.md) reproduces this flow end
to end with a neutral fixture and lists the expected fail-closed behaviors.
It is the fastest way to validate a fresh deployment before onboarding real
data.

## Step 6: model departments and grants

Access has two independent layers. Keep them straight and the rest of the
model stays simple:

| Layer | Question it answers | Where it is configured |
| --- | --- | --- |
| Source grant | May this person query this dataset at all? | The source's assigned users (Firebase UIDs) and assigned departments |
| Owner column | Which rows does an authorized person see? | The data itself, one owner per row |

A department grant authorizes every member of the department to query the
source; each member still receives only their own rows. Use departments
(**Admin > Departments**) for teams, and per-user grants for exceptions. A
user with no grant is denied before credentials are even loaded.

## Step 7: validate the row scope

Before rolling out, run the two-user check from the
[governed CSV walkthrough](CSV-WALKTHROUGH.md): two real accounts of your
domain, one owner value each, the same question, two disjoint answers. Also
confirm the fail-closed behaviors: a viewer with no matching rows gets zero
rows, a missing owner column makes the source unavailable, and an ungranted
user is denied.

For upgrades, keep the walkthrough's focused test command in your validation
routine. It exercises grants, row scope, read-only enforcement, and the
fail-closed paths without needing Firebase or GCP credentials.

## Step 8: roll out to the team

- **AI defaults.** Set `AI_DEFAULT_PROVIDER` and `AI_DEFAULT_MODEL`, and
  manage per-user provider and model configuration in **Admin > AI Models**.
  Chat calls are billed by your AI provider; budget by expected active users.
- **Prompts.** Dataset chat behavior is governed by the prompt registry
  (**Admin > Prompts**) with drafts, immutable versions, and publish and
  restore, so prompt tuning is reviewable instead of ad hoc.
- **Dashboards.** Publish supporting dashboards by uploading single HTML
  files or ZIP packages. Share them with team visibility or with specific
  emails and departments, and organize them with categories and shared
  folders.
- **MCP, optional.** Registered MCP servers with per-user or per-department
  access let the chat call live external tools. MCP stays disabled until
  `MCP_ALLOWED_HOSTS` is set.

## Operations runbook

- **Data refresh.** The export job replaces objects on its schedule; queries
  pick up new content automatically because cache keys include the object's
  content hash. To verify a refresh, ask a granted user's question again
  after the swap, or check the object's updated timestamp in the bucket.
- **Schema changes.** Adding, removing, or renaming columns changes the
  headers. If the configured owner column disappears, the source fails
  closed and users see `Data source temporarily unavailable.` Re-run
  **Inspect headers** and update the source configuration; configuration
  changes bump the source version and invalidate cached content.
- **Credential rotation.** Onboard a new key through the same write-only
  flow; the server re-encrypts and replaces the stored ciphertext. Rotating
  `TWD_CREDENTIAL_ENC_KEY` itself makes previously stored ciphertext
  unreadable, so plan to re-onboard every source credential when that key
  rotates.
- **Limits.** Tune `TWD_QUERY_TIMEOUT_MS`, `TWD_MAX_ROWS`,
  `TWD_READ_MAX_BYTES`, and `TWD_ENGINE_LRU_BYTES` for your deployment
  size. Defaults: 10 seconds, 1,000 rows, 50 MiB per object read, 64 MB of
  cache.
- **Observability.** Structured, redacted events with correlation IDs are
  documented in [OBSERVABILITY.md](OBSERVABILITY.md).
- **Privacy and retention.** The operator is the data controller of the
  deployment. [DATA-PRIVACY.md](DATA-PRIVACY.md) records the data inventory,
  the retention defaults (mostly indefinite), and the deletion caveats you
  need to own; for example, deleting a dashboard does not recursively delete
  its Firestore subcollections.
- **Backups.** PostgreSQL, Firestore, and the buckets are your services;
  back them up under your own policy. Prisma migrations are forward-only.

## Current boundaries

- Governed sources read CSV from Google Cloud Storage only. Local files and
  database connectors are not supported today; see the
  [use case roadmap](USE-CASES-ROADMAP.md).
- One CSV per source prefix.
- No built-in scheduler. Export cadence lives in your pipeline.
- Sign-in is locked to a single Google Workspace domain by design. External
  client distribution is a roadmap direction, not a current capability.
- Embed tokens exist for convenience sharing of individual dashboards. They
  are valid for 7 days, are not revocable today, and grant read access to
  the dashboard and its data endpoints. Treat them accordingly.

# Design: CSV data source with row-level access (Phase 1)

- Date: 2026-07-04
- Status: Implemented in P1.0-P1.8 (merged 2026-07-07 to 2026-07-09), with
  deviations from this design. See "Implementation notes (as-built)" below.
- Scope: Phase 1 of a pluggable data-source layer. This spec covers the CSV
  bucket source only. Direct database sources and cross-source federation are
  deferred to later phases (see Roadmap).

## Implementation notes (as-built)

This document is preserved as the Phase 1 design record. The implementation
kept the DataSource abstraction, CSV parsing with conservative type inference,
per-source credentials, owner-column mapping, viewer-scope resolution, and the
superadmin CRUD, but deviated on the execution engine and secret storage:

- Query engine: per-request in-memory DuckDB instead of Postgres staging with
  RLS. Row scope is enforced by querying through a viewer-filtered VIEW
  (filtering applied at table-scan time), combined with a SQL AST guard that
  only admits a single read-only statement
  (`app/src/lib/data-sources/sql-guard.ts`, `duckdb-engine.ts`,
  `duckdb-sandbox.ts`).
- Credentials: encrypted inline in the Firestore document with AES-256-GCM
  under `TWD_CREDENTIAL_ENC_KEY` (`app/src/lib/data-sources/credentials.ts`)
  instead of an external secret-manager reference. Firestore rules block all
  client reads of `data_sources`.
- Sync: on demand with etag-based caching
  (`app/src/lib/data-sources/sync-cache.ts`); the scheduled cron sync from
  section 8 is not wired yet.
- Postgres staging, the `twd_dataset_reader` role, and the RLS policy
  templates from sections 6-9 were not created; they remain the natural path
  for the Phase 2 database source.

See `docs/ARCHITECTURE.md` for the current system description.

## 1. Goal

Let an admin connect an external bucket of CSV files as a governed org data
source, keep it synced, and let granted users converse with that data in
natural language, with per-row access control (a rep sees only their rows, a
supervisor sees their team, a director sees everything).

## 2. Concrete use case

Data lives in a closed third-party application. It is exported as CSV to a
bucket. That CSV must act as a data source the app can chat with. Example
questions a salesperson should get correct answers to:

- "How much did I sell yesterday, and what are my opportunities this week?"
- "Which of my customers have not bought in N days?"
- "Which customers bought in June last year and have not bought this month yet?"

Access is hierarchical: a rep sees only their own customers, a supervisor sees
the team, leadership sees everything.

## 3. Scope and roadmap

This is a platform-shaped idea (pluggable CSV / database / MCP sources, possibly
combined and joined across a shared key). To avoid rework it is decomposed into
phases, each behind a single `DataSource` abstraction so later phases plug in
without breaking earlier ones.

- Phase 1 (this spec): CSV bucket source. bucket -> sync -> Postgres (pragmatic
  typing) -> row-level security -> chat.
- Phase 2 (later): `database` source type (direct Postgres/MySQL connection).
- Phase 3 (later): cross-source federation (join CSV x database x MCP on a shared
  key). Federation engine decided then; Postgres-as-hub via FDW is the natural
  candidate because it preserves native RLS, and Phase 1 already stages data in
  Postgres.

Note: MCP is already a data source today (the chat calls MCP servers as tools).
The "MCP only" case already works; Phase 1 adds the `csv` type.

## 4. The DataSource abstraction

A single interface the chat consumes without knowing the concrete type:

```
interface DataSource {
  listTables(): TableMeta[]                       // logical name + columns + inferred types
  getSchemaForPrompt(): string                    // human-readable schema for the model
  runQuery(sql: string, viewerScope: ViewerScope): Rows  // executes already under RLS
}
```

Phase 1 ships `CsvBucketSource`. `DatabaseSource` and a federating source
implement the same interface later. The chat talks to the interface, never the
concrete type. This is what honors "impossible to predict every use" without
building every source now.

## 5. Requirements

Functional:
- Admin registers a CSV data source: bucket, prefix, credential reference, sync
  schedule, per-table owner-column mapping, access grants (users/departments).
- The app lists CSV objects under the prefix using that source's credentials and
  ingests them into queryable, typed Postgres tables.
- Data refreshes on a schedule (cron) that the admin sets.
- Granted users chat with the data; the model writes read-only SQL that is
  executed under enforced row-level security.

Non-functional (hard constraints):
- Row-level access is enforced by the database, not by trusting the model. Even
  `SELECT *` returns only permitted rows.
- Source credentials (service account) are never stored in a client-readable
  place and never exposed to the model.
- Query execution is read-only, schema-scoped, time-bounded, and row-capped.

## 6. Architecture and data flow

Ingestion (cron):
`data source (admin config)` -> `sync worker lists + downloads changed CSVs
(source credentials)` -> `parse + pragmatic type inference` -> `create/update
typed tables in the source's Postgres schema` -> `RLS policies applied`.

Query (chat):
`user asks` -> `model writes SELECT via query_dataset tool` -> `executed under
read-only role + RLS scoped to the user` -> `only permitted rows return` ->
`model answers`.

Reused (already in the codebase):
- `app/src/lib/app-db/schema-manager.ts` (typed table create, batch insert,
  paginated read), `registry.ts`, `naming.ts`, audit.
- `app/src/lib/ai-providers/*` (provider abstraction), `prompt-registry.ts`,
  `ai-prompt.ts`.
- `app/src/app/api/ai/data-chat/route.ts` (chat surface + tool loop + SSE).
- `app/src/lib/mcp-access.ts`, `permissions.ts`, `role-access-plan.ts`,
  departments (grants + hierarchy resolution).
- `app/src/lib/file-parser.ts` (extended with CSV), the refresh worker pattern
  (basis for the sync cron), `app/src/lib/storage-provider.ts` (the currently
  unused interface, now used and extended with list + read-by-key).

New:
- `app/src/lib/data-sources/` (DataSource types, `CsvBucketSource`, registry).
- `app/src/lib/data-sources/sync.ts` (cron sync worker).
- CSV parser + type inference in `file-parser.ts`.
- `list(prefix)` + read-by-key/stream in the storage layer, using per-source
  credentials.
- `app/src/app/api/admin/data-sources/*` (admin CRUD + grants + trigger sync).
- Dataset chat: extend `api/ai/data-chat` (or a sibling route) with a
  `dataSourceId`, the `query_dataset` tool, and viewer-scope resolution.
- Postgres migration: `twd_dataset_reader` role + RLS policy templates.
- A cron entry that calls the sync endpoint for due sources.

## 7. Data model

Firestore `data_sources` (admin-config; mirrors `mcp_servers` + `mcp_access`):
- `id`, `type: "csv"`, `name`, `bucket`, `prefix`
- `credentialRef`: reference to a server-side secret holding the source's service
  account. Never the raw key in Firestore, never client-readable.
- `syncSchedule`: cron expression or `daily | weekly | manual`.
- `tables`: per logical table, `{ ownerColumn?: string, ownerColumnIdentity?:
  "email" | "uid", restricted: boolean }`. `restricted: false` means every
  granted user sees all rows (reference table).
- `accessGrants`: `{ assignedUsers: string[], assignedDepartments: string[] }`.
- `status`, `lastSyncAt`, `syncStatus`, `lastSyncError`.

Postgres (generalize app-db from "per dashboard" to also "per source"):
- One dedicated schema per source: `src_<hash(sourceId)>`.
- Tables: `<schema>.<sourceId_prefix>__<csvLogicalName>`.
- Reuses `schema-manager` for DDL/DML and `registry` for metadata + audit,
  extended with a source scope alongside the existing dashboard scope.
- A per-source manifest tracks each file's etag/md5 to detect changes.

## 8. Ingestion and sync

A scheduled worker (built on the existing refresh-worker pattern) runs per due
source:
1. Resolve the source's credentials; construct a storage client scoped to that
   bucket.
2. `list(prefix)` the CSV objects; compare etag/md5 against the manifest.
3. For each new/changed CSV: download, parse, infer column types pragmatically
   (sample the first N rows; infer integer/numeric/date/timestamp/boolean; fall
   back to text when mixed or ambiguous).
4. Create the table if absent, or reconcile columns if changed.
5. Load rows. Phase 1 uses truncate + reload per changed file inside a
   per-file transaction (all-or-nothing per table). Incremental upsert is
   deferred (needs a declared key).
6. Update the manifest and the source's `lastSyncAt` / `syncStatus`.

Pragmatic typing keeps messy spreadsheets usable: a column that does not cleanly
infer stays text, and the model is told the column types so it casts in SQL when
needed.

## 9. Access control: RLS and hierarchy (the crux)

Owner mapping. Per source, the admin declares which column identifies the row
owner (for example `rep_email`) and its identity type (email or uid). The column
values must be joinable to app identities, so an app user can be mapped to the
owner keys they may see.

Viewer scope resolution (server-side, from the authenticated app user):
- Rep: their own owner key only.
- Supervisor: the owner keys of their department's members (from the app's users
  + departments), resolved via `role-access-plan` / `permissions`.
- Leadership/admin: unrestricted.
Result: `ViewerScope = { ownerKeys: string[], unrestricted: boolean }`.
Caveat accepted in Phase 1: "team" maps to the app's department, which may be
coarser than a real sales team. Finer hierarchy is a later refinement.

Enforcement (Postgres RLS, not trust in the model):
- A dedicated role `twd_dataset_reader`: `NOSUPERUSER`, `NOBYPASSRLS`, granted
  `USAGE` on source schemas and `SELECT` on their tables only.
- Each restricted table has a policy:
  `USING (current_setting('app.viewer_unrestricted')::bool
          OR owner_col = ANY (string_to_array(current_setting('app.viewer_owner_keys'), ',')))`.
- Unrestricted tables (reference data) get a permissive read policy for any
  granted user.
- Every query runs inside a read-only transaction:
  `SET LOCAL ROLE twd_dataset_reader`,
  `SET LOCAL app.viewer_owner_keys = '<comma-joined keys>'`,
  `SET LOCAL app.viewer_unrestricted = 'false' | 'true'`,
  `SET LOCAL statement_timeout = '5000'`, then the guarded SELECT, then
  `ROLLBACK`.
Even if the model emits `SELECT *`, the database returns only permitted rows.

## 10. Query and chat path

Extend the data chat: it accepts a `dataSourceId`, loads the source's table
schemas and injects them into the system prompt, and exposes one tool
`query_dataset(sql)`.

Guards on `query_dataset` (defense in depth, all enforced server-side):
1. Statement guard: exactly one statement, must be a `SELECT` (reject DDL/DML,
   multiple statements, `;` chaining, CTE-wrapped writes).
2. Read-only role + read-only transaction (writes fail even if the guard is
   bypassed).
3. RLS (row scope) as in section 9.
4. `statement_timeout` and an enforced maximum `LIMIT`.
5. Schema pinned to the source's schema (no cross-source, no system catalogs
   beyond what is needed for the model to see column names).

On a SQL error, the error is returned into the tool loop so the model can
correct itself. The chat reuses the provider abstraction, SSE streaming, and the
tool loop already in place.

In-context path (the small, non-restricted exception): a tiny CSV explicitly
marked `restricted: false` may be summarized into the prompt like the existing
attached-file path. Any table with row restrictions must go through Postgres +
RLS; putting restricted content in the prompt would bypass RLS.

## 11. Error handling

- Sync: a credential or list failure marks the source `syncStatus: error` and
  records `lastSyncError` without affecting other sources. An invalid CSV is
  skipped and logged; the previous table is preserved. Ingestion is
  transactional per file (all-or-nothing per table).
- Query: a malformed model SQL returns the DB error into the tool loop for
  self-correction. Timeout or row-cap hits return a clear message. A viewer with
  no resolvable scope gets an empty result, not an error, and never another
  user's rows.

## 12. Testing strategy

- Unit: type inference; viewer-scope resolution (rep vs supervisor vs
  leadership); the SQL statement guard (blocks DDL/DML, `;`, multi-statement,
  write CTEs); prompt/schema assembly.
- Integration (Postgres is already in CI): ingest -> query -> RLS end to end.
- Security: cross-tenant isolation (user A cannot read user B's rows via any
  crafted SQL); injection (malicious SQL is blocked by the guard, and blocked
  again by the read-only role + RLS if the guard is bypassed); unrestricted
  reference tables are readable by all granted users only.

## 13. Security considerations

- The repo carries known security debt (issue #13: readable `aiConfig.apiKey`,
  iframe XSS, broad dashboard API access). This feature must not add to it.
- Source service-account credentials are stored server-side via a secret
  reference, never in a client-readable Firestore field, never sent to the
  model.
- Three independent locks on query execution: the SQL statement guard, the
  read-only low-privilege role, and RLS. RLS is the guarantee that survives even
  if the model or the guard is wrong.
- Access to a source (who can chat with it) reuses the existing
  grants/permissions model; row access within a source is RLS.

## 14. Out of scope (Phase 1, deliberate)

- `database` source type (Phase 2) and cross-source federation (Phase 3).
- Incremental upsert during sync (truncate + reload only for now).
- In-context beyond small, explicitly non-restricted reference tables.
- Finer-than-department hierarchy for the supervisor scope.
- Write-back to the source.

## 15. Assumptions and open questions

Assumptions:
- The owner column's values are joinable to app identities (for example the
  column holds the rep's email, matching the app user's email).
- The app's departments are an acceptable proxy for "team" in Phase 1.
- The external bucket is GCS (matches the current storage stack); other object
  stores are a later addition behind the same storage interface.

Open questions to confirm during planning:
- Exact representation of the sync schedule (cron string vs preset) and where the
  scheduler runs (existing worker vs external cron hitting an endpoint).
- Secret storage mechanism for the source service account (secret manager vs
  encrypted-at-rest field with a server-only key).
- Whether column-type reconciliation on schema drift should auto-alter or require
  admin confirmation.

## 16. Reused vs new: file-level map

Reused/extended: `lib/app-db/{schema-manager,registry,naming}.ts`,
`lib/ai-providers/*`, `lib/prompt-registry.ts`, `lib/ai-prompt.ts`,
`app/api/ai/data-chat/route.ts`, `lib/mcp-access.ts`, `lib/permissions.ts`,
`lib/role-access-plan.ts`, `lib/file-parser.ts`, `lib/storage-provider.ts`,
`lib/dashboard-refresh-worker.ts`.

New: `lib/data-sources/{types,csv-source,registry,sync}.ts`,
`app/api/admin/data-sources/*`, dataset-chat additions in `app/api/ai/*`,
Postgres migration for `twd_dataset_reader` + RLS policy templates, storage
`list`/`read-by-key`, CSV support in `file-parser.ts`, a cron entry for sync.

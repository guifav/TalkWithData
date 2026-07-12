# Security-Critical Coverage Design

## Context

Talk With Data collects coverage for the full application, but the aggregate percentage is dominated by pages, generated code, and modules that do not have the same security impact. Several privileged or mutation-capable routes currently report zero direct coverage even though their authentication helpers are tested separately.

Issue #55 requires a gate that proves the contracts that matter without gaming a repository-wide percentage.

## Goals

- Define an explicit security-critical coverage perimeter.
- Add direct route tests for success, rejected authorization, invalid input, dependency failure, and fail-closed behavior.
- Enforce coverage thresholds for individual critical files or coherent groups.
- Keep generated code and inert test fixtures out of the metric.
- Make CI print uncovered critical lines and fail when a critical threshold regresses.
- Preserve or raise every configured threshold after it is introduced.

## Non-goals

- Reach a high global percentage by testing presentation-only branches.
- Add browser end-to-end coverage, which belongs to issue #51.
- Replace Firestore emulator tests or migration integration tests.
- Exclude difficult production code merely to improve the report.

## Critical Perimeter

### Authentication and session boundaries

- `src/lib/api-auth.ts`
- `src/lib/data-api-auth.ts`
- `src/lib/dash-session.ts`
- `src/app/api/auth/init/route.ts`

### Data API mutations

- `src/app/api/dashboards/[id]/data/[table]/route.ts`
- `src/app/api/dashboards/[id]/data/[table]/[rowId]/route.ts`

These routes require direct tests because helper coverage alone cannot prove that each HTTP method invokes authentication before table lookup or mutation.

### Dashboard view and assets

- `src/app/api/dashboards/[id]/view/route.ts`
- `src/app/api/dashboards/[id]/view/[...path]/route.ts`
- `src/app/api/dashboards/[id]/versions/[versionId]/view/route.ts`

Existing route suites remain the source of coverage for token, ownership, traversal, missing object, and storage failure paths.

### Privileged administration and secrets

- `src/app/api/admin/ai-config/route.ts`
- `src/lib/ai-config-secrets.ts`
- `src/app/api/admin/data-sources/route.ts`
- `src/app/api/admin/data-sources/[id]/route.ts`
- `src/app/api/admin/data-sources/inspect-headers/route.ts`
- `src/app/api/admin/data-sources/validation.ts`
- `src/lib/data-sources/credentials.ts`
- `src/lib/data-sources/firestore.ts`
- `src/lib/data-sources/inspection-token.ts`

### Storage and readiness

- `src/lib/storage-provider.ts`
- `src/lib/data-sources/storage.ts`
- `src/lib/readiness.ts`

Migration shell checks remain enforced by the existing `test:migrations` CI command. The TypeScript readiness helper is included in the coverage perimeter and must cover missing configuration, driver failure, timeout, pool reuse, and pool replacement.

## Testing Strategy

### Data API route contract

Use module mocks at the route boundary so tests can prove call order and arguments without a database. Cover:

- CORS preflight for sandboxed `Origin: null` requests,
- unauthorized requests for every mutation method,
- invalid and unknown table names before data access,
- successful reads, inserts, updates, and deletes,
- mutation audit records,
- invalid bodies and row limits,
- dependency failures returning generic 500 responses without mutation success.

Request bodies that are null, arrays, or missing the required object shape must fail with HTTP 400 instead of becoming internal errors.

### AI configuration route contract

Cover forbidden GET and PUT, successful metadata GET, strict non-empty string `uid` validation, required `aiConfig`, successful storage, typed `AiConfigSecretError` propagation, and sanitized unexpected failures.

### Threshold model

Vitest v4 supports glob-specific coverage thresholds. The configuration will:

1. keep the full text and JSON summary reporters,
2. exclude generated Prisma code,
3. set thresholds on the critical files and coherent route groups,
4. choose initial values below or equal to proven coverage with a small stability margin for instrumentation differences,
5. reject any later reduction that is made only to turn CI green.

Thresholds are a floor, not a target. New reachable branches in critical files require tests in the same pull request.

## Failure Semantics

- Authorization failure returns 401 or 403 before registry, database, or secret writes.
- Invalid client input returns 400.
- Missing scoped resources return 404.
- Dependency failures return a generic 500 response and do not expose internal error material.
- Audit failure is treated as mutation failure because a successful mutation without its required audit record is not reported as success.

## CI Contract

`npm run test:coverage` remains the canonical gate. Its text reporter lists uncovered critical lines, and Vitest exits non-zero when any critical threshold is missed. The existing GitHub Actions job already runs this command before the production build.

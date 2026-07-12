# Security-Critical Coverage Implementation Plan

> Execute each implementation step with test-driven development and rerun the complete repository validation before E4 review.

**Goal:** Close issue #55 with direct negative and success coverage for critical routes plus enforceable coverage floors for the security perimeter.

**Tech stack:** Vitest 4, V8 coverage, Next.js route handlers, TypeScript 6.

---

## Task 1: Lock the design and baseline

**Files:**

- Add: `docs/superpowers/specs/2026-07-12-critical-coverage-design.md`
- Add: `docs/superpowers/plans/2026-07-12-critical-coverage.md`
- Inspect: `app/coverage/coverage-summary.json`
- Inspect: `app/vitest.config.ts`

- [x] Record the critical perimeter and current per-file coverage.
- [x] Confirm Vitest glob thresholds from the installed type definitions.
- [x] Commit the design and plan before implementation.

## Task 2: Cover privileged AI configuration routes

**Files:**

- Add: `app/src/lib/__tests__/ai-config-route.test.ts`
- Modify if required by a failing test: `app/src/app/api/admin/ai-config/route.ts`

- [x] Write failing tests for forbidden GET and PUT, successful GET, invalid `uid`, missing `aiConfig`, success, typed secret errors, and unexpected failures.
- [x] Run the focused test and confirm RED.
- [x] Implement only the input or boundary fixes demonstrated by the tests.
- [x] Run the focused test and confirm GREEN.

## Task 3: Cover Data API table routes

**Files:**

- Add: `app/src/lib/__tests__/data-api-routes.test.ts`
- Modify if required by failing tests: `app/src/app/api/dashboards/[id]/data/[table]/route.ts`
- Modify if required by failing tests: `app/src/app/api/dashboards/[id]/data/[table]/[rowId]/route.ts`

- [x] Write failing tests for preflight, authorization, table validation, table scope, successful reads and mutations, audit calls, invalid bodies, row limits, and dependency failures.
- [x] Confirm that unauthorized mutations never call registry or database helpers.
- [x] Reject null and array bodies with HTTP 400.
- [x] Run the focused route suite and confirm GREEN.

## Task 4: Complete readiness fail-closed coverage

**Files:**

- Modify: `app/src/lib/__tests__/readiness.test.ts`
- Modify: `app/src/lib/__tests__/role-contract-routes.test.ts`
- Modify only if tests expose a defect: `app/src/lib/readiness.ts`

- [x] Cover missing `DATABASE_URL`.
- [x] Cover pool reuse for unchanged configuration.
- [x] Cover pool replacement and safe cleanup when connection or timeout changes.
- [x] Preserve driver failure and timeout coverage.
- [x] Cover unauthenticated, missing-user, idempotent, and pending-role initialization paths.

## Task 5: Enforce critical thresholds

**Files:**

- Modify: `app/vitest.config.ts`
- Modify: `docs/superpowers/plans/2026-07-12-critical-coverage.md`

- [x] Exclude `src/generated/**` from coverage.
- [x] Add glob-specific thresholds for every critical file or coherent group in the design.
- [x] Choose floors from the new measured baseline with a stability margin, never by lowering a failed gate.
- [x] Run `npm run test:coverage` and confirm the report lists uncovered critical lines and passes all thresholds.
- [x] Temporarily raise one threshold above the measured result to prove the command fails, then restore the justified floor.

## Task 6: Full validation and E4

- [x] Run `npm run lint -- --max-warnings=0`.
- [x] Run `npm run typecheck`.
- [x] Run `npm test`.
- [x] Run `npm run test:coverage`.
- [x] Run `npm run build`.
- [ ] Push a ready PR closing issue #55.
- [ ] Attempt fresh Codex 5.6 Sol max, Claude Opus 4.8 max, and Kimi k2.7-code reviews on the same pinned SHA.
- [ ] Reproduce and fix every P0, P1, and P2 through RED-GREEN, then repeat E4.
- [ ] Merge only with at least two usable approvals and green CI.

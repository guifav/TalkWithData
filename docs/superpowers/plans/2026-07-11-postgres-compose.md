# PostgreSQL Compose Implementation Plan

> Execute this plan through the repository dev workflow, with one branch and one
> pull request for issue #48.

**Goal:** Provision PostgreSQL and a one-shot Prisma migration gate in Docker
Compose, with executable proof of fresh startup, idempotency, data persistence,
and fail-closed migration behavior.

**Architecture:** Add a dedicated Docker `migrator` target. Compose starts a
pinned PostgreSQL image, gates the migrator on database health, and gates the
application on successful migrator completion.

**Stack:** Docker Compose, PostgreSQL 16 Alpine, Prisma 7, POSIX shell.

### Task 1: Add the failing Compose contract test

**Files:**

- Create: `scripts/test-compose-postgres.sh`

The test must isolate its project name and host port, generate only synthetic
runtime values, and clean up through a trap. It must fail against the current
single-service Compose file.

### Task 2: Add the migrator image and Compose dependency graph

**Files:**

- Modify: `app/Dockerfile`
- Modify: `docker-compose.yml`

Add a `migrator` target with the Prisma CLI, config, schema, and migrations. Add
the pinned `db` service, named volume, bounded healthcheck, one-shot `migrate`
service, internal database URL overrides, and successful-completion dependency
for `app`.

### Task 3: Prove startup and failure semantics

**Files:**

- Modify: `scripts/test-compose-postgres.sh`

Run a fresh startup, assert application health and applied migrations, insert a
sentinel row, stop and restart, assert exactly one migration invocation per
startup and preserved data, then override the migration command to fail and
assert the app remains stopped.

### Task 4: Document operator workflows

**Files:**

- Modify: `README.md`
- Modify: `README.pt-BR.md`
- Modify: `docs/DEPLOYMENT.md`
- Modify: `app/.env.example`

Document Compose start, status, reset, migration logs, default development
credentials, override alignment, and recovery from migration failures.

### Task 5: Validate and publish

Run Compose config validation, the Compose smoke test, lint, typecheck, the full
test suite, production build, `git diff --check`, and secret-pattern scans.
Commit conventionally, open a pull request closing #48, then run E4 at the exact
head with GPT 5.6 Sol max, Claude Opus 4.8 max, and Kimi k2.7-code. Two
conclusive validators are sufficient only after all three are attempted. Do not
merge with any unresolved P0, P1, or P2, or with red CI.

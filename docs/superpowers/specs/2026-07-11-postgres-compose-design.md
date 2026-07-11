# PostgreSQL Compose Startup Design

## Goal

Make the repository Compose stack self-contained for local and self-hosted
development by provisioning PostgreSQL, applying checked-in Prisma migrations,
and starting the application only after migration success.

## Startup contract

Compose owns three services:

1. `db` starts PostgreSQL 16 with documented development credentials and a
   named data volume.
2. `migrate` waits for the bounded PostgreSQL healthcheck, runs
   `prisma migrate deploy` once, and exits.
3. `app` starts only when `migrate` exits successfully.

The application healthcheck remains an HTTP liveness signal. Database startup
readiness is enforced by the database healthcheck and migration dependency, not
by weakening `/api/health` into an implicit migration runner.

## Images and configuration

The production application image remains the minimal Next.js standalone
runner. A dedicated `migrator` Docker target installs the Prisma CLI and copies
only the Prisma configuration, schema, and migration history needed by
`prisma migrate deploy`.

`app/.env` remains the canonical application environment file. Compose
overrides its host-oriented `DATABASE_URL` with the internal `db` hostname for
both `app` and `migrate`. The migration container receives no unrelated
application secrets.

Development database defaults are:

- user: `talkwithdata`
- password: `talkwithdata`
- database: `talkwithdata`
- internal host: `db`

Operators may override the PostgreSQL variables and `COMPOSE_DATABASE_URL`, but
the credentials and URL must remain aligned. These defaults are for local and
trusted self-hosted development, not an internet-exposed production database.

## Failure behavior

- PostgreSQL that never becomes healthy exhausts a finite retry budget.
- A nonzero migration exit prevents Compose from starting `app`.
- `migrate` has no restart policy, so a broken migration cannot loop silently.
- A normal second startup reruns the one-shot job. Prisma detects the applied
  history, exits successfully without reapplying migrations, and preserved data
  remains in the named volume.

## Verification

An executable Compose smoke test will use an isolated project name, port, and
synthetic application environment. It will prove:

1. A fresh named volume reaches a healthy application with all migrations
   applied.
2. A second startup runs the migration job exactly once again, leaves the
   migration count unchanged, and preserves a sentinel database row.
3. An intentionally failing migration command exits nonzero and the application
   does not start or report readiness.

The test always removes its isolated containers, network, and volumes.

## Out of scope

Cloud Run migration jobs and production dependency orchestration remain tracked
separately. This change does not turn the HTTP liveness route into a database
probe and does not wire the local storage adapter.

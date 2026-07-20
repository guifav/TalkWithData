# Roadmap

This roadmap is a planning document for the open-source repository. It is not a
promise to ship a feature on a specific date. Scope can change when security,
maintainability, release readiness, or maintainer availability changes.

## Committed before the first public release

These items are required before the first tagged public release:

- Security disclosure path enabled and documented.
- Dashboard HTML direct-view isolation with CSP sandbox headers.
- CI gates for app lint, typecheck, tests, build, and thumbnail function build.
- Zero-warning lint policy in CI.
- Production dependency audit with no known production vulnerabilities.
- Governance, support, contribution, and roadmap policies.
- Versioning, changelog, release, and rollback process.
- Provenance and third-party notice review, with owner confirmation for the
  chosen license.
- Data inventory, privacy, retention, and storage documentation.
- Environment contract reconciled across README, `app/.env.example`, Docker, and
  deployment docs.
- Reproducible setup checks for PostgreSQL, Firebase, migrations, and Docker.

## Planned next

The previously planned hardening items shipped and are recorded in the
[changelog](CHANGELOG.md): pinned CI actions and images, Firestore rules and
Prisma migration testing in CI, Docker image smoke tests, security-critical
coverage, Playwright journeys, wired local dashboard storage, encrypted
server-only AI provider keys, and encrypted data-source credential
onboarding. New committed work areas are added here as they are accepted.

## Ideas, not commitments

These ideas need more design, evidence, or maintainer capacity before they are
commitments:

- The use-case directions recorded in
  [docs/USE-CASES-ROADMAP.md](docs/USE-CASES-ROADMAP.md), including external
  client distribution, additional governed source adapters, and embed
  hardening.
- Hosted demo data for neutral screenshots and walkthroughs.
- Expanded observability for self-hosted production instances.
- Richer admin analytics and audit trails.
- More automated release provenance and artifact attestations.
- PT-BR and additional UI locales through an explicit i18n implementation.

## Release policy

The first public release requires explicit maintainer authorization. A release
should only be published from an authorized merged commit with green required CI,
reviewed release notes, and a completed release-readiness checklist.

The security supported-version policy lives in [SECURITY.md](SECURITY.md). If
tagged releases are introduced, that file must be updated before the release is
published.

## Roadmap updates

Roadmap changes should happen through pull requests. Material changes should
link to the issue or decision that caused the update.

# Changelog

All notable public release changes are recorded here.

This project uses SemVer. The application package version, release tag, and
GitHub Release must all use the same `vMAJOR.MINOR.PATCH` version and point to
the same merged `main` commit.

## [Unreleased]

- Documented the single-organization internal-use positioning in both
  READMEs, added the internal BI portal setup guide, and added the use case
  roadmap.

## [0.2.0] - Pending owner authorization

Automated public release candidate.

### Added

- Public setup, contribution, governance, support, security, privacy, and
  deployment documentation.
- Runtime Firebase configuration, local storage support, PostgreSQL Compose
  validation, Cloud Run deployment guidance, and Docker image smoke coverage.
- Primary Playwright journeys, critical contract coverage, redacted
  observability, and Firestore rules validation.
- Provenance, third-party notices, deterministic locked license inventory, and
  per-artifact license bundles for release artifacts.
- Versioned release policy, release readiness gate, generated release notes,
  checksum manifest, and protected manual GitHub Release workflow.

### Security

- Server-only AI provider secret handling and migration guidance.
- CI dependency pin review and container image digest checks.
- Release publication remains blocked until the owner authorization gate in
  `PROVENANCE.md` is completed.

## Update Process

1. Add user-facing changes under `Unreleased` while development is in progress.
2. Before a release, move reviewed entries into the target version section.
3. Keep the version in `app/package.json`,
   `app/migrator/package.json`,
   `functions/generate-thumbnail/package.json`, their lockfiles, the Git tag,
   and the GitHub Release aligned. Never reuse an existing remote `v*` tag.
4. Run `node scripts/check-release-readiness.mjs --version <version>
   --require-complete-checklist --require-owner-authorization
   --owner-authorization-url <url>` before publishing.
5. Attach generated release notes and `CHECKSUMS.txt` from
   `node scripts/prepare-release.mjs --version <version>`.

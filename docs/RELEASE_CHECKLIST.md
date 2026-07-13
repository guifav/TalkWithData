# Release Readiness Checklist

This checklist intentionally starts incomplete. Complete it in a reviewed PR
before running the first non-dry-run release.

- [ ] Owner authorization is recorded in `PROVENANCE.md` with a permanent
  GitHub issue comment URL.
- [ ] `CHANGELOG.md` has reviewed entries for the release version.
- [ ] `node scripts/check-release-readiness.mjs --version 0.2.0
  --require-complete-checklist --require-owner-authorization
  --owner-authorization-url <url>` passes locally.
- [ ] GitHub CI is green on the exact `main` commit to release.
- [ ] Generated release notes were reviewed against Git history.
- [ ] `CHECKSUMS.txt` was generated from the release artifacts.
- [ ] Rollback or revocation owner is identified before publication.

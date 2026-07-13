# Release Process

Talk With Data releases are source-controlled, versioned, and provenance-gated.
The first public release version is `0.1.0`.

## Versioning Policy

- Use SemVer: `MAJOR.MINOR.PATCH`.
- The Git tag is `vMAJOR.MINOR.PATCH`.
- `app/package.json`, `app/package-lock.json`,
  `functions/generate-thumbnail/package.json`, and
  `functions/generate-thumbnail/package-lock.json` must all carry the same
  version.
- The Git tag and GitHub Release must point to the exact same merged `main`
  commit.
- Release candidates can be prepared before publication, but publication is
  blocked until the owner authorization gate and checklist are complete.

## Required Gates

Release candidate preparation checks package versions, changelog coverage, the
merged `main` commit, and required CI. Release publication fails unless all of
these are true:

1. The release commit is the current `origin/main` commit.
2. Required CI workflows passed for that commit.
3. `CHANGELOG.md` contains an entry for the requested version.
4. `docs/RELEASE_CHECKLIST.md` contains no unchecked items.
5. `PROVENANCE.md` no longer says `Status: **not yet received**`.
6. The owner authorization URL is a permanent GitHub issue or comment URL and
   is present in `PROVENANCE.md`.
7. The generated release notes and checksums are attached to the GitHub Release.

The gate is implemented by `scripts/check-release-readiness.mjs`. Release notes,
the source archive, optional thumbnail function package archive, and
`CHECKSUMS.txt` are produced by `scripts/prepare-release.mjs`.

## Manual Release Workflow

Use the `Release` GitHub Actions workflow from `main`.

Inputs:

- `version`: SemVer without a leading `v`, for example `0.1.0`.
- `owner_authorization_url`: the permanent GitHub issue or comment URL recorded
  in `PROVENANCE.md`.
- `dry_run`: leave enabled to produce release artifacts without creating a tag
  or GitHub Release. Dry runs do not require the owner authorization gate.

The workflow verifies readiness, packages the thumbnail function with bundled
licenses, creates release notes and checksums, uploads a release candidate
artifact, then only when `dry_run` is false:

1. verifies the completed checklist and owner authorization URL;
2. creates annotated tag `v<version>` on the checked-out `main` commit;
3. pushes the tag;
4. creates the GitHub Release from that tag;
5. attaches generated artifacts and `CHECKSUMS.txt`; and
6. verifies that the tag and release exist for the same commit.

## Reviewed History Notes

`scripts/prepare-release.mjs` generates release notes from reviewed Git history.
For the first release, the range is the full public history. For later releases,
the range starts after the previous `v*` tag.

Review generated notes before publishing. They are evidence for the release, not
a replacement for the changelog.

## Rollback and Revocation

If a bad release is published:

1. Stop rollout or redeploy the previous known-good image digest.
2. Mark the GitHub Release as `prerelease` or delete it when distribution must
   stop.
3. Delete the Git tag only when revocation is required and record why in a new
   issue.
4. Rotate any exposed credentials or revoke affected artifacts.
5. Publish a corrective release from a new merged `main` commit. Do not retag a
   different commit with the same version.

Do not overwrite release assets in place. Publish a new version with a new
checksum manifest.

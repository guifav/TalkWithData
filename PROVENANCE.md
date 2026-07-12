# Project provenance and release authorization

This document records the engineering evidence used to assess whether Talk
With Data can be published and redistributed. It does not provide legal advice
and does not replace written confirmation from the relevant rights holders.

## Current release status

Release is blocked until the repository owner posts the confirmation in
[issue #58](https://github.com/guifav/TalkWithData/issues/58) and this file
links to that permanent GitHub comment.

The required owner statement is:

> I confirm that I own or control the rights needed to publish the original
> Talk With Data code and repository-authored assets, including material derived
> from the prior internal application, or have permission from the relevant
> rights holders. I authorize their release in this repository under the MIT
> License. I also confirm the relationship of the historical Git identities
> listed below to that authorization.

Status: **not yet received**. Do not replace this status with an inferred or
agent-authored confirmation.

## Repository history

- The public Git history starts with an empty repository and then an initial
  import from a prior application on 2026-06-26.
- Later commits generalized configuration, branding, deployment, storage, AI
  providers, security boundaries, tests, and public documentation.
- This provenance description deliberately does not name or describe the prior
  internal application. It records only what is necessary for release review.
- The history itself proves who committed a change. It does not prove ownership,
  employment assignment, permission from another organization, or a chain of
  title. That is why the owner statement above is a release gate.

## Authorship evidence

The Git history currently contains these author identities:

- `Guilherme Favaron <guifav@gmail.com>`
- `Guilherme Favaron <109181842+guifav@users.noreply.github.com>`
- `vardo-guifav <vardo-guifav@proton.me>`
- `nightcityblade <nightcityblade@gmail.com>`
- `dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>`

Multiple email addresses or account names must not be assumed to represent the
same person. The owner confirmation must identify whether `vardo-guifav` and
`nightcityblade` are controlled by the owner, acted with authorization, or need
separate permission. Dependabot commits contain dependency metadata changes and
do not establish ownership of upstream packages.

## MIT copyright notice review

The root [LICENSE](LICENSE) currently says:

```text
Copyright (c) 2026 Guilherme Favaron
```

That notice accurately identifies the repository owner but cannot, by itself,
resolve rights in the initial import or contributions under other Git
identities. It remains unchanged until the owner confirmation identifies the
correct attribution. A future change to `Talk With Data contributors` or a list
of additional holders must be based on that evidence, not on commit counts.

## Repository-authored and bundled assets

| Asset | Origin evidence | Redistribution assessment |
| --- | --- | --- |
| `docs/banner.svg` | Added by Guilherme Favaron in PR #72. Uses SVG primitives and system font names. | Covered only after the owner statement confirms repository-authored assets. |
| `app/e2e/fixtures/neutral-dashboard.html` | Added by Guilherme Favaron in PR #85 as synthetic test content. | No organization, customer, or personal material found. Covered by the owner statement. |
| `app/e2e/fixtures/neutral-sales.csv` | Added by Guilherme Favaron in PR #85 with `example.com` identities and synthetic values. | Neutral fixture, covered by the owner statement. |
| `app/e2e/fixtures/readme-demo-dashboard.html` | Added by Guilherme Favaron in PR #90 as a synthetic dashboard rendered by the isolated screenshot workflow. | No organization, customer, or personal material found. Covered by the owner statement. |
| `docs/screenshots/*.png` | Generated in PR #90 by `app/e2e/readme-screenshots.spec.ts` from the local PostgreSQL and Firebase emulator stack using fixed time, neutral fixtures, and `example.com` identities. | No real organization content found. The captures contain repository UI plus Lucide icons and Inter glyphs whose notices are preserved in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Repository-authored portions are covered only after the owner statement. |
| `app/public/favicon.svg` | Present in the initial import. Its geometry is the Lucide `layout-dashboard` icon. | Redistributed under Lucide's ISC license. The required notice is in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). |
| Inter font files in Next.js builds | `app/src/app/layout.tsx` imports `Inter` from `next/font/google`; Next.js self-hosts the resulting font files in build output. | Inter is under SIL OFL 1.1. The copyright and license are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). |

No tracked videos, PDFs, or standalone font binaries were found at the time of
this review. The tracked raster screenshots are limited to the five generated
files listed above.

## Dependency and notice evidence

- [docs/THIRD-PARTY-LICENSES.md](docs/THIRD-PARTY-LICENSES.md) is generated from
  every committed npm lockfile discovered through Git and includes their
  SHA-256 values. The repository currently has three such lockfiles.
- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) records notices for direct
  assets and locked packages whose license or upstream notice calls for
  attribution or preservation.
- `scripts/third-party-license-overrides.json` contains only reviewed corrections
  for old packages whose lock metadata omitted a license but whose npm tarball
  includes a license file. The generator rejects missing evidence, invalid SPDX
  expressions, unexpected fields, and unused overrides. Overrides must never be
  used to guess a license.
- `node scripts/generate-third-party-licenses.mjs --check --fail-on-unknown`
  is the release gate. It intentionally fails if any license is `UNKNOWN`.
- The review originally found `buffers@0.1.1` without a declared license. The
  locked `unzipper` override was upgraded from the legacy `0.10` chain to MIT
  licensed `unzipper@0.12.5`, removing `buffers` from the graph. An ExcelJS XLSX
  round-trip against both the source install and the generated standalone
  artifact validates the replacement in CI.

The locked graph is broader than a particular source archive, container, or
standalone Next.js build. Release automation must also inspect each produced
artifact and carry forward every license and upstream `NOTICE` file for the
packages and assets it actually redistributes.

The production application and migration containers, plus the packaged thumbnail
function source, carry the project license, this notice record, the locked
inventory, and generated per-package license bundles. The collector preserves
package-provided `LICENSE`, `NOTICE`, and `COPYING` files, and uses the declared
SPDX standard text plus package metadata only when an npm package ships no
license file. Collection fails when neither source exists or when a `WITH`
exception has no package-provided text. The runner conservatively covers its full
installed graph so client-side bundled code is included as well as externalized
server packages. CI validates all three release artifacts.

## Procedure for future additions

Every dependency, copied code fragment, generated artifact, icon, font,
screenshot, fixture, or other asset added to the repository must include:

1. its source and author or generator;
2. the license or written permission that permits redistribution;
3. any required copyright, attribution, source offer, or `NOTICE` text;
4. an explanation of modifications when the upstream license requires one;
5. a regenerated locked inventory when a package lock changes; and
6. review of the actual release artifacts, not only the source tree.

If any item is unknown, ambiguous, confidential, or cannot be redistributed,
the pull request and release remain blocked until it is removed or supported by
reviewable evidence.

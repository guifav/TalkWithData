# CI dependency pins

The CI workflow pins executable dependencies to immutable identifiers. This
makes pull request builds reviewable and prevents upstream tags from changing
the code that runs with repository access.

## Trusted actions

The workflow uses only these GitHub-owned actions:

- `actions/checkout` reads the repository contents required by the jobs.
- `actions/setup-node` installs the supported Node.js runtime and configures the
  npm cache.
- `actions/setup-java` installs the Java runtime required by the Firebase
  Emulator Suite.

They remain trusted because they are maintained in GitHub's official `actions`
organization, have a narrow purpose, and are pinned to reviewed commit SHAs.
The workflow token is also limited to `contents: read`.

## Automated updates

`.github/dependabot.yml` checks the `github-actions` ecosystem every Monday.
Dependabot pull requests must preserve the full SHA pin and update the adjacent
version comment. Reviewers should confirm that the SHA belongs to the stated
upstream version and require the normal CI jobs to pass before merging.

Dependabot also checks the Dockerfile under `app/` every Monday. The
`node:22-alpine` base image keeps its readable tag and an immutable digest, so a
runtime image update is proposed as a reviewable pull request.

The `Dependency pin review` workflow checks the PostgreSQL service and local
setup image digests every Monday. It also runs on pull requests that change a
pin source or the verification script. A moved upstream tag fails the job and
requires a pull request that reviews the new manifest before updating the pin.

Verify an action pin with the GitHub API:

```bash
gh api repos/actions/checkout/git/ref/tags/v7.0.0 --jq .object.sha
gh api repos/actions/setup-node/git/ref/tags/v6.4.0 --jq .object.sha
gh api repos/actions/setup-java/git/ref/tags/v5.5.0 --jq .object.sha
```

## Container image updates

The PostgreSQL 16 CI service and the `postgres:16-alpine` local setup examples
are pinned to multi-platform manifest digests resolved from the official images
on 2026-07-11. The `node:22-alpine` runtime image was resolved the same day and
is reviewed through the Docker Dependabot entry.

Resolve and inspect the candidate digest before changing the workflow:

```bash
docker buildx imagetools inspect docker.io/library/postgres:16
docker buildx imagetools inspect docker.io/library/postgres:16-alpine
```

After any pin update, run the workflow on a pull request. The migration check
must still apply the checked-in history to an empty PostgreSQL database, query
the expected schema, and complete a second deploy without pending migrations.

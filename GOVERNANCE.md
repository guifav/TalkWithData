# Governance

Talk With Data is maintained by Guilherme Favaron. The maintainer is responsible
for release decisions, repository settings, moderation, security handoff, and the
final decision to merge or close work.

This project is volunteer maintained. Governance policies describe how work is
handled, but they do not create a service-level agreement or guaranteed response
time.

## Maintainer ownership

The maintainer owns:

- Repository configuration, branch protection, releases, and package metadata.
- Final merge decisions for pull requests.
- Final triage decisions for issues and security-related public cleanup.
- Roadmap ordering and scope boundaries.
- Moderation decisions under [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

Contributors may propose changes, review pull requests, and help with triage.
Maintainer approval is still required before merge, release, or policy changes.

## Decision making

Decisions should be made in public issues or pull requests whenever the subject
is safe to discuss publicly. A decision is ready to act on when it has:

- A clear problem statement.
- Current repository evidence.
- A bounded scope.
- A reviewed implementation or documentation plan.
- Agreement from the maintainer when the change affects security, releases,
  policy, licensing, storage, authentication, or user data.

The maintainer may reject or defer work that is correct in isolation but too
broad, not aligned with the roadmap, under-tested, or hard to support.

## E4 merge gate

Pull requests that change runtime behavior, security posture, deployment,
governance, release readiness, user data, credentials, authentication, or stored
dashboard content must pass the E4 gate before merge:

1. Evidence: the pull request links the relevant issue or explains why no issue
   is needed.
2. Execution: the diff is focused and follows repository conventions.
3. Verification: required local checks and GitHub CI are green, or any skipped
   check is explained with a concrete reason.
4. Review: the change receives the requested review path. For high-risk changes,
   this can include multiple independent reviewers or model-assisted review.
5. Merge authorization: the maintainer approves merge. Security, release, and
   policy changes always require explicit maintainer authorization.

Small documentation or typo fixes can use a lighter review path, but the
maintainer can require the full gate at any time.

## Issue triage

Issues are triaged by impact, evidence, reproducibility, and release risk.

- P0: actively exploitable security flaw, data exposure, authentication bypass,
  or release blocker with no workaround.
- P1: high-impact bug, security hardening gap, deployment blocker, or
  open-source readiness blocker.
- P2: important product, documentation, test, or maintainability improvement.
- P3: minor polish, cleanup, or ideas that need more evidence.

Issues can be closed when they are duplicate, out of scope, missing required
evidence after follow-up, already fixed, or better tracked by a narrower issue.

Security vulnerabilities must not be triaged in public issues. Use the private
process in [SECURITY.md](SECURITY.md).

## Breaking changes

Talk With Data is pre-1.0 software. Breaking changes can happen when needed for
security, correctness, deployment reliability, or maintainability.

Breaking changes should include:

- A clear explanation in the pull request.
- Documentation updates for affected configuration, APIs, data, or deployment.
- Migration steps when users can reasonably migrate existing instances.
- Release notes when the change reaches a tagged release.

Breaking changes that affect authentication, stored data, credentials, uploads,
or public deployment instructions require maintainer approval before merge.

## Deprecation policy

Deprecated behavior should remain documented until it is removed. When practical,
deprecation should include:

- What is deprecated.
- Why it is deprecated.
- The supported replacement.
- The earliest removal point.

Immediate removal is acceptable for unsafe behavior, secrets exposure,
unsupported dependency risk, or behavior that has not shipped in a tagged
release.

## Security reporting

Do not report vulnerabilities in public support channels, issues, pull requests,
or discussions. Follow [SECURITY.md](SECURITY.md).

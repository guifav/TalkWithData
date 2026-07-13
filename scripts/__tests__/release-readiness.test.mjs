import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  assertChangelogEntry,
  assertCompleteChecklist,
  assertGithubIssueCommentUrl,
  assertLatestWorkflowRunSucceeded,
  assertOwnerAuthorizationCommentPayload,
  assertSemver,
  assertVersionManifest,
  compareSemver,
  highestSemverTag,
  isNotFound,
  parseArgs,
  parseChecklistItems,
  remoteTagCommitShaFromRef,
  remoteTagNamesFromRefs,
  REQUIRED_OWNER_STATEMENT,
  uncheckedChecklistItems,
} from "../check-release-readiness.mjs";

const releaseWorkflow = readFileSync(new URL("../../.github/workflows/release.yml", import.meta.url), "utf8");

const completeChecklist = `\
- [x] Owner authorization is recorded in \`PROVENANCE.md\` with a permanent
  GitHub issue comment URL.
- [x] \`CHANGELOG.md\` has reviewed entries for the release version.
- [x] \`CHANGELOG.md\` uses a final \`YYYY-MM-DD\` date for the release version.
- [x] \`node scripts/check-release-readiness.mjs --version 0.2.0
  --require-complete-checklist --require-owner-authorization
  --owner-authorization-url <url>\` passes locally.
- [x] GitHub CI is green on the exact \`main\` commit to release.
- [x] Generated release notes were reviewed against Git history.
- [x] \`CHECKSUMS.txt\` was generated from the release artifacts.
- [x] Rollback or revocation owner is identified before publication.
`;

test("release readiness parses explicit gate inputs", () => {
  assert.deepEqual(
    parseArgs([
      "--version",
      "0.2.0",
      "--owner-authorization-url",
      "https://github.com/guifav/TalkWithData/issues/58#issuecomment-1",
      "--checklist",
      "docs/RELEASE_CHECKLIST.md",
      "--require-merged-main",
      "--require-ci-success",
      "--required-workflow",
      "CI",
      "--require-final-changelog",
      "--require-newer-than-tags",
      "--require-tag-absent",
      "--require-github-release-absent",
      "--require-complete-checklist",
      "--require-owner-authorization",
      "--require-tag",
      "--require-github-release",
    ]),
    {
      version: "0.2.0",
      ownerAuthorizationUrl: "https://github.com/guifav/TalkWithData/issues/58#issuecomment-1",
      checklist: "docs/RELEASE_CHECKLIST.md",
      requireMergedMain: true,
      requireCiSuccess: true,
      requiredWorkflows: ["CI"],
      requireFinalChangelog: true,
      requireNewerThanTags: true,
      requireTagAbsent: true,
      requireGithubReleaseAbsent: true,
      requireCompleteChecklist: true,
      requireOwnerAuthorization: true,
      requireTag: true,
      requireGithubRelease: true,
    },
  );
});

test("release readiness rejects invalid versions and authorization URLs", () => {
  assert.doesNotThrow(() => assertSemver("0.2.0"));
  assert.throws(() => assertSemver("v0.2.0"), /SemVer/);
  assert.doesNotThrow(() =>
    assertGithubIssueCommentUrl("https://github.com/guifav/TalkWithData/issues/58#issuecomment-1"),
  );
  assert.throws(() => assertGithubIssueCommentUrl("https://github.com/guifav/TalkWithData/issues/58"), /comment/);
  assert.throws(() =>
    assertGithubIssueCommentUrl("https://github.com/guifav/TalkWithData/issues/999#issuecomment-1"),
    /issue #58/,
  );
  assert.throws(() => assertGithubIssueCommentUrl("https://example.com/issue/58"), /issue #58/);
});

test("release readiness detects incomplete checklist items", () => {
  assert.deepEqual(uncheckedChecklistItems("- [x] done\n- [ ] missing\n"), ["- [ ] missing"]);
  assert.deepEqual(uncheckedChecklistItems("* [ ] missing\n"), ["* [ ] missing"]);
  assert.deepEqual(uncheckedChecklistItems("+ [ ] missing\n"), ["+ [ ] missing"]);
  assert.deepEqual(uncheckedChecklistItems("1. [ ] missing\n"), ["1. [ ] missing"]);
  assert.deepEqual(uncheckedChecklistItems("> - [ ] missing\n"), ["> - [ ] missing"]);
  assert.deepEqual(uncheckedChecklistItems("- [ ] missing <!-- note -->\n"), ["- [ ] missing "]);
  assert.deepEqual(uncheckedChecklistItems("    - [ ] code example\n"), []);
  assert.doesNotThrow(() => assertCompleteChecklist(completeChecklist));
  assert.throws(() => assertCompleteChecklist(""), /no checklist items/);
  assert.throws(() => assertCompleteChecklist(completeChecklist.replace("- [x] GitHub CI", "- [ ] GitHub CI")), /unchecked/);
  assert.throws(() => assertCompleteChecklist(completeChecklist.replace(/- \[x\] Generated release notes.*\n/, "")), /missing/);
  assert.throws(() => assertCompleteChecklist(`${completeChecklist}- [ ] Newly added mandatory release gate\n`), /unchecked/);
  assert.throws(() => assertCompleteChecklist(`${completeChecklist}+ [ ] Newly added mandatory release gate\n`), /unchecked/);
  assert.throws(() => assertCompleteChecklist(`${completeChecklist}1. [ ] Newly added mandatory release gate\n`), /unchecked/);
  assert.throws(() => assertCompleteChecklist(`${completeChecklist}> - [ ] Newly added mandatory release gate\n`), /unchecked/);
  assert.throws(() => assertCompleteChecklist(`\`\`\`md\n${completeChecklist}\n\`\`\`\n`), /no checklist items/);
  assert.throws(() => assertCompleteChecklist(`<!--\n${completeChecklist}\n-->\n`), /no checklist items/);
});

test("release readiness parses checklist continuations", () => {
  assert.deepEqual(parseChecklistItems("- [x] first line\n  second line\n")[0], {
    checked: true,
    raw: "- [x] first line\n  second line",
    text: "first line second line",
  });
});

test("release readiness validates final changelog entries", () => {
  assert.doesNotThrow(() => assertChangelogEntry("0.2.0", "## [0.2.0] - Pending owner authorization\n"));
  assert.doesNotThrow(() =>
    assertChangelogEntry("0.2.0", "## [0.2.0] - 2026-07-13\n", { requireFinalized: true }),
  );
  assert.throws(
    () => assertChangelogEntry("0.2.0", "## [0.2.0] - Pending owner authorization\n", { requireFinalized: true }),
    /YYYY-MM-DD/,
  );
  assert.throws(
    () => assertChangelogEntry("0.2.0", "## [0.2.0] - 2026-99-99\n", { requireFinalized: true }),
    /valid YYYY-MM-DD/,
  );
});

test("release readiness compares release versions against existing tags", () => {
  assert.equal(compareSemver("0.2.0", "0.1.0"), 1);
  assert.equal(compareSemver("0.1.0", "0.2.0"), -1);
  assert.equal(compareSemver("0.2.0", "0.2.0"), 0);
  assert.equal(highestSemverTag(["v0.1.0", "not-a-version", "v0.10.0", "v0.2.0"]), "0.10.0");
  assert.deepEqual(remoteTagNamesFromRefs("refs/tags/v0.1.0\nrefs/tags/v0.10.0\n"), ["v0.1.0", "v0.10.0"]);
});

test("release readiness validates owner authorization comment payloads", () => {
  const validComment = {
    body: REQUIRED_OWNER_STATEMENT,
    author_association: "OWNER",
    issue_url: "https://api.github.com/repos/guifav/TalkWithData/issues/58",
    user: { login: "guifav" },
  };
  assert.doesNotThrow(() => assertOwnerAuthorizationCommentPayload(validComment));
  assert.throws(
    () => assertOwnerAuthorizationCommentPayload({ ...validComment, issue_url: "https://api.github.com/repos/guifav/TalkWithData/issues/59" }),
    /issue #58/,
  );
  assert.throws(
    () => assertOwnerAuthorizationCommentPayload({ ...validComment, author_association: "CONTRIBUTOR" }),
    /repository owner/,
  );
  assert.throws(
    () => assertOwnerAuthorizationCommentPayload({ ...validComment, body: "I approve" }),
    /required authorization statement/,
  );
  assert.throws(
    () => assertOwnerAuthorizationCommentPayload({ ...validComment, body: `I do not agree. Quote: ${REQUIRED_OWNER_STATEMENT}` }),
    /required authorization statement/,
  );
  assert.throws(
    () => assertOwnerAuthorizationCommentPayload({ ...validComment, body: `\`${REQUIRED_OWNER_STATEMENT}\`` }),
    /required authorization statement/,
  );
  assert.throws(
    () => assertOwnerAuthorizationCommentPayload({ ...validComment, body: REQUIRED_OWNER_STATEMENT.replace("confirm", "con_firm") }),
    /required authorization statement/,
  );
});

test("release readiness resolves remote commit and annotated tag refs", () => {
  assert.equal(remoteTagCommitShaFromRef({ object: { type: "commit", sha: "commit-sha" } }, () => null), "commit-sha");
  assert.equal(
    remoteTagCommitShaFromRef(
      { object: { type: "tag", sha: "tag-sha" } },
      (sha) => ({ object: { type: "commit", sha: `${sha}-commit` } }),
    ),
    "tag-sha-commit",
  );
});

test("release readiness distinguishes not-found from indeterminate API failures", () => {
  assert.equal(isNotFound({ stderr: "gh: Not Found (HTTP 404)" }), true);
  assert.equal(isNotFound({ stderr: "gh: Internal Server Error (HTTP 500)" }), false);
});

test("release workflow serializes publication and only cleans confirmed drafts", () => {
  assert.match(releaseWorkflow, /concurrency:\n\s+group: release-\$\{\{ github\.repository \}\}\n\s+cancel-in-progress: false/);
  assert.match(releaseWorkflow, /issues: read/);
  assert.match(releaseWorkflow, /permissions:\n\s+actions: read\n\s+contents: read\n\s+issues: read/);
  assert.match(releaseWorkflow, /publish:[\s\S]*permissions:\n\s+actions: read\n\s+contents: write\n\s+issues: read/);
  assert.match(releaseWorkflow, /gh release view "\$TAG" --json isDraft --jq \.isDraft/);
  assert.match(releaseWorkflow, /if \[ "\$is_draft" = "true" \]; then/);
  assert.match(releaseWorkflow, /git ls-remote origin "refs\/tags\/\$TAG\^\{\}"/);
});

test("release readiness paginates remote tag refs", () => {
  const readinessScript = readFileSync(new URL("../check-release-readiness.mjs", import.meta.url), "utf8");
  assert.match(readinessScript, /"gh", \["api", "--paginate", "\/repos\/guifav\/TalkWithData\/git\/matching-refs\/tags\/v"/);
});

test("release readiness requires latest workflow run to pass", () => {
  assert.doesNotThrow(() =>
    assertLatestWorkflowRunSucceeded("CI", [{ status: "completed", conclusion: "success" }]),
  );
  assert.throws(
    () =>
      assertLatestWorkflowRunSucceeded("CI", [
        { status: "in_progress", conclusion: "" },
        { status: "completed", conclusion: "success" },
      ]),
    /Latest required workflow did not pass/,
  );
  assert.throws(
    () => assertLatestWorkflowRunSucceeded("CI", []),
    /did not run/,
  );
});

test("release readiness requires all package versions to match", () => {
  assert.doesNotThrow(() =>
    assertVersionManifest("0.2.0", { app: "0.2.0", function: "0.2.0" }),
  );
  assert.throws(
    () => assertVersionManifest("0.2.0", { app: "0.2.0", function: "1.0.0" }),
    /function=1\.0\.0/,
  );
});

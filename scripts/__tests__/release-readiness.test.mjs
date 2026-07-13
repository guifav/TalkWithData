import assert from "node:assert/strict";
import test from "node:test";

import {
  assertGithubIssueOrCommentUrl,
  assertSemver,
  assertVersionManifest,
  parseArgs,
  uncheckedChecklistItems,
} from "../check-release-readiness.mjs";

test("release readiness parses explicit gate inputs", () => {
  assert.deepEqual(
    parseArgs([
      "--version",
      "0.1.0",
      "--owner-authorization-url",
      "https://github.com/guifav/TalkWithData/issues/58#issuecomment-1",
      "--checklist",
      "docs/RELEASE_CHECKLIST.md",
      "--require-merged-main",
      "--require-ci-success",
      "--required-workflow",
      "CI",
      "--require-complete-checklist",
      "--require-owner-authorization",
      "--require-tag",
      "--require-github-release",
    ]),
    {
      version: "0.1.0",
      ownerAuthorizationUrl: "https://github.com/guifav/TalkWithData/issues/58#issuecomment-1",
      checklist: "docs/RELEASE_CHECKLIST.md",
      requireMergedMain: true,
      requireCiSuccess: true,
      requiredWorkflows: ["CI"],
      requireCompleteChecklist: true,
      requireOwnerAuthorization: true,
      requireTag: true,
      requireGithubRelease: true,
    },
  );
});

test("release readiness rejects invalid versions and authorization URLs", () => {
  assert.doesNotThrow(() => assertSemver("0.1.0"));
  assert.throws(() => assertSemver("v0.1.0"), /SemVer/);
  assert.doesNotThrow(() =>
    assertGithubIssueOrCommentUrl("https://github.com/guifav/TalkWithData/issues/58#issuecomment-1"),
  );
  assert.throws(() => assertGithubIssueOrCommentUrl("https://example.com/issue/58"), /GitHub/);
});

test("release readiness detects incomplete checklist items", () => {
  assert.deepEqual(uncheckedChecklistItems("- [x] done\n- [ ] missing\n"), ["- [ ] missing"]);
});

test("release readiness requires all package versions to match", () => {
  assert.doesNotThrow(() =>
    assertVersionManifest("0.1.0", { app: "0.1.0", function: "0.1.0" }),
  );
  assert.throws(
    () => assertVersionManifest("0.1.0", { app: "0.1.0", function: "1.0.0" }),
    /function=1\.0\.0/,
  );
});

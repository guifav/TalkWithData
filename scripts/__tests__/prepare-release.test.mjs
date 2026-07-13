import assert from "node:assert/strict";
import test from "node:test";

import { formatChecksums, renderReleaseNotes } from "../prepare-release.mjs";

test("release notes include version, commit, range, gates, and reviewed commits", () => {
  const notes = renderReleaseNotes({
    version: "0.1.0",
    commit: "abc123",
    previousTag: "",
    commits: ["abc123 docs: add release process"],
  });

  assert.match(notes, /# Talk With Data v0\.1\.0/);
  assert.match(notes, /Source commit: `abc123`/);
  assert.match(notes, /full public history/);
  assert.match(notes, /Owner authorization in PROVENANCE\.md is required/);
  assert.match(notes, /abc123 docs: add release process/);
});

test("checksum manifest is sorted and stable", () => {
  assert.equal(
    formatChecksums([
      { name: "b.tar.gz", sha256: "b".repeat(64) },
      { name: "a.tar.gz", sha256: "a".repeat(64) },
    ]),
    `${"a".repeat(64)}  a.tar.gz\n${"b".repeat(64)}  b.tar.gz\n`,
  );
});

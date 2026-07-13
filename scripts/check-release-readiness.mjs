#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const REQUIRED_OWNER_STATEMENT = [
  "I confirm that I own or control the rights needed to publish the original",
  "Talk With Data code and repository-authored assets, including material derived",
  "from the prior internal application, or have permission from the relevant",
  "rights holders. I authorize their release in this repository under the MIT",
  "License. I also confirm the relationship of the historical Git identities",
  "listed below to that authorization.",
].join(" ");

const REQUIRED_CHECKLIST_ITEMS = [
  "Owner authorization is recorded in PROVENANCE.md with a permanent GitHub issue comment URL.",
  "CHANGELOG.md has reviewed entries for the release version.",
  "CHANGELOG.md uses a final YYYY-MM-DD date for the release version.",
  "node scripts/check-release-readiness.mjs --version",
  "GitHub CI is green on the exact main commit to release.",
  "Generated release notes were reviewed against Git history.",
  "CHECKSUMS.txt was generated from the release artifacts.",
  "Rollback or revocation owner is identified before publication.",
];

export function parseArgs(argv) {
  const args = {
    requiredWorkflows: [],
    checklist: "docs/RELEASE_CHECKLIST.md",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--version") args.version = argv[++index];
    else if (value === "--owner-authorization-url") args.ownerAuthorizationUrl = argv[++index];
    else if (value === "--checklist") args.checklist = argv[++index];
    else if (value === "--required-workflow") args.requiredWorkflows.push(argv[++index]);
    else if (value === "--require-merged-main") args.requireMergedMain = true;
    else if (value === "--require-ci-success") args.requireCiSuccess = true;
    else if (value === "--require-complete-checklist") args.requireCompleteChecklist = true;
    else if (value === "--require-owner-authorization") args.requireOwnerAuthorization = true;
    else if (value === "--require-final-changelog") args.requireFinalChangelog = true;
    else if (value === "--require-newer-than-tags") args.requireNewerThanTags = true;
    else if (value === "--require-tag") args.requireTag = true;
    else if (value === "--require-tag-absent") args.requireTagAbsent = true;
    else if (value === "--require-github-release") args.requireGithubRelease = true;
    else if (value === "--require-github-release-absent") args.requireGithubReleaseAbsent = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

export function assertSemver(version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version ?? "")) {
    throw new Error("Release version must be SemVer without a leading v");
  }
}

export function assertGithubIssueCommentUrl(url) {
  const pattern = /^https:\/\/github\.com\/guifav\/TalkWithData\/issues\/58#issuecomment-\d+$/;
  if (!pattern.test(url ?? "")) {
    throw new Error("Owner authorization URL must be a permanent TalkWithData issue #58 comment URL");
  }
}

function normalizeText(value) {
  return value
    .replace(/[`*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseChecklistItems(markdown) {
  const items = [];
  let current = null;
  for (const line of markdown.split(/\r?\n/)) {
    const match = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (match) {
      current = {
        checked: match[1].toLowerCase() === "x",
        raw: line,
        text: match[2],
      };
      items.push(current);
    } else if (current && /^\s{2,}\S/.test(line)) {
      current.text += ` ${line.trim()}`;
      current.raw += `\n${line}`;
    } else if (line.trim() !== "") {
      current = null;
    }
  }
  return items;
}

export function uncheckedChecklistItems(markdown) {
  return parseChecklistItems(markdown)
    .filter((item) => !item.checked)
    .map((item) => item.raw);
}

export function assertCompleteChecklist(markdown) {
  const items = parseChecklistItems(markdown);
  if (items.length === 0) {
    throw new Error("Release checklist has no checklist items");
  }

  const normalizedItems = items.map((item) => ({
    checked: item.checked,
    raw: item.raw,
    text: normalizeText(item.text),
  }));
  const missingItems = [];
  const uncheckedItems = normalizedItems.filter((item) => !item.checked).map((item) => item.raw);
  for (const required of REQUIRED_CHECKLIST_ITEMS) {
    const match = normalizedItems.find((item) => item.text.includes(required));
    if (!match) missingItems.push(required);
  }

  if (missingItems.length > 0) {
    throw new Error(`Release checklist is missing required items:\n${missingItems.join("\n")}`);
  }
  if (uncheckedItems.length > 0) {
    throw new Error(`Release checklist has unchecked items:\n${uncheckedItems.join("\n")}`);
  }
}

export function assertVersionManifest(version, manifest) {
  const mismatches = Object.entries(manifest).filter(([, actual]) => actual !== version);
  if (mismatches.length > 0) {
    const rendered = mismatches.map(([name, actual]) => `${name}=${actual}`).join(", ");
    throw new Error(`Package versions do not match ${version}: ${rendered}`);
  }
}

export function compareSemver(left, right) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] > rightParts[index]) return 1;
    if (leftParts[index] < rightParts[index]) return -1;
  }
  return 0;
}

export function highestSemverTag(tags) {
  return tags
    .map((tag) => tag.match(/^v((0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*))$/)?.[1])
    .filter(Boolean)
    .sort(compareSemver)
    .at(-1);
}

export function assertChangelogEntry(version, changelog, options = {}) {
  const escapedVersion = version.replace(/\./g, "\\.");
  const heading = changelog.match(new RegExp(`^## \\[${escapedVersion}\\] - (.+)$`, "m"));
  if (!heading) {
    throw new Error(`CHANGELOG.md does not contain a ${version} entry`);
  }
  if (options.requireFinalized) {
    const date = heading[1];
    const parsed = new Date(`${date}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== date
    ) {
      throw new Error(`CHANGELOG.md ${version} entry must use a finalized valid YYYY-MM-DD release date`);
    }
  }
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
}

function packageVersionManifest() {
  return {
    "app/package.json": readJson("app/package.json").version,
    "app/package-lock.json": readJson("app/package-lock.json").version,
    "app/package-lock root": readJson("app/package-lock.json").packages[""].version,
    "app/migrator/package.json": readJson("app/migrator/package.json").version,
    "app/migrator/package-lock.json": readJson("app/migrator/package-lock.json").version,
    "app/migrator/package-lock root": readJson("app/migrator/package-lock.json").packages[""].version,
    "functions/generate-thumbnail/package.json": readJson("functions/generate-thumbnail/package.json").version,
    "functions/generate-thumbnail/package-lock.json": readJson("functions/generate-thumbnail/package-lock.json").version,
    "functions/generate-thumbnail/package-lock root": readJson("functions/generate-thumbnail/package-lock.json").packages[""].version,
  };
}

function run(command, args) {
  return execFileSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function runJson(command, args) {
  return JSON.parse(run(command, args));
}

function assertMergedMain() {
  run("git", ["fetch", "--quiet", "origin", "main", "--tags"]);
  const head = run("git", ["rev-parse", "HEAD"]);
  const originMain = run("git", ["rev-parse", "origin/main"]);
  if (head !== originMain) {
    throw new Error(`Release commit must be origin/main. HEAD=${head} origin/main=${originMain}`);
  }
}

function remoteTagRef(version) {
  return runJson("gh", ["api", `/repos/guifav/TalkWithData/git/ref/tags/v${version}`]);
}

function remoteTagCommitSha(version) {
  const ref = remoteTagRef(version);
  if (ref.object?.type === "commit") return ref.object.sha;
  if (ref.object?.type === "tag") {
    const tag = runJson("gh", ["api", `/repos/guifav/TalkWithData/git/tags/${ref.object.sha}`]);
    if (tag.object?.type === "commit") return tag.object.sha;
  }
  throw new Error(`Remote tag v${version} does not resolve to a commit`);
}

function isNotFound(error) {
  const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
  const stdout = error && typeof error === "object" && "stdout" in error ? String(error.stdout) : "";
  return /HTTP 404|Not Found/i.test(`${stderr}\n${stdout}`);
}

function assertRemoteTag(version) {
  const head = run("git", ["rev-parse", "HEAD"]);
  const tag = remoteTagCommitSha(version);
  if (head !== tag) throw new Error(`Tag v${version} does not point to HEAD`);
}

function assertRemoteTagAbsent(version) {
  try {
    remoteTagRef(version);
  } catch (error) {
    if (isNotFound(error)) return;
    throw new Error(`Could not verify remote tag absence for v${version}: ${error}`);
  }
  throw new Error(`Remote tag v${version} already exists`);
}

function assertNewerThanTags(version) {
  const refs = run("gh", ["api", "--paginate", "/repos/guifav/TalkWithData/git/matching-refs/tags/v", "--jq", ".[].ref"])
      .split(/\r?\n/)
      .filter(Boolean)
      .map((ref) => ref.replace(/^refs\/tags\//, ""));
  const highest = highestSemverTag(refs);
  if (highest && compareSemver(version, highest) <= 0) {
    throw new Error(`Release version ${version} must be greater than existing remote tag v${highest}`);
  }
}

function assertGithubRelease(version) {
  run("gh", ["release", "view", `v${version}`, "--json", "tagName,url"]);
}

function assertGithubReleaseAbsent(version) {
  try {
    run("gh", ["api", `/repos/guifav/TalkWithData/releases/tags/v${version}`, "--jq", ".tag_name"]);
  } catch (error) {
    const stderr = error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
    const stdout = error && typeof error === "object" && "stdout" in error ? String(error.stdout) : "";
    if (isNotFound(error)) return;
    throw new Error(`Could not verify GitHub Release absence for v${version}: ${stderr || stdout || error}`);
  }
  throw new Error(`GitHub Release v${version} already exists`);
}

function assertCiSuccess(requiredWorkflows) {
  const workflows = requiredWorkflows.length > 0 ? requiredWorkflows : ["CI"];
  const head = run("git", ["rev-parse", "HEAD"]);
  for (const workflow of workflows) {
    const runs = runJson("gh", [
      "run",
      "list",
      "--workflow",
      workflow,
      "--commit",
      head,
      "--status",
      "completed",
      "--json",
      "conclusion,databaseId",
      "--limit",
      "10",
    ]);
    if (!runs.some((runResult) => runResult.conclusion === "success")) {
      throw new Error(`Required workflow did not pass for ${head}: ${workflow}`);
    }
  }
}

function ownerCommentId(url) {
  return url.match(/^https:\/\/github\.com\/guifav\/TalkWithData\/issues\/58#issuecomment-(\d+)$/)?.[1];
}

function assertOwnerAuthorizationComment(url) {
  const commentId = ownerCommentId(url);
  if (!commentId) assertGithubIssueCommentUrl(url);
  const comment = runJson("gh", [
    "api",
    `/repos/guifav/TalkWithData/issues/comments/${commentId}`,
    "--jq",
    "{body,author_association,issue_url,user:{login:.user.login}}",
  ]);
  if (comment.issue_url !== "https://api.github.com/repos/guifav/TalkWithData/issues/58") {
    throw new Error("Owner authorization URL must point to issue #58");
  }
  if (comment.author_association !== "OWNER" || comment.user?.login !== "guifav") {
    throw new Error("Owner authorization comment must be authored by the repository owner");
  }
  if (!normalizeText(comment.body ?? "").includes(normalizeText(REQUIRED_OWNER_STATEMENT))) {
    throw new Error("Owner authorization comment does not contain the required authorization statement");
  }
}

export function runReadiness(options) {
  assertSemver(options.version);
  assertVersionManifest(options.version, packageVersionManifest());

  const changelog = readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
  assertChangelogEntry(options.version, changelog, { requireFinalized: options.requireFinalChangelog });

  if (options.requireCompleteChecklist) {
    assertCompleteChecklist(readFileSync(path.join(root, options.checklist), "utf8"));
  }

  if (options.requireOwnerAuthorization) {
    assertGithubIssueCommentUrl(options.ownerAuthorizationUrl);
    assertOwnerAuthorizationComment(options.ownerAuthorizationUrl);
    const provenance = readFileSync(path.join(root, "PROVENANCE.md"), "utf8");
    if (provenance.includes("Status: **not yet received**")) {
      throw new Error("PROVENANCE.md still marks owner authorization as not received");
    }
    if (!provenance.includes(options.ownerAuthorizationUrl)) {
      throw new Error("PROVENANCE.md does not contain the owner authorization URL");
    }
  } else if (options.ownerAuthorizationUrl) {
    assertGithubIssueCommentUrl(options.ownerAuthorizationUrl);
  }

  if (options.requireMergedMain) assertMergedMain();
  if (options.requireCiSuccess) assertCiSuccess(options.requiredWorkflows);
  if (options.requireNewerThanTags) assertNewerThanTags(options.version);
  if (options.requireTagAbsent) assertRemoteTagAbsent(options.version);
  if (options.requireGithubReleaseAbsent) assertGithubReleaseAbsent(options.version);
  if (options.requireTag) assertRemoteTag(options.version);
  if (options.requireGithubRelease) assertGithubRelease(options.version);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    runReadiness(parseArgs(process.argv.slice(2)));
    console.log("Release readiness checks passed");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

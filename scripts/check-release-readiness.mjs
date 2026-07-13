#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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
    else if (value === "--require-tag") args.requireTag = true;
    else if (value === "--require-github-release") args.requireGithubRelease = true;
    else throw new Error(`Unknown argument: ${value}`);
  }
  return args;
}

export function assertSemver(version) {
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version ?? "")) {
    throw new Error("Release version must be SemVer without a leading v");
  }
}

export function assertGithubIssueOrCommentUrl(url) {
  const pattern = /^https:\/\/github\.com\/guifav\/TalkWithData\/issues\/\d+(#issuecomment-\d+)?$/;
  if (!pattern.test(url ?? "")) {
    throw new Error("Owner authorization URL must be a permanent TalkWithData GitHub issue or comment URL");
  }
}

export function uncheckedChecklistItems(markdown) {
  return markdown
    .split(/\r?\n/)
    .filter((line) => /^\s*-\s+\[\s\]\s+/.test(line));
}

export function assertVersionManifest(version, manifest) {
  const mismatches = Object.entries(manifest).filter(([, actual]) => actual !== version);
  if (mismatches.length > 0) {
    const rendered = mismatches.map(([name, actual]) => `${name}=${actual}`).join(", ");
    throw new Error(`Package versions do not match ${version}: ${rendered}`);
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

function assertMergedMain() {
  run("git", ["fetch", "--quiet", "origin", "main", "--tags"]);
  const head = run("git", ["rev-parse", "HEAD"]);
  const originMain = run("git", ["rev-parse", "origin/main"]);
  if (head !== originMain) {
    throw new Error(`Release commit must be origin/main. HEAD=${head} origin/main=${originMain}`);
  }
}

function assertTag(version) {
  const head = run("git", ["rev-parse", "HEAD"]);
  const tag = run("git", ["rev-parse", `refs/tags/v${version}^{}`]);
  if (head !== tag) throw new Error(`Tag v${version} does not point to HEAD`);
}

function assertGithubRelease(version) {
  run("gh", ["release", "view", `v${version}`, "--json", "tagName,url"]);
}

function assertCiSuccess(requiredWorkflows) {
  const workflows = requiredWorkflows.length > 0 ? requiredWorkflows : ["CI"];
  const head = run("git", ["rev-parse", "HEAD"]);
  for (const workflow of workflows) {
    const result = run("gh", [
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
    const runs = JSON.parse(result);
    if (!runs.some((runResult) => runResult.conclusion === "success")) {
      throw new Error(`Required workflow did not pass for ${head}: ${workflow}`);
    }
  }
}

export function runReadiness(options) {
  assertSemver(options.version);
  assertVersionManifest(options.version, packageVersionManifest());

  const changelog = readFileSync(path.join(root, "CHANGELOG.md"), "utf8");
  if (!changelog.includes(`## [${options.version}]`)) {
    throw new Error(`CHANGELOG.md does not contain a ${options.version} entry`);
  }

  if (options.requireCompleteChecklist) {
    const checklist = readFileSync(path.join(root, options.checklist), "utf8");
    const openItems = uncheckedChecklistItems(checklist);
    if (openItems.length > 0) {
      throw new Error(`Release checklist has unchecked items:\n${openItems.join("\n")}`);
    }
  }

  if (options.requireOwnerAuthorization) {
    assertGithubIssueOrCommentUrl(options.ownerAuthorizationUrl);
    const provenance = readFileSync(path.join(root, "PROVENANCE.md"), "utf8");
    if (provenance.includes("Status: **not yet received**")) {
      throw new Error("PROVENANCE.md still marks owner authorization as not received");
    }
    if (!provenance.includes(options.ownerAuthorizationUrl)) {
      throw new Error("PROVENANCE.md does not contain the owner authorization URL");
    }
  } else if (options.ownerAuthorizationUrl) {
    assertGithubIssueOrCommentUrl(options.ownerAuthorizationUrl);
  }

  if (options.requireMergedMain) assertMergedMain();
  if (options.requireCiSuccess) assertCiSuccess(options.requiredWorkflows);
  if (options.requireTag) assertTag(options.version);
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

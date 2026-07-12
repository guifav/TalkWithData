#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const DEFAULT_OVERRIDES = "scripts/third-party-license-overrides.json";
const DEFAULT_OUTPUT = "docs/THIRD-PARTY-LICENSES.md";
const execFileAsync = promisify(execFile);

export async function collectInventory({
  rootDir,
  lockfiles,
  overridesFile = DEFAULT_OVERRIDES,
}) {
  const selectedLockfiles = lockfiles ?? await discoverCommittedLockfiles(rootDir);
  const overrides = JSON.parse(
    await readFile(path.join(rootDir, overridesFile), "utf8"),
  );
  const packages = new Map();
  const lockfileHashes = [];

  for (const lockfile of selectedLockfiles) {
    const absolute = path.join(rootDir, lockfile);
    const raw = await readFile(absolute, "utf8");
    const lock = JSON.parse(raw);
    if (lock.lockfileVersion !== 3 || typeof lock.packages !== "object") {
      throw new Error(`${lockfile} must be an npm lockfileVersion 3 graph`);
    }

    lockfileHashes.push({
      file: lockfile,
      sha256: createHash("sha256").update(raw).digest("hex"),
    });
    const graph = path.dirname(lockfile).replaceAll(path.sep, "/");

    for (const [packagePath, metadata] of Object.entries(lock.packages)) {
      if (!packagePath.includes("node_modules/")) continue;
      const name = metadata.name || inferPackageName(packagePath);
      const version = metadata.version;
      if (!name || typeof version !== "string") {
        throw new Error(`${lockfile}:${packagePath} has no package name or version`);
      }

      const key = `${name}@${version}`;
      const override = overrides[key];
      const declaredLicense = normalizeLicense(metadata.license);
      const license = declaredLicense || normalizeLicense(override?.license) || "UNKNOWN";
      const evidence = declaredLicense
        ? "lockfile"
        : override?.evidence
          ? `override: ${override.evidence}`
          : "missing";
      const existing = packages.get(key) || {
        name,
        version,
        license,
        graphs: new Set(),
        runtime: false,
        evidence,
      };

      if (existing.license !== license) {
        throw new Error(`${key} has conflicting licenses: ${existing.license} and ${license}`);
      }
      existing.graphs.add(graph);
      if (metadata.dev !== true) existing.runtime = true;
      if (existing.evidence === "missing" && evidence !== "missing") {
        existing.evidence = evidence;
      }
      packages.set(key, existing);
    }
  }

  const rows = Array.from(packages.values())
    .map((entry) => ({
      name: entry.name,
      version: entry.version,
      license: entry.license,
      graphs: Array.from(entry.graphs).sort(),
      scope: entry.runtime ? "runtime" : "development",
      evidence: entry.evidence,
    }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));

  return {
    lockfileHashes: lockfileHashes.sort((a, b) => a.file.localeCompare(b.file)),
    packages: rows,
    unknown: rows
      .filter((entry) => entry.license === "UNKNOWN")
      .map((entry) => `${entry.name}@${entry.version}`),
  };
}

export async function discoverCommittedLockfiles(rootDir) {
  const { stdout } = await execFileAsync(
    "git",
    [
      "-C",
      rootDir,
      "ls-files",
      "-z",
      "--",
      ":(glob)**/package-lock.json",
      "package-lock.json",
    ],
    { encoding: "utf8" },
  );
  const lockfiles = stdout.split("\0").filter(Boolean).sort();
  if (lockfiles.length === 0) {
    throw new Error("no committed npm lockfiles found");
  }
  return lockfiles;
}

export function renderInventory(inventory) {
  const uniqueNames = new Set(inventory.packages.map((entry) => entry.name)).size;
  const licenseCounts = new Map();
  for (const entry of inventory.packages) {
    licenseCounts.set(entry.license, (licenseCounts.get(entry.license) || 0) + 1);
  }

  const lines = [
    "# Third-party license inventory",
    "",
    "This file is generated from every committed npm lockfile by",
    "`node scripts/generate-third-party-licenses.mjs`. Do not edit it manually.",
    "It is an engineering inventory, not legal advice.",
    "",
    "## Snapshot",
    "",
    `- Locked package versions: ${inventory.packages.length}`,
    `- Unique package names: ${uniqueNames}`,
    `- Unresolved licenses: ${inventory.unknown.length}`,
    "- Any `UNKNOWN` entry is a release blocker until evidence is reviewed and recorded.",
    "",
    "Lockfile SHA-256 values:",
    "",
    ...inventory.lockfileHashes.map(
      ({ file, sha256 }) => `- \`${file}\`: \`${sha256}\``,
    ),
    "",
    "## License summary",
    "",
    "| SPDX expression or status | Package versions |",
    "| --- | ---: |",
    ...Array.from(licenseCounts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([license, count]) => `| \`${escapeCell(license)}\` | ${count} |`),
    "",
    "## Locked packages",
    "",
    "Scope is `runtime` when a package is non-development in at least one locked",
    "graph. Evidence identifies whether the license came from the lockfile or a",
    "reviewed metadata override.",
    "",
    "| Package | Version | License | Graphs | Scope | Evidence |",
    "| --- | --- | --- | --- | --- | --- |",
    ...inventory.packages.map(
      (entry) =>
        `| \`${escapeCell(entry.name)}\` | \`${escapeCell(entry.version)}\` | \`${escapeCell(entry.license)}\` | ${entry.graphs.map(escapeCell).join(", ")} | ${entry.scope} | ${escapeCell(entry.evidence)} |`,
    ),
    "",
  ];
  return lines.join("\n");
}

function inferPackageName(packagePath) {
  return packagePath.slice(packagePath.lastIndexOf("node_modules/") + 13);
}

function normalizeLicense(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function escapeCell(value) {
  return String(value).replaceAll("|", "\\|");
}

async function main() {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const inventory = await collectInventory({ rootDir });
  const rendered = renderInventory(inventory);
  const check = process.argv.includes("--check");
  const failOnUnknown = process.argv.includes("--fail-on-unknown");
  const output = path.join(rootDir, DEFAULT_OUTPUT);

  if (check) {
    const current = await readFile(output, "utf8").catch(() => "");
    if (current !== rendered) {
      throw new Error(`${DEFAULT_OUTPUT} is stale; regenerate it`);
    }
  } else {
    await writeFile(output, rendered);
  }

  if (failOnUnknown && inventory.unknown.length > 0) {
    throw new Error(`unresolved licenses: ${inventory.unknown.join(", ")}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

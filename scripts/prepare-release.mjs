#!/usr/bin/env node

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function parseArgs(argv) {
  const args = { outputDir: "dist/release" };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--version") args.version = argv[++index];
    else if (value === "--output-dir") args.outputDir = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(args.version ?? "")) {
    throw new Error("Release version must be SemVer without a leading v");
  }
  return args;
}

function run(command, args) {
  return execFileSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function optionalRun(command, args) {
  try {
    return run(command, args);
  } catch {
    return "";
  }
}

export function renderReleaseNotes({ version, commit, previousTag, commits }) {
  const range = previousTag ? `${previousTag}..${commit}` : "full public history";
  const lines = [
    `# Talk With Data v${version}`,
    "",
    `Source commit: \`${commit}\``,
    `Reviewed history range: ${range}`,
    "",
    "## Release Gates",
    "",
    "- Package versions, Git tag, and GitHub Release must point to this commit.",
    "- Owner authorization in PROVENANCE.md is required before publication.",
    "- CI and release readiness checks must pass before publication.",
    "",
    "## Reviewed Changes",
    "",
  ];

  if (commits.length === 0) lines.push("- No commits found in the release range.");
  else for (const item of commits) lines.push(`- ${item}`);

  lines.push(
    "",
    "## Artifacts",
    "",
    "- Source archive generated from the release commit.",
    "- Thumbnail function package archive is included when `.release` has been built.",
    "- `CHECKSUMS.txt` records SHA-256 values for generated artifacts.",
    "",
  );
  return `${lines.join("\n")}\n`;
}

export function formatChecksums(entries) {
  return entries
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, "en"))
    .map((entry) => `${entry.sha256}  ${entry.name}`)
    .join("\n") + "\n";
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function listFiles(directory) {
  return readdirSync(directory)
    .map((name) => path.join(directory, name))
    .filter((file) => statSync(file).isFile());
}

function createRelease({ version, outputDir }) {
  const releaseRoot = path.resolve(root, outputDir, `v${version}`);
  mkdirSync(releaseRoot, { recursive: true });

  const commit = run("git", ["rev-parse", "HEAD"]);
  const previousTag = optionalRun("git", ["describe", "--tags", "--abbrev=0", "--match", "v[0-9]*", "HEAD^"]);
  const range = previousTag ? `${previousTag}..HEAD` : "HEAD";
  const commits = optionalRun("git", ["log", "--format=%h %s", range])
    .split(/\r?\n/)
    .filter(Boolean);

  const sourceArchive = path.join(releaseRoot, `TalkWithData-v${version}-source.tar.gz`);
  execFileSync("git", [
    "archive",
    "--format=tar.gz",
    `--prefix=TalkWithData-v${version}/`,
    "--output",
    sourceArchive,
    "HEAD",
  ], { cwd: root, stdio: "inherit" });

  const functionRelease = path.join(root, "functions/generate-thumbnail/.release");
  if (statSync(functionRelease, { throwIfNoEntry: false })?.isDirectory()) {
    execFileSync("tar", [
      "-czf",
      path.join(releaseRoot, `generate-thumbnail-v${version}.tar.gz`),
      "-C",
      functionRelease,
      ".",
    ], { cwd: root, stdio: "inherit" });
  }

  const notesPath = path.join(releaseRoot, "RELEASE_NOTES.md");
  writeFileSync(notesPath, renderReleaseNotes({ version, commit, previousTag, commits }));

  const checksumEntries = listFiles(releaseRoot)
    .filter((file) => path.basename(file) !== "CHECKSUMS.txt")
    .map((file) => ({ name: path.basename(file), sha256: sha256(file) }));
  writeFileSync(path.join(releaseRoot, "CHECKSUMS.txt"), formatChecksums(checksumEntries));
  return releaseRoot;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const releaseRoot = createRelease(parseArgs(process.argv.slice(2)));
    console.log(`Release artifacts written to ${path.relative(root, releaseRoot)}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

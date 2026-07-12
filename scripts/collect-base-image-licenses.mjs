#!/usr/bin/env node

import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function collectBaseImageLicenses({
  filesystemRoot = "/",
  outputDir,
  policy,
  baseImage,
  nodeVersion,
  yarnVersion,
  toolPackageFile,
}) {
  if (baseImage !== policy.baseImage) {
    throw new Error(`base image ${baseImage} differs from policy ${policy.baseImage}`);
  }
  if (nodeVersion !== policy.nodeVersion || yarnVersion !== policy.yarnVersion) {
    throw new Error("base image runtime versions differ from policy");
  }

  const installed = await readFile(
    path.join(filesystemRoot, "lib/apk/db/installed"),
    "utf8",
  );
  const alpinePackages = parseApkInstalled(installed);
  const reviewedPackages = alpinePackages.map(({ name, version, license }) => ({
    name,
    version,
    license,
  }));
  if (JSON.stringify(reviewedPackages) !== JSON.stringify(policy.alpinePackages)) {
    throw new Error("base image Alpine inventory differs from policy");
  }

  const toolRequire = createRequire(toolPackageFile);
  const parseSpdxExpression = toolRequire("spdx-expression-parse");
  const spdxLicenses = toolRequire("spdx-license-list/full");
  const licenseIds = new Set();
  for (const entry of alpinePackages) {
    let expression;
    try {
      expression = parseSpdxExpression(entry.license);
    } catch {
      throw new Error(`${entry.name}@${entry.version} has an invalid SPDX license`);
    }
    if (hasSpdxException(expression)) {
      throw new Error(`${entry.name}@${entry.version} requires reviewed SPDX exception text`);
    }
    collectLicenseIds(expression, licenseIds);
  }

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(path.join(outputDir, "spdx"), { recursive: true });
  await mkdir(path.join(outputDir, "runtime"), { recursive: true });
  const licenseFiles = [];
  for (const id of Array.from(licenseIds).sort()) {
    const text = spdxLicenses[id]?.licenseText;
    if (!text) throw new Error(`base image license ${id} has no locked SPDX text`);
    const name = `spdx/${id}.txt`;
    await writeFile(path.join(outputDir, name), `${text.trim()}\n`);
    licenseFiles.push(name);
  }

  const notices = policy.runtimeNotices ?? [
    { source: "usr/local/LICENSE", name: "node-LICENSE.txt" },
    { source: `opt/yarn-v${yarnVersion}/LICENSE`, name: "yarn-LICENSE.txt" },
  ];
  for (const notice of notices) {
    const source = path.join(filesystemRoot, notice.source);
    const destination = path.join(outputDir, "runtime", notice.name);
    const contents = await readFile(source).catch(() => {
      throw new Error(`base image is missing required notice /${notice.source}`);
    });
    if (notice.sha256) {
      const sha256 = createHash("sha256").update(contents).digest("hex");
      if (sha256 !== notice.sha256) {
        throw new Error(
          `base image notice /${notice.source} has SHA-256 ${sha256}, expected ${notice.sha256}`,
        );
      }
    }
    await copyFile(source, destination);
    licenseFiles.push(`runtime/${notice.name}`);
  }

  const reviewedFiles = [];
  for (const reviewed of policy.reviewedFiles ?? []) {
    const source = path.join(filesystemRoot, reviewed.source);
    const contents = await readFile(source).catch(() => {
      throw new Error(`base image is missing reviewed file /${reviewed.source}`);
    });
    const sha256 = createHash("sha256").update(contents).digest("hex");
    if (sha256 !== reviewed.sha256) {
      throw new Error(
        `base image reviewed file /${reviewed.source} has SHA-256 ${sha256}, expected ${reviewed.sha256}`,
      );
    }
    reviewedFiles.push({ source: reviewed.source, sha256 });
  }

  const sourceEntries = new Map();
  for (const entry of alpinePackages.filter((item) => /GPL|LGPL/.test(item.license))) {
    const key = `${entry.origin}@${entry.sourceCommit}`;
    sourceEntries.set(key, entry);
  }
  const sourceLines = [
    "# Alpine corresponding source availability",
    "",
    "The pinned image redistributes the packages below under GPL or LGPL terms.",
    "Each link identifies the exact Alpine aports commit containing the build recipe",
    "and upstream source locations for the corresponding binary package.",
    "",
  ];
  for (const entry of Array.from(sourceEntries.values()).sort((a, b) => a.origin.localeCompare(b.origin))) {
    sourceLines.push(
      `- \`${entry.origin}\` (${entry.license}): `
        + `https://gitlab.alpinelinux.org/alpine/aports/-/commit/${entry.sourceCommit}`,
    );
  }
  sourceLines.push("");
  await writeFile(
    path.join(outputDir, "SOURCE-AVAILABILITY.md"),
    sourceLines.join("\n"),
  );
  licenseFiles.push("SOURCE-AVAILABILITY.md");

  const manifest = {
    baseImage,
    nodeVersion,
    yarnVersion,
    alpinePackages,
    reviewedFiles,
    licenseFiles: licenseFiles.sort(),
  };
  await writeFile(path.join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

function parseApkInstalled(contents) {
  return contents
    .trim()
    .split(/\n\n+/)
    .map((record) => {
      const fields = new Map(record.split("\n").map((line) => [line.slice(0, 1), line.slice(2)]));
      return {
        name: fields.get("P"),
        version: fields.get("V"),
        license: fields.get("L"),
        origin: fields.get("o") ?? fields.get("P"),
        sourceUrl: fields.get("U") ?? null,
        sourceCommit: fields.get("c") ?? null,
      };
    })
    .filter((entry) => entry.name && entry.version && entry.license)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function collectLicenseIds(expression, ids) {
  if (expression.license) ids.add(`${expression.license}${expression.plus ? "+" : ""}`);
  if (expression.left) collectLicenseIds(expression.left, ids);
  if (expression.right) collectLicenseIds(expression.right, ids);
}

function hasSpdxException(expression) {
  return Boolean(
    expression.exception
      || (expression.left && hasSpdxException(expression.left))
      || (expression.right && hasSpdxException(expression.right)),
  );
}

async function main() {
  const [outputDir, policyFile, toolPackageFile] = process.argv.slice(2);
  if (!outputDir || !policyFile || !toolPackageFile) {
    throw new Error(
      "usage: collect-base-image-licenses.mjs <output-dir> <policy.json> <tool-package.json>",
    );
  }
  const policy = JSON.parse(await readFile(path.resolve(policyFile), "utf8"));
  const manifest = await collectBaseImageLicenses({
    outputDir: path.resolve(outputDir),
    policy,
    baseImage: process.env.TWD_BASE_IMAGE,
    nodeVersion: process.env.NODE_VERSION,
    yarnVersion: process.env.YARN_VERSION,
    toolPackageFile: path.resolve(toolPackageFile),
  });
  console.log(`Collected base image licenses for ${manifest.alpinePackages.length} Alpine packages`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

#!/usr/bin/env node

import { copyFile, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LICENSE_FILE = /^(?:licen[cs]e|notice|copying)(?:[._-].*)?$/i;
export async function collectArtifactLicenses({
  artifactDir,
  sourceNodeModules,
  outputDir,
  toolPackageFile = path.join(sourceNodeModules, "../package.json"),
  supplements = {},
}) {
  const toolRequire = createRequire(toolPackageFile);
  const parseSpdxExpression = toolRequire("spdx-expression-parse");
  const spdxLicenses = toolRequire("spdx-license-list/full");
  const artifactPackages = await discoverPackages(artifactDir);
  const sourcePackages = await discoverPackages(sourceNodeModules, true);
  const sourceByKey = new Map();
  const sourceByName = new Map();
  for (const entry of sourcePackages) {
    const key = `${entry.name}@${entry.version}`;
    if (!sourceByKey.has(key)) sourceByKey.set(key, entry.directory);
    const named = sourceByName.get(entry.name) || [];
    if (!named.some((candidate) => candidate.version === entry.version)) named.push(entry);
    sourceByName.set(entry.name, named);
  }

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  const manifest = [];
  const usedSupplements = new Set();

  for (const artifactEntry of uniquePackages(artifactPackages)) {
    const entry = resolveArtifactPackage(artifactEntry, sourceByKey, sourceByName);
    const key = `${entry.name}@${entry.version}`;
    if (!entry.sourceDirectory) {
      throw new Error(`${key} is present in the artifact but not in the source install`);
    }
    const expression = parseLicenseExpression(entry.license, parseSpdxExpression);
    let files = await findLicenseFiles(entry.directory, entry.sourceDirectory);
    if (files.length === 0 || hasAndConjunction(expression)) {
      const generated = createSpdxLicenseFiles(entry, expression, spdxLicenses);
      const existingNames = new Set(files.map((file) => file.name));
      files.push(...generated.filter((file) => !existingNames.has(file.name)));
    }
    const supplement = supplements[key];
    if (supplement) {
      usedSupplements.add(key);
      files.push(...await resolveSupplementFiles(entry, supplement));
    }
    if (files.length === 0) {
      throw new Error(`${key} has no LICENSE, NOTICE, or COPYING file`);
    }
    await assertSpdxExceptionsPresent(key, expression, files);

    const destination = path.join(outputDir, safePackageDirectory(entry.name, entry.version));
    for (const file of files) {
      const target = path.join(destination, file.name);
      await mkdir(path.dirname(target), { recursive: true });
      if (file.source) await copyFile(file.source, target);
      else await writeFile(target, file.content);
    }
    manifest.push({
      name: entry.name,
      version: entry.version,
      license: entry.license,
      files: files.map((file) => file.name),
    });
  }

  const unusedSupplements = Object.keys(supplements).filter((key) => !usedSupplements.has(key));
  if (unusedSupplements.length > 0) {
    throw new Error(`unused artifact license supplements: ${unusedSupplements.sort().join(", ")}`);
  }

  await writeFile(
    path.join(outputDir, "manifest.json"),
    `${JSON.stringify({ packages: manifest }, null, 2)}\n`,
  );
  return manifest;
}

async function discoverPackages(root, rootIsNodeModules = false) {
  const nodeModulesDirectories = rootIsNodeModules
    ? [root]
    : await findNodeModulesDirectories(root);
  const packages = [];
  for (const directory of nodeModulesDirectories) {
    await scanNodeModules(directory, packages);
  }
  return packages;
}

async function findNodeModulesDirectories(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const child = path.join(directory, entry.name);
    if (entry.name === "node_modules") {
      found.push(child);
    } else {
      found.push(...await findNodeModulesDirectories(child));
    }
  }
  return found;
}

async function scanNodeModules(directory, packages) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
    if (entry.name.startsWith("@")) {
      const scopeDirectory = path.join(directory, entry.name);
      for (const scoped of await readdir(scopeDirectory, { withFileTypes: true })) {
        if (scoped.isDirectory()) {
          await addPackage(
            path.join(scopeDirectory, scoped.name),
            packages,
            `${entry.name}/${scoped.name}`,
          );
        }
      }
    } else {
      await addPackage(path.join(directory, entry.name), packages, entry.name);
    }
  }
}

async function addPackage(directory, packages, inferredName) {
  const packageFile = path.join(directory, "package.json");
  const metadata = JSON.parse(await readFile(packageFile, "utf8").catch(() => "{}"));
  packages.push({
    name: typeof metadata.name === "string" ? metadata.name : inferredName,
    version: typeof metadata.version === "string" ? metadata.version : null,
    license: typeof metadata.license === "string" ? metadata.license : null,
    author: metadata.author ?? null,
    homepage: typeof metadata.homepage === "string" ? metadata.homepage : null,
    repository: metadata.repository ?? null,
    directory,
  });
  const nested = path.join(directory, "node_modules");
  if (await isDirectory(nested)) await scanNodeModules(nested, packages);
}

async function findLicenseFiles(...directories) {
  const files = new Map();
  for (const directory of directories) {
    await findLicenseFilesRecursively(directory, directory, files);
  }
  return Array.from(files.values()).sort((a, b) => a.name.localeCompare(b.name));
}

async function findLicenseFilesRecursively(root, directory, files) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const source = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await findLicenseFilesRecursively(root, source, files);
    } else if (entry.isFile() && LICENSE_FILE.test(entry.name)) {
      const name = path.relative(root, source).split(path.sep).join("/");
      if (!files.has(name)) files.set(name, { name, source });
    }
  }
}

function uniquePackages(packages) {
  const unique = new Map();
  for (const entry of packages) {
    const key = `${entry.name}@${entry.version || "unversioned"}`;
    if (!unique.has(key)) unique.set(key, entry);
  }
  return Array.from(unique.values()).sort(
    (a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version),
  );
}

function resolveArtifactPackage(entry, sourceByKey, sourceByName) {
  if (entry.version) {
    return {
      ...entry,
      sourceDirectory: sourceByKey.get(`${entry.name}@${entry.version}`),
    };
  }
  const candidates = sourceByName.get(entry.name) || [];
  if (candidates.length !== 1) {
    throw new Error(
      `${entry.name} has no artifact package.json and does not resolve to one source version`,
    );
  }
  return {
    ...entry,
    ...candidates[0],
    directory: entry.directory,
    sourceDirectory: candidates[0].directory,
  };
}

function parseLicenseExpression(license, parseSpdxExpression) {
  if (!license) return null;
  try {
    return parseSpdxExpression(license);
  } catch {
    return null;
  }
}

function createSpdxLicenseFiles(entry, expression, spdxLicenses) {
  if (!expression || hasSpdxException(expression)) return [];
  const ids = Array.from(collectLicenseIds(expression)).sort();
  const files = [];
  for (const id of ids) {
    const license = spdxLicenses[id];
    if (!license?.licenseText) return [];
    files.push({
      name: `SPDX-${id}.txt`,
      content: `${license.licenseText.trim()}\n`,
    });
  }
  files.push({
    name: "PACKAGE-METADATA.json",
    content: `${JSON.stringify({
      name: entry.name,
      version: entry.version,
      license: entry.license,
      author: entry.author,
      homepage: entry.homepage,
      repository: entry.repository,
      note: "License text generated from the declared SPDX expression because the npm package contained no license file.",
    }, null, 2)}\n`,
  });
  return files;
}

function hasSpdxException(expression) {
  return Boolean(
    expression.exception
      || (expression.left && hasSpdxException(expression.left))
      || (expression.right && hasSpdxException(expression.right)),
  );
}

function hasAndConjunction(expression) {
  return Boolean(
    expression
      && (expression.conjunction === "and"
        || (expression.left && hasAndConjunction(expression.left))
        || (expression.right && hasAndConjunction(expression.right))),
  );
}

function collectLicenseIds(expression, ids = new Set()) {
  if (expression.license) ids.add(`${expression.license}${expression.plus ? "+" : ""}`);
  if (expression.left) collectLicenseIds(expression.left, ids);
  if (expression.right) collectLicenseIds(expression.right, ids);
  return ids;
}

async function resolveSupplementFiles(entry, supplement) {
  const key = `${entry.name}@${entry.version}`;
  if (!Array.isArray(supplement.requiredArtifactFiles) || supplement.requiredArtifactFiles.length === 0) {
    throw new Error(`${key} supplement must declare requiredArtifactFiles`);
  }
  for (const required of supplement.requiredArtifactFiles) {
    const relative = required?.path;
    assertSafeRelativePath(relative, `${key} required artifact`);
    if (!/^[a-f0-9]{64}$/.test(required.sha256)) {
      throw new Error(`${key} required artifact ${relative} must declare a SHA-256`);
    }
    const artifactFile = path.join(entry.directory, relative);
    if (!await isFile(artifactFile)) {
      throw new Error(`${key} is missing required supplemented artifact ${relative}`);
    }
    const actual = createHash("sha256").update(await readFile(artifactFile)).digest("hex");
    if (actual !== required.sha256) {
      throw new Error(
        `${key} artifact ${relative} has SHA-256 ${actual}, expected ${required.sha256}`,
      );
    }
  }
  if (!Array.isArray(supplement.files) || supplement.files.length === 0) {
    throw new Error(`${key} supplement must declare license files`);
  }
  return Promise.all(supplement.files.map(async (file) => {
    assertSafeRelativePath(file.name, `${key} supplement`);
    if (file.sourceRelative) {
      assertSafeRelativePath(file.sourceRelative, `${key} supplement source`);
    }
    const source = file.source
      ?? (file.sourceRelative && path.join(entry.sourceDirectory, file.sourceRelative));
    if (!await isFile(source)) {
      throw new Error(`${key} is missing supplement source ${source}`);
    }
    return { name: `supplements/${file.name}`, source };
  }));
}

async function assertSpdxExceptionsPresent(key, expression, files) {
  if (!expression) return;
  const exceptions = Array.from(collectSpdxExceptions(expression));
  if (exceptions.length === 0) return;
  const contents = (await Promise.all(files.map(async (file) => (
    file.content ?? await readFile(file.source, "utf8")
  )))).join("\n");
  const normalizedContents = normalizeWords(contents);
  for (const exception of exceptions) {
    const label = exception.replace(/-\d+(?:\.\d+)*$/, "");
    if (!normalizedContents.includes(normalizeWords(label))) {
      throw new Error(`${key} is missing the ${exception} text`);
    }
  }
}

function collectSpdxExceptions(expression, exceptions = new Set()) {
  if (expression.exception) exceptions.add(expression.exception);
  if (expression.left) collectSpdxExceptions(expression.left, exceptions);
  if (expression.right) collectSpdxExceptions(expression.right, exceptions);
  return exceptions;
}

function normalizeWords(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function assertSafeRelativePath(value, label) {
  if (
    typeof value !== "string"
    || value.length === 0
    || path.isAbsolute(value)
    || value.split(/[\\/]/).includes("..")
  ) {
    throw new Error(`${label} path must stay within its package directory`);
  }
}

function safePackageDirectory(name, version) {
  return `${name.replaceAll("/", "__")}@${version}`;
}

async function isDirectory(directory) {
  try {
    return (await readdir(directory)).length >= 0;
  } catch {
    return false;
  }
}

async function isFile(file) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

async function main() {
  const [artifactDir, sourceNodeModules, outputDir, toolPackageFile, supplementsFile] = process.argv.slice(2);
  if (!artifactDir || !sourceNodeModules || !outputDir) {
    throw new Error(
      "usage: collect-artifact-licenses.mjs <artifact-dir> <source-node_modules> <output-dir>",
    );
  }
  const supplements = supplementsFile
    ? JSON.parse(await readFile(path.resolve(supplementsFile), "utf8"))
    : {};
  const manifest = await collectArtifactLicenses({
    artifactDir: path.resolve(artifactDir),
    sourceNodeModules: path.resolve(sourceNodeModules),
    outputDir: path.resolve(outputDir),
    toolPackageFile: toolPackageFile ? path.resolve(toolPackageFile) : undefined,
    supplements,
  });
  console.log(`Collected license files for ${manifest.length} artifact packages`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

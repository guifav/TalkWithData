#!/usr/bin/env node

import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LICENSE_FILE = /^(?:licen[cs]e|notice|copying)(?:[._-].*)?$/i;
export async function collectArtifactLicenses({
  artifactDir,
  sourceNodeModules,
  outputDir,
  toolPackageFile = path.join(sourceNodeModules, "../package.json"),
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

  for (const artifactEntry of uniquePackages(artifactPackages)) {
    const entry = resolveArtifactPackage(artifactEntry, sourceByKey, sourceByName);
    const key = `${entry.name}@${entry.version}`;
    if (!entry.sourceDirectory) {
      throw new Error(`${key} is present in the artifact but not in the source install`);
    }
    let files = await findLicenseFiles(entry.directory, entry.sourceDirectory);
    if (files.length === 0) {
      files = createSpdxLicenseFiles(entry, parseSpdxExpression, spdxLicenses);
    }
    if (files.length === 0) {
      throw new Error(`${key} has no LICENSE, NOTICE, or COPYING file`);
    }

    const destination = path.join(outputDir, safePackageDirectory(entry.name, entry.version));
    await mkdir(destination, { recursive: true });
    for (const file of files) {
      const target = path.join(destination, file.name);
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
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isFile() && LICENSE_FILE.test(entry.name) && !files.has(entry.name)) {
        files.set(entry.name, { name: entry.name, source: path.join(directory, entry.name) });
      }
    }
  }
  return Array.from(files.values()).sort((a, b) => a.name.localeCompare(b.name));
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

function createSpdxLicenseFiles(entry, parseSpdxExpression, spdxLicenses) {
  if (!entry.license) return [];
  let expression;
  try {
    expression = parseSpdxExpression(entry.license);
  } catch {
    return [];
  }
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

function collectLicenseIds(expression, ids = new Set()) {
  if (expression.license) ids.add(expression.license);
  if (expression.left) collectLicenseIds(expression.left, ids);
  if (expression.right) collectLicenseIds(expression.right, ids);
  return ids;
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

async function main() {
  const [artifactDir, sourceNodeModules, outputDir, toolPackageFile] = process.argv.slice(2);
  if (!artifactDir || !sourceNodeModules || !outputDir) {
    throw new Error(
      "usage: collect-artifact-licenses.mjs <artifact-dir> <source-node_modules> <output-dir>",
    );
  }
  const manifest = await collectArtifactLicenses({
    artifactDir: path.resolve(artifactDir),
    sourceNodeModules: path.resolve(sourceNodeModules),
    outputDir: path.resolve(outputDir),
    toolPackageFile: toolPackageFile ? path.resolve(toolPackageFile) : undefined,
  });
  console.log(`Collected license files for ${manifest.length} artifact packages`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

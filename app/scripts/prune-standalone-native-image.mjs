#!/usr/bin/env node

import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export async function pruneStandaloneNativeImageOptimizer(standaloneRoot) {
  const nodeModulesDirectories = [];
  await findNodeModulesDirectories(standaloneRoot, nodeModulesDirectories);
  const removed = [];
  for (const modules of nodeModulesDirectories) {
    await removeIfPresent(path.join(modules, "sharp"), standaloneRoot, removed);
    const scope = path.join(modules, "@img");
    for (const entry of await readdir(scope, { withFileTypes: true }).catch(() => [])) {
      if (entry.isDirectory() && entry.name.startsWith("sharp-")) {
        await removeIfPresent(path.join(scope, entry.name), standaloneRoot, removed);
      }
    }
  }
  return removed.sort();
}

async function findNodeModulesDirectories(directory, found) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const child = path.join(directory, entry.name);
    if (entry.name === "node_modules") found.push(child);
    else await findNodeModulesDirectories(child, found);
  }
}

async function removeIfPresent(directory, root, removed) {
  const entries = await readdir(directory).catch(() => null);
  if (!entries) return;
  await rm(directory, { recursive: true, force: true });
  removed.push(path.relative(root, directory).split(path.sep).join("/"));
}

async function main() {
  const standaloneRoot = path.resolve(process.argv[2] ?? ".next/standalone");
  const removed = await pruneStandaloneNativeImageOptimizer(standaloneRoot);
  console.log(`Removed ${removed.length} unused Sharp package directories from standalone output`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

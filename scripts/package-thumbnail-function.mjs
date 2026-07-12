#!/usr/bin/env node

import { execFile } from "node:child_process";
import { access, copyFile, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { collectArtifactLicenses } from "./collect-artifact-licenses.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const functionRoot = path.join(repositoryRoot, "functions/generate-thumbnail");
const releaseRoot = path.join(functionRoot, ".release");

await rm(releaseRoot, { recursive: true, force: true });
await mkdir(releaseRoot, { recursive: true });

const { stdout } = await execFileAsync(
  "git",
  ["-C", repositoryRoot, "ls-files", "-z", "--", "functions/generate-thumbnail"],
  { encoding: "utf8" },
);
for (const file of stdout.split("\0").filter(Boolean)) {
  const relative = path.relative("functions/generate-thumbnail", file);
  const destination = path.join(releaseRoot, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(path.join(repositoryRoot, file), destination);
}
await cp(path.join(functionRoot, "dist"), path.join(releaseRoot, "dist"), {
  recursive: true,
});

await mkdir(path.join(releaseRoot, "licenses"), { recursive: true });
await copyFile(path.join(repositoryRoot, "LICENSE"), path.join(releaseRoot, "licenses/LICENSE"));
await copyFile(
  path.join(repositoryRoot, "THIRD_PARTY_NOTICES.md"),
  path.join(releaseRoot, "licenses/THIRD_PARTY_NOTICES.md"),
);
await copyFile(
  path.join(repositoryRoot, "docs/THIRD-PARTY-LICENSES.md"),
  path.join(releaseRoot, "licenses/THIRD-PARTY-LICENSES.md"),
);

const manifest = await collectArtifactLicenses({
  artifactDir: functionRoot,
  sourceNodeModules: path.join(functionRoot, "node_modules"),
  outputDir: path.join(releaseRoot, "licenses/npm"),
  toolPackageFile: path.join(functionRoot, "package.json"),
});
const names = new Set(manifest.map((entry) => entry.name));
for (const name of ["@google-cloud/functions-framework", "@sparticuz/chromium", "puppeteer-core"]) {
  if (!names.has(name)) throw new Error(`missing function license bundle for ${name}`);
}

await writeFile(path.join(releaseRoot, ".gcloudignore"), "node_modules\nnpm-debug.log*\n");
const packageJson = JSON.parse(await readFile(path.join(releaseRoot, "package.json"), "utf8"));
if (packageJson.main !== "dist/index.js") {
  throw new Error("thumbnail release package has an unexpected main entry point");
}
await access(path.join(releaseRoot, packageJson.main));
console.log(`Packaged thumbnail function with licenses for ${manifest.length} package versions`);

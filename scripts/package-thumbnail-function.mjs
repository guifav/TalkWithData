#!/usr/bin/env node

import { execFile } from "node:child_process";
import { access, copyFile, cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { collectArtifactLicenses } from "./collect-artifact-licenses.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const functionRoot = path.join(repositoryRoot, "functions/generate-thumbnail");
const releaseRoot = path.join(functionRoot, ".release");
const chromiumNoticesRoot = path.join(
  repositoryRoot,
  "third_party/chromium-149.0.7827.22",
);

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
await mkdir(path.join(releaseRoot, "licenses/docs"), { recursive: true });
await copyFile(
  path.join(repositoryRoot, "docs/THIRD-PARTY-LICENSES.md"),
  path.join(releaseRoot, "licenses/docs/THIRD-PARTY-LICENSES.md"),
);

const generatedSupplements = path.join(releaseRoot, ".generated-license-supplements");
await mkdir(generatedSupplements, { recursive: true });
const toolRequire = createRequire(path.join(functionRoot, "package.json"));
const spdxLicenses = toolRequire("spdx-license-list/full");
for (const id of ["MIT", "MPL-2.0", "OFL-1.1"]) {
  const text = spdxLicenses[id]?.licenseText;
  if (!text) throw new Error(`missing ${id} text in the locked SPDX license list`);
  await writeFile(path.join(generatedSupplements, `${id}.txt`), `${text.trim()}\n`);
}

const manifest = await collectArtifactLicenses({
  artifactDir: functionRoot,
  sourceNodeModules: path.join(functionRoot, "node_modules"),
  outputDir: path.join(releaseRoot, "licenses/npm"),
  toolPackageFile: path.join(functionRoot, "package.json"),
  supplements: {
    "@sparticuz/chromium@149.0.0": {
      requiredArtifactFiles: [
        {
          path: "bin/al2023.tar.br",
          sha256: "7c24a0e1752f53cbc1b8f97a756d157c07cc773c1f4f4201690a040f9fa951e5",
        },
        {
          path: "bin/chromium.br",
          sha256: "37ba84bfa72f40ca761f31d11c24fda42e70f4ee621c28e7f363ca777b97bd7a",
        },
        {
          path: "bin/fonts.tar.br",
          sha256: "b8580ef8abe530cdeccbd420ceaa5906ee8a60fb1e0505f22e07c59c88f65af5",
        },
        {
          path: "bin/swiftshader.tar.br",
          sha256: "49cfdf5cf3d15ed1eb5e636619f325ff38c609e27d43d06a129dc54f88f67e29",
        },
      ],
      files: [
        "BINARY-PAYLOAD-NOTICES.md",
        "CHROMIUM-LICENSE.txt",
        "CHROMIUM-THIRD-PARTY-CREDITS.html.gz",
      ].map((name) => ({ source: path.join(chromiumNoticesRoot, name), name })).concat(
        ["MIT", "MPL-2.0", "OFL-1.1"].map((id) => ({
          source: path.join(generatedSupplements, `${id}.txt`),
          name: `${id}.txt`,
        })),
      ),
    },
  },
});
const chromiumBundle = manifest.find((entry) => entry.name === "@sparticuz/chromium");
for (const name of [
  "supplements/BINARY-PAYLOAD-NOTICES.md",
  "supplements/CHROMIUM-LICENSE.txt",
  "supplements/CHROMIUM-THIRD-PARTY-CREDITS.html.gz",
  "supplements/MIT.txt",
  "supplements/MPL-2.0.txt",
  "supplements/OFL-1.1.txt",
]) {
  if (!chromiumBundle?.files.includes(name)) {
    throw new Error(`missing Chromium binary notice ${name}`);
  }
}
await rm(generatedSupplements, { recursive: true, force: true });
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

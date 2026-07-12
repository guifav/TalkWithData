import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { collectArtifactLicenses } from "../collect-artifact-licenses.mjs";

const toolPackageFile = path.resolve(import.meta.dirname, "../../app/package.json");

test("collects one deterministic license bundle per artifact package version", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "twd-artifact-licenses-"));
  const artifact = path.join(root, "artifact");
  const source = path.join(root, "source");
  const output = path.join(root, "output");
  await writePackage(path.join(artifact, "node_modules/@scope/example"), {
    name: "@scope/example",
    version: "1.2.3",
    license: "MIT",
  });
  await writePackage(path.join(source, "@scope/example"), {
    name: "@scope/example",
    version: "1.2.3",
    license: "MIT",
  });
  await writeFile(path.join(source, "@scope/example/LICENSE.md"), "MIT fixture\n");

  const manifest = await collectArtifactLicenses({
    artifactDir: artifact,
    sourceNodeModules: source,
    outputDir: output,
    toolPackageFile,
  });

  assert.deepEqual(manifest, [{
    name: "@scope/example",
    version: "1.2.3",
    license: "MIT",
    files: ["LICENSE.md"],
  }]);
  assert.equal(
    await readFile(path.join(output, "@scope__example@1.2.3/LICENSE.md"), "utf8"),
    "MIT fixture\n",
  );
});

test("generates a standard text when a package declares SPDX but ships no file", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "twd-artifact-licenses-"));
  const artifact = path.join(root, "artifact");
  const source = path.join(root, "source");
  await writePackage(path.join(artifact, "node_modules/example"), {
    name: "example",
    version: "1.0.0",
    license: "MIT",
  });
  await writePackage(path.join(source, "example"), {
    name: "example",
    version: "1.0.0",
    license: "MIT",
  });

  const manifest = await collectArtifactLicenses({
    artifactDir: artifact,
    sourceNodeModules: source,
    outputDir: path.join(root, "output"),
    toolPackageFile,
  });

  assert.deepEqual(manifest[0].files, ["SPDX-MIT.txt", "PACKAGE-METADATA.json"]);
  assert.match(
    await readFile(path.join(root, "output/example@1.0.0/SPDX-MIT.txt"), "utf8"),
    /Permission is hereby granted/,
  );
});

test("rejects an artifact package without a distributable license source", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "twd-artifact-licenses-"));
  const artifact = path.join(root, "artifact");
  const source = path.join(root, "source");
  await writePackage(path.join(artifact, "node_modules/example"), {
    name: "example",
    version: "1.0.0",
  });
  await writePackage(path.join(source, "example"), {
    name: "example",
    version: "1.0.0",
  });

  await assert.rejects(
    collectArtifactLicenses({
      artifactDir: artifact,
      sourceNodeModules: source,
      outputDir: path.join(root, "output"),
      toolPackageFile,
    }),
    /example@1\.0\.0 has no LICENSE, NOTICE, or COPYING file/,
  );
});

test("rejects a WITH expression when the package ships no exception text", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "twd-artifact-licenses-"));
  const artifact = path.join(root, "artifact");
  const source = path.join(root, "source");
  const metadata = {
    name: "example",
    version: "1.0.0",
    license: "GPL-2.0-only WITH Classpath-exception-2.0",
  };
  await writePackage(path.join(artifact, "node_modules/example"), metadata);
  await writePackage(path.join(source, "example"), metadata);

  await assert.rejects(
    collectArtifactLicenses({
      artifactDir: artifact,
      sourceNodeModules: source,
      outputDir: path.join(root, "output"),
      toolPackageFile,
    }),
    /example@1\.0\.0 has no LICENSE, NOTICE, or COPYING file/,
  );
});

async function writePackage(directory, metadata) {
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "package.json"), `${JSON.stringify(metadata)}\n`);
}

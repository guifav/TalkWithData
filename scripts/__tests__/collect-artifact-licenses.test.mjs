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

test("preserves nested vendored license files from the source package", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "twd-artifact-licenses-"));
  const artifact = path.join(root, "artifact");
  const source = path.join(root, "source");
  const metadata = { name: "example", version: "1.0.0", license: "MIT" };
  await writePackage(path.join(artifact, "node_modules/example"), metadata);
  await mkdir(path.join(artifact, "node_modules/example/dist/compiled"), { recursive: true });
  await writeFile(
    path.join(artifact, "node_modules/example/dist/compiled/vendor.js"),
    "vendored fixture\n",
  );
  await writePackage(path.join(source, "example"), metadata);
  await mkdir(path.join(source, "example/dist/compiled/vendor"), { recursive: true });
  await writeFile(
    path.join(source, "example/dist/compiled/vendor/LICENSE"),
    "Vendored license fixture\n",
  );

  const manifest = await collectArtifactLicenses({
    artifactDir: artifact,
    sourceNodeModules: source,
    outputDir: path.join(root, "output"),
    toolPackageFile,
  });

  assert.ok(manifest[0].files.includes("dist/compiled/vendor/LICENSE"));
  assert.equal(
    await readFile(path.join(root, "output/example@1.0.0/dist/compiled/vendor/LICENSE"), "utf8"),
    "Vendored license fixture\n",
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

test("rejects a WITH expression when the package ships only the base license", async () => {
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
  await writeFile(path.join(source, "example/LICENSE"), "GNU GENERAL PUBLIC LICENSE\n");

  await assert.rejects(
    collectArtifactLicenses({
      artifactDir: artifact,
      sourceNodeModules: source,
      outputDir: path.join(root, "output"),
      toolPackageFile,
    }),
    /example@1\.0\.0 is missing the Classpath-exception-2\.0 text/,
  );
});

test("preserves the or-later meaning of SPDX plus expressions", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "twd-artifact-licenses-"));
  const artifact = path.join(root, "artifact");
  const source = path.join(root, "source");
  const metadata = { name: "example", version: "1.0.0", license: "GPL-2.0+" };
  await writePackage(path.join(artifact, "node_modules/example"), metadata);
  await writePackage(path.join(source, "example"), metadata);

  const manifest = await collectArtifactLicenses({
    artifactDir: artifact,
    sourceNodeModules: source,
    outputDir: path.join(root, "output"),
    toolPackageFile,
  });

  assert.ok(manifest[0].files.includes("SPDX-GPL-2.0+.txt"));
  assert.match(
    await readFile(path.join(root, "output/example@1.0.0/SPDX-GPL-2.0+.txt"), "utf8"),
    /later version/,
  );
});

test("adds every required SPDX text for an AND expression", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "twd-artifact-licenses-"));
  const artifact = path.join(root, "artifact");
  const source = path.join(root, "source");
  const metadata = { name: "example", version: "1.0.0", license: "MIT AND Zlib" };
  await writePackage(path.join(artifact, "node_modules/example"), metadata);
  await writePackage(path.join(source, "example"), metadata);
  await writeFile(path.join(source, "example/LICENSE"), "MIT fixture\n");

  const manifest = await collectArtifactLicenses({
    artifactDir: artifact,
    sourceNodeModules: source,
    outputDir: path.join(root, "output"),
    toolPackageFile,
  });

  assert.ok(manifest[0].files.includes("SPDX-MIT.txt"));
  assert.ok(manifest[0].files.includes("SPDX-Zlib.txt"));
  assert.match(
    await readFile(path.join(root, "output/example@1.0.0/SPDX-Zlib.txt"), "utf8"),
    /provided 'as-is'/i,
  );
});

test("requires and copies declared license supplements for binary payloads", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "twd-artifact-licenses-"));
  const artifact = path.join(root, "artifact");
  const source = path.join(root, "source");
  const metadata = { name: "binary-package", version: "1.0.0", license: "MIT" };
  await writePackage(path.join(artifact, "node_modules/binary-package"), metadata);
  await mkdir(path.join(artifact, "node_modules/binary-package/bin"), { recursive: true });
  await writeFile(path.join(artifact, "node_modules/binary-package/bin/payload.br"), "binary\n");
  await writePackage(path.join(source, "binary-package"), metadata);
  await writeFile(path.join(source, "binary-package/LICENSE"), "Wrapper license\n");
  await writeFile(path.join(source, "binary-package/BINARY-NOTICE.txt"), "Binary notice\n");

  const manifest = await collectArtifactLicenses({
    artifactDir: artifact,
    sourceNodeModules: source,
    outputDir: path.join(root, "output"),
    toolPackageFile,
    supplements: {
      "binary-package@1.0.0": {
        requiredArtifactFiles: [{
          path: "bin/payload.br",
          sha256: "58eaf5a78d580f5dbd49d31a5b733094169b31bfdf49055b74bcac2877d8f58c",
        }],
        files: [{ sourceRelative: "BINARY-NOTICE.txt", name: "BINARY-NOTICE.txt" }],
      },
    },
  });

  assert.ok(manifest[0].files.includes("supplements/BINARY-NOTICE.txt"));
  assert.equal(
    await readFile(
      path.join(root, "output/binary-package@1.0.0/supplements/BINARY-NOTICE.txt"),
      "utf8",
    ),
    "Binary notice\n",
  );
});

test("rejects a supplemented binary payload whose checksum changed", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "twd-artifact-licenses-"));
  const artifact = path.join(root, "artifact");
  const source = path.join(root, "source");
  const metadata = { name: "binary-package", version: "1.0.0", license: "MIT" };
  await writePackage(path.join(artifact, "node_modules/binary-package"), metadata);
  await mkdir(path.join(artifact, "node_modules/binary-package/bin"), { recursive: true });
  await writeFile(path.join(artifact, "node_modules/binary-package/bin/payload.br"), "changed\n");
  await writePackage(path.join(source, "binary-package"), metadata);
  await writeFile(path.join(source, "binary-package/LICENSE"), "Wrapper license\n");
  await writeFile(path.join(source, "binary-package/BINARY-NOTICE.txt"), "Binary notice\n");

  await assert.rejects(
    collectArtifactLicenses({
      artifactDir: artifact,
      sourceNodeModules: source,
      outputDir: path.join(root, "output"),
      toolPackageFile,
      supplements: {
        "binary-package@1.0.0": {
          requiredArtifactFiles: [{ path: "bin/payload.br", sha256: "0".repeat(64) }],
          files: [{ sourceRelative: "BINARY-NOTICE.txt", name: "BINARY-NOTICE.txt" }],
        },
      },
    }),
    /binary-package@1\.0\.0 artifact bin\/payload\.br has SHA-256/,
  );
});

async function writePackage(directory, metadata) {
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, "package.json"), `${JSON.stringify(metadata)}\n`);
}

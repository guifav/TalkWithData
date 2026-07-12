import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { collectBaseImageLicenses } from "../collect-base-image-licenses.mjs";

const toolPackageFile = path.resolve(import.meta.dirname, "../../app/package.json");

test("binds the base image to an exact Alpine inventory and emits license texts", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "twd-base-licenses-"));
  const filesystem = path.join(root, "rootfs");
  const output = path.join(root, "output");
  await mkdir(path.join(filesystem, "lib/apk/db"), { recursive: true });
  await mkdir(path.join(filesystem, "usr/local"), { recursive: true });
  await mkdir(path.join(filesystem, "opt/yarn-v1.0.0"), { recursive: true });
  await writeFile(
    path.join(filesystem, "lib/apk/db/installed"),
    "P:musl\nV:1.2.3-r0\nL:MIT\n\nP:zlib\nV:1.3.0-r0\nL:Zlib\n",
  );
  await writeFile(path.join(filesystem, "usr/local/LICENSE"), "Node license\n");
  await writeFile(path.join(filesystem, "opt/yarn-v1.0.0/LICENSE"), "Yarn license\n");
  const policy = {
    baseImage: "node:test@sha256:fixture",
    nodeVersion: "1.0.0",
    yarnVersion: "1.0.0",
    alpinePackages: [
      { name: "musl", version: "1.2.3-r0", license: "MIT" },
      { name: "zlib", version: "1.3.0-r0", license: "Zlib" },
    ],
  };

  const manifest = await collectBaseImageLicenses({
    filesystemRoot: filesystem,
    outputDir: output,
    policy,
    baseImage: policy.baseImage,
    nodeVersion: policy.nodeVersion,
    yarnVersion: policy.yarnVersion,
    toolPackageFile,
  });

  assert.deepEqual(
    manifest.alpinePackages.map(({ name, version, license }) => ({ name, version, license })),
    policy.alpinePackages,
  );
  assert.ok(manifest.licenseFiles.includes("spdx/MIT.txt"));
  assert.ok(manifest.licenseFiles.includes("spdx/Zlib.txt"));
  assert.ok(manifest.licenseFiles.includes("SOURCE-AVAILABILITY.md"));
  assert.equal(await readFile(path.join(output, "runtime/node-LICENSE.txt"), "utf8"), "Node license\n");
});

test("rejects an unreviewed base image package change", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "twd-base-licenses-"));
  await mkdir(path.join(root, "lib/apk/db"), { recursive: true });
  await writeFile(path.join(root, "lib/apk/db/installed"), "P:musl\nV:2.0.0-r0\nL:MIT\n");

  await assert.rejects(
    collectBaseImageLicenses({
      filesystemRoot: root,
      outputDir: path.join(root, "output"),
      policy: {
        baseImage: "node:test@sha256:fixture",
        nodeVersion: "1.0.0",
        yarnVersion: "1.0.0",
        alpinePackages: [{ name: "musl", version: "1.2.3-r0", license: "MIT" }],
      },
      baseImage: "node:test@sha256:fixture",
      nodeVersion: "1.0.0",
      yarnVersion: "1.0.0",
      toolPackageFile,
    }),
    /base image Alpine inventory differs from policy/,
  );
});

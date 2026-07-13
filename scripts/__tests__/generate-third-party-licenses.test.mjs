import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  collectInventory,
  discoverCommittedLockfiles,
  renderInventory,
} from "../generate-third-party-licenses.mjs";

test("discovers the committed npm lockfile graphs", async () => {
  const root = path.resolve(import.meta.dirname, "../..");
  const lockfiles = await discoverCommittedLockfiles(root);

  assert.deepEqual(lockfiles, [...lockfiles].sort());
  assert.deepEqual(
    lockfiles.filter((file) => file.endsWith("package-lock.json")),
    lockfiles,
  );
  assert.ok(lockfiles.includes("app/package-lock.json"));
  assert.ok(lockfiles.includes("app/migrator/package-lock.json"));
  assert.ok(lockfiles.includes("functions/generate-thumbnail/package-lock.json"));
});

test("collects and merges locked package versions deterministically", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "twd-licenses-"));
  await mkdir(path.join(root, "app"), { recursive: true });
  await mkdir(path.join(root, "worker"), { recursive: true });

  await writeLock(path.join(root, "app/package-lock.json"), {
    "node_modules/alpha": { version: "1.0.0", license: "MIT" },
    "node_modules/@scope/beta": { version: "2.0.0", license: "Apache-2.0", dev: true },
  });
  await writeLock(path.join(root, "worker/package-lock.json"), {
    "node_modules/alpha": { version: "1.0.0", license: "MIT" },
    "node_modules/missing": { version: "3.0.0" },
  });
  await writeFile(
    path.join(root, "overrides.json"),
    JSON.stringify({ "missing@3.0.0": { license: "ISC", evidence: "bundled LICENSE" } }),
  );

  const inventory = await collectInventory({
    rootDir: root,
    lockfiles: ["app/package-lock.json", "worker/package-lock.json"],
    overridesFile: "overrides.json",
  });

  assert.deepEqual(
    inventory.packages.map(({ name, version, license, graphs, scope, evidence }) => ({
      name,
      version,
      license,
      graphs,
      scope,
      evidence,
    })),
    [
      {
        name: "@scope/beta",
        version: "2.0.0",
        license: "Apache-2.0",
        graphs: ["app"],
        scope: "development",
        evidence: "lockfile",
      },
      {
        name: "alpha",
        version: "1.0.0",
        license: "MIT",
        graphs: ["app", "worker"],
        scope: "runtime",
        evidence: "lockfile",
      },
      {
        name: "missing",
        version: "3.0.0",
        license: "ISC",
        graphs: ["worker"],
        scope: "runtime",
        evidence: "override: bundled LICENSE",
      },
    ],
  );
  assert.equal(inventory.unknown.length, 0);

  const rendered = renderInventory(inventory);
  assert.match(rendered, /Locked package versions: 3/);
  assert.match(rendered, /`alpha` \| `1\.0\.0` \| `MIT` \| app, worker \| runtime/);
});

test("keeps missing license metadata visible as a release blocker", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "twd-licenses-"));
  await mkdir(path.join(root, "app"), { recursive: true });
  await writeLock(path.join(root, "app/package-lock.json"), {
    "node_modules/unknown": { version: "1.2.3" },
  });
  await writeFile(path.join(root, "overrides.json"), "{}\n");

  const inventory = await collectInventory({
    rootDir: root,
    lockfiles: ["app/package-lock.json"],
    overridesFile: "overrides.json",
  });

  assert.deepEqual(inventory.unknown, ["unknown@1.2.3"]);
  assert.match(renderInventory(inventory), /UNKNOWN.*release blocker/);
});

test("rejects invalid SPDX expressions declared by lockfiles", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "twd-licenses-"));
  await mkdir(path.join(root, "app"), { recursive: true });
  await writeLock(path.join(root, "app/package-lock.json"), {
    "node_modules/invalid": { version: "1.0.0", license: "definitely not SPDX" },
  });
  await writeFile(path.join(root, "overrides.json"), "{}\n");

  await assert.rejects(
    collectInventory({
      rootDir: root,
      lockfiles: ["app/package-lock.json"],
      overridesFile: "overrides.json",
    }),
    /invalid@1\.0\.0.*valid SPDX expression/,
  );
});

test("rejects overrides without reviewable evidence", async () => {
  const root = await createOverrideFixture({
    "unknown@1.2.3": { license: "MIT" },
  });

  await assert.rejects(
    collectInventory({
      rootDir: root,
      lockfiles: ["app/package-lock.json"],
      overridesFile: "overrides.json",
    }),
    /unknown@1\.2\.3.*non-empty evidence/,
  );
});

test("rejects overrides with invalid SPDX expressions", async () => {
  const root = await createOverrideFixture({
    "unknown@1.2.3": { license: "definitely not SPDX", evidence: "upstream LICENSE" },
  });

  await assert.rejects(
    collectInventory({
      rootDir: root,
      lockfiles: ["app/package-lock.json"],
      overridesFile: "overrides.json",
    }),
    /unknown@1\.2\.3.*valid SPDX expression/,
  );
});

test("rejects unused overrides", async () => {
  const root = await createOverrideFixture({
    "other@9.9.9": { license: "MIT", evidence: "upstream LICENSE" },
  });

  await assert.rejects(
    collectInventory({
      rootDir: root,
      lockfiles: ["app/package-lock.json"],
      overridesFile: "overrides.json",
    }),
    /unused license overrides: other@9\.9\.9/,
  );
});

async function createOverrideFixture(overrides) {
  const root = await mkdtemp(path.join(os.tmpdir(), "twd-licenses-"));
  await mkdir(path.join(root, "app"), { recursive: true });
  await writeLock(path.join(root, "app/package-lock.json"), {
    "node_modules/unknown": { version: "1.2.3" },
  });
  await writeFile(path.join(root, "overrides.json"), `${JSON.stringify(overrides)}\n`);
  return root;
}

async function writeLock(file, packages) {
  await writeFile(
    file,
    `${JSON.stringify({ name: "fixture", lockfileVersion: 3, packages: { "": {}, ...packages } }, null, 2)}\n`,
  );
}

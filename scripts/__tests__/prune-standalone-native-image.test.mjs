import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { pruneStandaloneNativeImageOptimizer } from "../../app/scripts/prune-standalone-native-image.mjs";

test("removes only Sharp packages from a standalone node_modules tree", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "twd-prune-sharp-"));
  const modules = path.join(root, "node_modules");
  for (const name of ["sharp", "@img/sharp-linux-x64", "@img/sharp-libvips-linux-x64", "other"]) {
    const directory = path.join(modules, name);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "package.json"), "{}\n");
  }

  const removed = await pruneStandaloneNativeImageOptimizer(root);

  assert.deepEqual(removed.sort(), [
    "node_modules/@img/sharp-libvips-linux-x64",
    "node_modules/@img/sharp-linux-x64",
    "node_modules/sharp",
  ]);
  await assert.rejects(access(path.join(modules, "sharp")));
  await access(path.join(modules, "other/package.json"));
});

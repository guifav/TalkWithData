import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptPath = path.join(repoRoot, "scripts", "test-migrations.sh");
const secretDatabaseUrl = "postgresql://operator:database-secret@private-db/talkwithdata";

test("migration verification emits sanitized success events", async () => {
  const commandDir = await createMockCommands({ npmExitCode: 0 });
  try {
    const result = runMigrationScript(commandDir);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /"event":"migration\.verification\.started"/);
    assert.match(result.stdout, /"event":"migration\.verification\.succeeded"/);
    assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /database-secret|private-db/);
  } finally {
    await rm(commandDir, { recursive: true, force: true });
  }
});

test("migration verification emits a sanitized failure event", async () => {
  const commandDir = await createMockCommands({ npmExitCode: 7 });
  try {
    const result = runMigrationScript(commandDir);

    assert.equal(result.status, 7);
    assert.match(result.stderr, /"event":"migration\.verification\.failed"/);
    assert.match(result.stderr, /"stage":"initial_deploy"/);
    assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /database-secret|private-db/);
  } finally {
    await rm(commandDir, { recursive: true, force: true });
  }
});

function runMigrationScript(commandDir) {
  return spawnSync("sh", [scriptPath], {
    cwd: path.join(repoRoot, "app"),
    encoding: "utf8",
    env: {
      ...process.env,
      DATABASE_URL: secretDatabaseUrl,
      PATH: `${commandDir}:${process.env.PATH}`,
    },
  });
}

async function createMockCommands({ npmExitCode }) {
  const commandDir = await mkdtemp(path.join(tmpdir(), "twd-migration-observability-"));
  const npmPath = path.join(commandDir, "npm");
  const psqlPath = path.join(commandDir, "psql");

  await writeFile(npmPath, `#!/bin/sh\nexit ${npmExitCode}\n`, "utf8");
  await writeFile(psqlPath, `#!/bin/sh\ncase "$*" in\n  *'_prisma_migrations'*) printf '3\\n' ;;\nesac\nexit 0\n`, "utf8");
  await chmod(npmPath, 0o755);
  await chmod(psqlPath, 0o755);
  return commandDir;
}

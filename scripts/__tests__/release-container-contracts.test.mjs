import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "../..");

test("Docker context allowlists production inputs without broad app inclusion", async () => {
  const dockerignore = await readFile(path.join(root, ".dockerignore"), "utf8");

  assert.doesNotMatch(dockerignore, /^!app\/\*\*$/m);
  assert.match(dockerignore, /^app\/\*\*$/m);
  for (const expected of [
    "!app/src/**",
    "!app/public/**",
    "!app/prisma/**",
    "app/.env*",
    "app/**/*.pem",
    "app/**/*.key",
    "app/**/*.crt",
    "app/**/*.p12",
    "app/**/*credentials*.json",
    "app/**/service-account*.json",
    "app/**/serviceAccount*.json",
    "app/**/application_default_credentials.json",
    "app/**/*firebase-adminsdk*.json",
    "app/**/*-key.json",
  ]) {
    assert.match(dockerignore, new RegExp(`^${escapeRegExp(expected)}$`, "m"));
  }
});

test("container notices preserve the repository-relative docs link", async () => {
  const dockerfile = await readFile(path.join(root, "app/Dockerfile"), "utf8");
  const runtimeSmoke = await readFile(
    path.join(root, "scripts/test-runtime-firebase-container.sh"),
    "utf8",
  );

  assert.match(
    dockerfile,
    /docs\/THIRD-PARTY-LICENSES\.md \.\/licenses\/docs\/THIRD-PARTY-LICENSES\.md/g,
  );
  assert.match(runtimeSmoke, /\/app\/licenses\/docs\/THIRD-PARTY-LICENSES\.md/g);
});

test("local storage smoke honors the no-cache contract", async () => {
  const script = await readFile(path.join(root, "scripts/test-local-storage-compose.sh"), "utf8");
  const workflow = await readFile(path.join(root, ".github/workflows/ci.yml"), "utf8");

  assert.match(script, /TWD_RUNTIME_CONFIG_NO_CACHE/);
  assert.match(script, /BUILD_COMMAND=\(docker compose/);
  assert.match(workflow, /Test bucketless local storage with Docker Compose[\s\S]*TWD_RUNTIME_CONFIG_NO_CACHE: "1"/);
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

test("standalone output excludes the unused native image optimizer", async () => {
  const config = await readFile(path.join(root, "app/next.config.ts"), "utf8");

  assert.match(config, /images:\s*\{\s*unoptimized:\s*true/);
  assert.match(config, /outputFileTracingRoot:\s*process\.cwd\(\)/);
  assert.match(config, /turbopack:\s*\{\s*root:\s*process\.cwd\(\)/);
  const packageJson = JSON.parse(await readFile(path.join(root, "app/package.json"), "utf8"));
  assert.equal(packageJson.scripts.postbuild, "node scripts/prune-standalone-native-image.mjs");
});

test("CI and Docker builds enforce all release license contracts", async () => {
  const workflow = await readFile(path.join(root, ".github/workflows/ci.yml"), "utf8");
  const dockerfile = await readFile(path.join(root, "app/Dockerfile"), "utf8");

  assert.match(workflow, /node --test \.\.\/scripts\/__tests__\/\*\.test\.mjs/);
  assert.match(dockerfile, /collect-base-image-licenses\.mjs/);
  assert.match(dockerfile, /third_party\/nodejs-docker-node\/LICENSE\.txt/);
  assert.match(dockerfile, /artifact-license-supplements\.json/);
  assert.match(dockerfile, /COPY --from=base-license-builder \/base-licenses \.\/licenses\/base/g);
});

test("binary release sources are bound to immutable upstream evidence", async () => {
  const policy = JSON.parse(
    await readFile(path.join(root, "scripts/base-image-policy.json"), "utf8"),
  );
  const chromium = await readFile(
    path.join(root, "third_party/chromium-149.0.7827.22/BINARY-PAYLOAD-NOTICES.md"),
    "utf8",
  );

  assert.deepEqual(policy.reviewedFiles, [{
    source: "usr/local/bin/docker-entrypoint.sh",
    sha256: "a15ac9589c04baf9da95b08e0e79b5cf1d75ab8dc64e06a5e68e4ceb0ad7c8ea",
  }]);
  assert.match(chromium, /nss-3\.90\.0-7\.amzn2023\.0\.1\.src\.rpm/);
  assert.match(chromium, /a30b86aa61b0b4afd66c3b3cad93bdd10c5cb04d313c50be857a32536841f2e0/);
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

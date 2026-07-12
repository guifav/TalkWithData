const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createFunctionCorrelationId,
  writeThumbnailEvent,
} = require("./dist/observability.js");

test("thumbnail events omit sensitive names and values", () => {
  const output = [];

  writeThumbnailEvent({
    level: "error",
    event: "thumbnail.generation.failed",
    correlationId: "thumbnail-request-123",
    metadata: {
      outcome: "failed",
      timestamp: "spoofed",
      level: "info",
      event: "thumbnail.generation.succeeded",
      correlationId: "spoofed",
      authorization: "Bearer request-secret",
      cookie: "session=cookie-secret",
      internalKey: "internal-secret",
      serviceAccount: { private_key: "private-secret" },
      dashboardCapability: "capability-secret",
      prompt: "private prompt",
      rows: [{ value: "private row" }],
      htmlContent: "private uploaded HTML",
      documentContents: "private document contents",
      databaseUrl: "postgresql://operator:database-secret@private-db/app",
      connectionString: "postgresql://operator:connection-secret@connection-db/app",
      pgUrl: "postgresql://operator:pg-secret@pg-db/app",
      password: "password-secret",
      passwd: "passwd-secret",
      pwd: "pwd-secret",
      passphrase: "passphrase-secret",
      databasePassword: "database-password-secret",
      clientPassphrase: "client-passphrase-secret",
      apiKeys: ["plural-api-key-secret"],
      keyMaterial: "key-material-secret",
      saKeyJson: "service-account-json-secret",
      fallbackBucketAlias: "private-bucket",
      storagePath: "dashboards/private/index.html",
      buffer: Buffer.from("private-buffer"),
      screenshotBuffer: "screenshot-buffer-secret",
      binaryPayload: Buffer.from("binary-payload-secret"),
      keyCount: 4,
      error: new Error("gs://private-bucket/private-file"),
    },
  }, {
    error: (message) => output.push(message),
    info: (message) => output.push(message),
    warn: (message) => output.push(message),
  }, () => new Date("2026-07-11T21:00:00.000Z"));

  assert.equal(output.length, 1);
  const serialized = output[0];
  assert.deepEqual(JSON.parse(serialized), {
    timestamp: "2026-07-11T21:00:00.000Z",
    level: "error",
    event: "thumbnail.generation.failed",
    correlationId: "thumbnail-request-123",
    outcome: "failed",
    keyCount: 4,
    error: { name: "Error" },
  });

  for (const forbidden of [
    "authorization",
    "cookie",
    "internalKey",
    "private_key",
    "dashboardCapability",
    "prompt",
    "rows",
    "htmlContent",
    "storagePath",
    "documentContents",
    "databaseUrl",
    "fallbackBucketAlias",
    "request-secret",
    "private-bucket",
    "private-db",
    "connection-db",
    "pg-db",
    "password-secret",
    "passwd-secret",
    "pwd-secret",
    "passphrase-secret",
    "database-password-secret",
    "client-passphrase-secret",
    "plural-api-key-secret",
    "key-material-secret",
    "service-account-json-secret",
    "private-buffer",
    "screenshot-buffer-secret",
    "binary-payload-secret",
    "spoofed",
  ]) {
    assert.equal(serialized.toLowerCase().includes(forbidden.toLowerCase()), false);
  }
});

test("function correlation IDs reject unsafe header values", () => {
  assert.equal(
    createFunctionCorrelationId("018f52a2-7e1d-7c4b-9a80-123456789abc", () => "generated-id"),
    "018f52a2-7e1d-7c4b-9a80-123456789abc",
  );
  assert.equal(
    createFunctionCorrelationId("secret-with-safe-characters", () => "generated-id"),
    "generated-id",
  );
});

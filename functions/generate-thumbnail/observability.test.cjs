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
      authorization: "Bearer request-secret",
      cookie: "session=cookie-secret",
      internalKey: "internal-secret",
      serviceAccount: { private_key: "private-secret" },
      dashboardCapability: "capability-secret",
      prompt: "private prompt",
      rows: [{ value: "private row" }],
      htmlContent: "private uploaded HTML",
      storagePath: "dashboards/private/index.html",
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
    "request-secret",
    "private-bucket",
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

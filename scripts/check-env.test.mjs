import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_PROVIDER_VARIABLES,
  REQUIRED_VARIABLES,
  parseEnv,
  validateEnv,
} from "./check-env.mjs";

function validEnvironment() {
  const entries = REQUIRED_VARIABLES.map((key) =>
    key === "ALLOWED_AUTH_DOMAIN" || key === "NEXT_PUBLIC_ALLOWED_AUTH_DOMAIN"
      ? `${key}=example.com`
      : `${key}=value`,
  );
  entries.push(`${AI_PROVIDER_VARIABLES[0]}=provider-key`);
  return entries.join("\n");
}

test("accepts a complete environment contract", () => {
  assert.deepEqual(validateEnv(validEnvironment()), []);
});

test("reports empty required values and a missing AI provider", () => {
  const contents = validEnvironment()
    .replace("DATABASE_URL=value", "DATABASE_URL=")
    .replace(`${AI_PROVIDER_VARIABLES[0]}=provider-key`, "");

  const errors = validateEnv(contents);
  assert.ok(errors.includes("missing required variable DATABASE_URL"));
  assert.ok(errors.some((error) => error.startsWith("set at least one AI provider key:")));
});

test("rejects mismatched public and server auth domains", () => {
  const contents = validEnvironment().replace(
    "NEXT_PUBLIC_ALLOWED_AUTH_DOMAIN=example.com",
    "NEXT_PUBLIC_ALLOWED_AUTH_DOMAIN=other.example.com",
  );

  assert.ok(
    validateEnv(contents).includes(
      "ALLOWED_AUTH_DOMAIN and NEXT_PUBLIC_ALLOWED_AUTH_DOMAIN must match",
    ),
  );
});

test("parses comments and quoted values without exposing them", () => {
  const { values, errors } = parseEnv([
    "# comment",
    'DATABASE_URL="postgresql://user:pass@localhost/db" # database',
    "APP_URL=https://example.com # public URL",
    "CALLBACK_URL=https://example.com/callback#fragment",
    "export STORAGE_PROVIDER='gcs' # provider",
  ].join("\n"));

  assert.deepEqual(errors, []);
  assert.equal(values.get("DATABASE_URL"), "postgresql://user:pass@localhost/db");
  assert.equal(values.get("APP_URL"), "https://example.com");
  assert.equal(values.get("CALLBACK_URL"), "https://example.com/callback");
  assert.equal(values.get("STORAGE_PROVIDER"), "gcs");
});

test("reports malformed lines and duplicate variables", () => {
  const { errors } = parseEnv("BROKEN\nDATABASE_URL=one\nDATABASE_URL=two");

  assert.deepEqual(errors, [
    "line 1: expected KEY=value",
    "line 3: duplicate variable DATABASE_URL",
  ]);
});

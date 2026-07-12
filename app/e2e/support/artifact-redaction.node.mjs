import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import AdmZip from "adm-zip";
import { redactArtifact } from "./artifact-redaction.mjs";

test("redacts browser session, embed, dashboard and encrypted values", () => {
  const firebaseToken = "eyJhbGciOiJub25lIn0.eyJzdWIiOiJmaXh0dXJlIn0.";
  const embedToken = "a".repeat(43);
  const dashToken = `v1.1783829000.${"b".repeat(64)}`;
  const input = JSON.stringify({
    authorization: `Bearer ${firebaseToken}`,
    embedUrl: `/embed/id?embed_token=${embedToken}`,
    runtimeBootstrap: `window.__TWD_DATA_TOKEN__="${dashToken}"`,
    escapedRuntimeBootstrap: `window.__TWD_DATA_TOKEN__=\\\"${dashToken}\\\"`,
    dashAuthorization: `Bearer ${dashToken}`,
    cookie: `dash_session_id=${dashToken}`,
    inspectionToken: "signed-inspection-value",
    credentialEnc: "encrypted-credential-value",
    credential: { private_key: "fixture-private-key" },
    escapedCredential: "{\\\"private_key\\\":\\\"escaped-private-key\\\"}",
  });

  const result = redactArtifact(input);

  assert.equal(result.redacted, 10);
  assert.doesNotMatch(result.content, /eyJ|signed-inspection|encrypted-credential|fixture-private|escaped-private/);
  assert.match(result.content, /REDACTED_FIREBASE_TOKEN/);
  assert.match(result.content, /REDACTED_EMBED_TOKEN/);
  assert.match(result.content, /REDACTED_DASH_TOKEN/);
  assert.match(result.content, /REDACTED_SECRET_VALUE/);
});

test("sanitizes extensionless trace resources without changing binary resources", () => {
  const supportDir = path.dirname(fileURLToPath(import.meta.url));
  const appDir = path.resolve(supportDir, "../..");
  const root = mkdtempSync(path.join(tmpdir(), "twd-artifacts-"));
  const archivePath = path.join(root, "trace.zip");
  const binary = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x10]);
  const zip = new AdmZip();
  zip.addFile("resources/request-body", Buffer.from(
    JSON.stringify({ private_key: "trace-private-key", token: "trace-token" }),
  ));
  zip.addFile("resources/screenshot", binary);
  zip.writeZip(archivePath);

  try {
    const result = spawnSync(
      process.execPath,
      [path.join(supportDir, "sanitize-artifacts.mjs"), root],
      { cwd: appDir, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);

    const sanitized = new AdmZip(readFileSync(archivePath));
    const text = sanitized.getEntry("resources/request-body")?.getData().toString("utf8");
    assert.doesNotMatch(text ?? "", /trace-private-key|trace-token/);
    assert.deepEqual(sanitized.getEntry("resources/screenshot")?.getData(), binary);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { redactArtifact } from "./artifact-redaction.mjs";

test("redacts browser session, embed, dashboard and encrypted values", () => {
  const firebaseToken = "eyJhbGciOiJub25lIn0.eyJzdWIiOiJmaXh0dXJlIn0.";
  const embedToken = "a".repeat(43);
  const dashToken = "b".repeat(64);
  const input = JSON.stringify({
    authorization: `Bearer ${firebaseToken}`,
    embedUrl: `/embed/id?embed_token=${embedToken}`,
    dashAuthorization: `Bearer ${dashToken}`,
    cookie: `dash_session_id=${dashToken}`,
    inspectionToken: "signed-inspection-value",
    credentialEnc: "encrypted-credential-value",
  });

  const result = redactArtifact(input);

  assert.equal(result.redacted, 6);
  assert.doesNotMatch(result.content, /eyJ|signed-inspection|encrypted-credential/);
  assert.match(result.content, /REDACTED_FIREBASE_TOKEN/);
  assert.match(result.content, /REDACTED_EMBED_TOKEN/);
  assert.match(result.content, /REDACTED_DASH_TOKEN/);
  assert.match(result.content, /REDACTED_SECRET_VALUE/);
});

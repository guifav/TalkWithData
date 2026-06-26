import { describe, it, expect } from "vitest";
import { signScope, verifyScope, buildScopeHeaders } from "@/lib/app-db/scope-signature";
process.env.ALLOWED_AUTH_DOMAIN = "example.com";
process.env.STORAGE_BUCKET_NAME = "test-bucket";

const SECRET = "test-secret-key-for-hmac";

describe("signScope", () => {
  it("generates deterministic signatures", () => {
    const sig1 = signScope("uid1", "dash1", "usr_abc", "d_abc", SECRET);
    const sig2 = signScope("uid1", "dash1", "usr_abc", "d_abc", SECRET);
    expect(sig1).toBe(sig2);
  });

  it("different inputs produce different signatures", () => {
    const sig1 = signScope("uid1", "dash1", "usr_abc", "d_abc", SECRET);
    const sig2 = signScope("uid2", "dash1", "usr_abc", "d_abc", SECRET);
    expect(sig1).not.toBe(sig2);
  });

  it("different secrets produce different signatures", () => {
    const sig1 = signScope("uid1", "dash1", "usr_abc", "d_abc", SECRET);
    const sig2 = signScope("uid1", "dash1", "usr_abc", "d_abc", "other-secret");
    expect(sig1).not.toBe(sig2);
  });
});

describe("verifyScope", () => {
  it("verifies valid signature", () => {
    const sig = signScope("uid1", "dash1", "usr_abc", "d_abc", SECRET);
    expect(verifyScope("uid1", "dash1", "usr_abc", "d_abc", sig, SECRET)).toBe(true);
  });

  it("rejects tampered userId", () => {
    const sig = signScope("uid1", "dash1", "usr_abc", "d_abc", SECRET);
    expect(verifyScope("uid-TAMPERED", "dash1", "usr_abc", "d_abc", sig, SECRET)).toBe(false);
  });

  it("rejects tampered dashboardId", () => {
    const sig = signScope("uid1", "dash1", "usr_abc", "d_abc", SECRET);
    expect(verifyScope("uid1", "dash-TAMPERED", "usr_abc", "d_abc", sig, SECRET)).toBe(false);
  });

  it("rejects tampered signature", () => {
    expect(verifyScope("uid1", "dash1", "usr_abc", "d_abc", "fake-signature", SECRET)).toBe(false);
  });

  it("rejects wrong secret", () => {
    const sig = signScope("uid1", "dash1", "usr_abc", "d_abc", SECRET);
    expect(verifyScope("uid1", "dash1", "usr_abc", "d_abc", sig, "wrong-secret")).toBe(false);
  });
});

describe("buildScopeHeaders", () => {
  it("returns all required headers", () => {
    const headers = buildScopeHeaders("uid1", "user@test.com", "dash1", "usr_abc", "d_abc", SECRET);
    expect(headers["X-Talk With Data-User-Id"]).toBe("uid1");
    expect(headers["X-Talk With Data-User-Email"]).toBe("user@test.com");
    expect(headers["X-Talk With Data-Dashboard-Id"]).toBe("dash1");
    expect(headers["X-Talk With Data-Schema"]).toBe("usr_abc");
    expect(headers["X-Talk With Data-Table-Prefix"]).toBe("d_abc");
    expect(headers["X-Talk With Data-Scope-Signature"]).toBeTruthy();
  });

  it("signature in headers verifies correctly", () => {
    const headers = buildScopeHeaders("uid1", "user@test.com", "dash1", "usr_abc", "d_abc", SECRET);
    expect(verifyScope("uid1", "dash1", "usr_abc", "d_abc", headers["X-Talk With Data-Scope-Signature"], SECRET)).toBe(true);
  });
});

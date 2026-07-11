import { afterEach, describe, expect, it, vi } from "vitest";

const runtimeConfig = {
  allowedAuthDomain: "runtime.example.com",
  apiKey: "runtime-api-key",
  authDomain: "runtime.firebaseapp.com",
  projectId: "runtime-project",
  storageBucket: "runtime.appspot.com",
  messagingSenderId: "987654321098",
  appId: "1:987654321098:web:runtime",
};

describe("allowed auth domain runtime configuration", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("reads the browser domain from the runtime bootstrap", async () => {
    vi.stubGlobal("window", { __TWD_FIREBASE_CONFIG__: runtimeConfig });
    const { getAllowedAuthDomain } = await import("@/lib/auth-domain");

    expect(getAllowedAuthDomain()).toBe("runtime.example.com");
  });

  it("uses an inert domain only during the Next.js build", async () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    vi.stubEnv("ALLOWED_AUTH_DOMAIN", "");
    const { getAllowedAuthDomain } = await import("@/lib/auth-domain");

    expect(getAllowedAuthDomain()).toBe("build-placeholder.invalid");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const firebaseMocks = vi.hoisted(() => ({
  initializeApp: vi.fn(() => ({ name: "runtime-app" })),
  getApps: vi.fn(() => []),
  getApp: vi.fn(() => ({ name: "existing-app" })),
  getAuth: vi.fn(() => ({ name: "auth" })),
  getFirestore: vi.fn(() => ({ name: "db" })),
}));

vi.mock("firebase/app", () => ({
  initializeApp: firebaseMocks.initializeApp,
  getApps: firebaseMocks.getApps,
  getApp: firebaseMocks.getApp,
}));
vi.mock("firebase/auth", () => ({ getAuth: firebaseMocks.getAuth }));
vi.mock("firebase/firestore", () => ({ getFirestore: firebaseMocks.getFirestore }));

const runtimeConfig = {
  apiKey: "runtime-api-key",
  authDomain: "runtime.firebaseapp.com",
  projectId: "runtime-project",
  storageBucket: "runtime.appspot.com",
  messagingSenderId: "987654321098",
  appId: "1:987654321098:web:runtime",
};

describe("Firebase client runtime configuration", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("initializes Firebase from the server bootstrap", async () => {
    vi.stubGlobal("window", { __TWD_FIREBASE_CONFIG__: runtimeConfig });

    await import("@/lib/firebase/client");

    expect(firebaseMocks.initializeApp).toHaveBeenCalledWith(runtimeConfig);
    expect(firebaseMocks.getAuth).toHaveBeenCalledWith({ name: "runtime-app" });
    expect(firebaseMocks.getFirestore).toHaveBeenCalledWith({ name: "runtime-app" });
  });

  it("fails clearly when the server bootstrap is missing", async () => {
    vi.stubGlobal("window", {});

    await expect(import("@/lib/firebase/client")).rejects.toThrow(
      "Firebase runtime configuration is missing",
    );
    expect(firebaseMocks.initializeApp).not.toHaveBeenCalled();
  });
});

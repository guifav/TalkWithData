import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDelete = vi.fn().mockResolvedValue(undefined);
const store = new Map<string, Record<string, unknown>>();

function tsIn(msFromNow: number) {
  const d = new Date(Date.now() + msFromNow);
  return { toDate: () => d };
}

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => new Date() },
}));

vi.mock("@/lib/firebase/admin", () => ({
  adminDb: {
    collection: () => ({
      doc: (dashboardId: string) => ({
        collection: () => ({
          doc: (token: string) => ({
            get: async () => {
              const data = store.get(`${dashboardId}/${token}`);
              return {
                exists: data !== undefined,
                data: () => data,
                ref: { delete: mockDelete },
              };
            },
          }),
        }),
      }),
    }),
  },
}));

const { verifyEmbedToken } = await import("@/lib/embed-tokens");

function seedToken(
  dashboardId: string,
  token: string,
  overrides: Record<string, unknown> = {}
) {
  store.set(`${dashboardId}/${token}`, {
    token,
    dashboardId,
    createdBy: "uid-owner",
    createdByEmail: "owner@example.com",
    expiresAt: tsIn(60_000),
    createdAt: tsIn(-60_000),
    ...overrides,
  });
}

beforeEach(() => {
  store.clear();
  mockDelete.mockClear();
});

describe("verifyEmbedToken", () => {
  it("accepts a valid unexpired token bound to the dashboard", async () => {
    seedToken("dash-a", "tokA");
    await expect(verifyEmbedToken("dash-a", "tokA")).resolves.toBe(true);
  });

  it("rejects a token used against a different dashboard", async () => {
    seedToken("dash-a", "tokA");
    await expect(verifyEmbedToken("dash-b", "tokA")).resolves.toBe(false);
  });

  it("rejects a record whose stored dashboardId does not match the lookup path", async () => {
    seedToken("dash-a", "tokA", { dashboardId: "dash-b" });
    await expect(verifyEmbedToken("dash-a", "tokA")).resolves.toBe(false);
  });

  it("rejects a record with missing or empty createdBy", async () => {
    seedToken("dash-a", "tokA", { createdBy: "" });
    await expect(verifyEmbedToken("dash-a", "tokA")).resolves.toBe(false);
    seedToken("dash-a", "tokB", { createdBy: undefined });
    await expect(verifyEmbedToken("dash-a", "tokB")).resolves.toBe(false);
  });

  it("rejects and deletes an expired token", async () => {
    seedToken("dash-a", "tokA", { expiresAt: tsIn(-1_000) });
    await expect(verifyEmbedToken("dash-a", "tokA")).resolves.toBe(false);
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed token strings without a Firestore read", async () => {
    await expect(verifyEmbedToken("dash-a", "not/a/token")).resolves.toBe(false);
    await expect(verifyEmbedToken("dash-a", "")).resolves.toBe(false);
  });
});

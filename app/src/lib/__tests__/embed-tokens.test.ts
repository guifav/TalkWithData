import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDelete = vi.fn().mockResolvedValue(undefined);
const store = new Map<string, Record<string, unknown>>();

// Two valid 43-char base64url tokens (matches the exact length
// createEmbedToken produces from 32 random bytes).
const TOK_A = "a".repeat(43);
const TOK_B = "b".repeat(43);

function tsIn(msFromNow: number) {
  const d = new Date(Date.now() + msFromNow);
  return { toDate: () => d };
}

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { serverTimestamp: () => new Date() },
}));

const mockGet = vi.fn(async (dashboardId: string, token: string) => {
  const data = store.get(`${dashboardId}/${token}`);
  return {
    exists: data !== undefined,
    data: () => data,
    ref: { delete: mockDelete },
  };
});

vi.mock("@/lib/firebase/admin", () => ({
  adminDb: {
    collection: () => ({
      doc: (dashboardId: string) => ({
        collection: () => ({
          doc: (token: string) => ({
            get: () => mockGet(dashboardId, token),
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
  mockGet.mockClear();
});

describe("verifyEmbedToken", () => {
  it("accepts a valid unexpired token bound to the dashboard", async () => {
    seedToken("dash-a", TOK_A);
    await expect(verifyEmbedToken("dash-a", TOK_A)).resolves.toBe(true);
  });

  it("rejects a token used against a different dashboard", async () => {
    seedToken("dash-a", TOK_A);
    await expect(verifyEmbedToken("dash-b", TOK_A)).resolves.toBe(false);
  });

  it("rejects a record whose stored dashboardId does not match the lookup path", async () => {
    seedToken("dash-a", TOK_A, { dashboardId: "dash-b" });
    await expect(verifyEmbedToken("dash-a", TOK_A)).resolves.toBe(false);
  });

  it("rejects a record with missing or empty createdBy", async () => {
    seedToken("dash-a", TOK_A, { createdBy: "" });
    await expect(verifyEmbedToken("dash-a", TOK_A)).resolves.toBe(false);
    seedToken("dash-a", TOK_B, { createdBy: undefined });
    await expect(verifyEmbedToken("dash-a", TOK_B)).resolves.toBe(false);
  });

  it("rejects a record with a non-string createdBy", async () => {
    seedToken("dash-a", TOK_A, { createdBy: null });
    await expect(verifyEmbedToken("dash-a", TOK_A)).resolves.toBe(false);
  });

  it("rejects and deletes an expired token", async () => {
    seedToken("dash-a", TOK_A, { expiresAt: tsIn(-1_000) });
    await expect(verifyEmbedToken("dash-a", TOK_A)).resolves.toBe(false);
    expect(mockDelete).toHaveBeenCalledTimes(1);
  });

  it("rejects a record with a missing or invalid expiresAt (no indefinite accept)", async () => {
    seedToken("dash-a", TOK_A, { expiresAt: undefined });
    await expect(verifyEmbedToken("dash-a", TOK_A)).resolves.toBe(false);
    seedToken("dash-a", TOK_B, { expiresAt: "not-a-date" });
    await expect(verifyEmbedToken("dash-a", TOK_B)).resolves.toBe(false);
    // toDate present but not callable must be rejected, not thrown.
    seedToken("dash-a", TOK_A, { expiresAt: { toDate: 123 } });
    await expect(verifyEmbedToken("dash-a", TOK_A)).resolves.toBe(false);
    // A toDate that throws must be caught and rejected, never propagate.
    seedToken("dash-a", TOK_A, {
      expiresAt: {
        toDate: () => {
          throw new Error("boom");
        },
      },
    });
    await expect(verifyEmbedToken("dash-a", TOK_A)).resolves.toBe(false);
    // An object that throws during primitive conversion must be caught too.
    seedToken("dash-a", TOK_B, {
      expiresAt: {
        valueOf: () => {
          throw new Error("boom");
        },
        toString: () => {
          throw new Error("boom");
        },
      },
    });
    await expect(verifyEmbedToken("dash-a", TOK_B)).resolves.toBe(false);
  });

  it("rejects malformed token strings without a Firestore read", async () => {
    await expect(verifyEmbedToken("dash-a", "not/a/token")).resolves.toBe(false);
    await expect(verifyEmbedToken("dash-a", "")).resolves.toBe(false);

    // Too short: legacy-style short token must not be accepted.
    await expect(verifyEmbedToken("dash-a", "tokA")).resolves.toBe(false);

    // Too long: one char over the exact 43-char base64url length.
    await expect(
      verifyEmbedToken("dash-a", "a".repeat(44))
    ).resolves.toBe(false);

    // Malformed dashboardId (a slash, or over the 1500-char doc-id limit) is
    // rejected before any Firestore lookup, so .doc() never receives it.
    await expect(verifyEmbedToken("dash/a", TOK_A)).resolves.toBe(false);
    await expect(
      verifyEmbedToken("d".repeat(1501), TOK_A)
    ).resolves.toBe(false);

    // None of the malformed inputs above should have reached Firestore.
    expect(mockGet).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockVerifyIdToken = vi.fn();

// Track Firestore state in-memory for the prompts collection.
type DocState = {
  exists: boolean;
  data: Record<string, unknown>;
};
const promptDocs = new Map<string, DocState>();
const versionDocs = new Map<string, Map<string, DocState>>();
const userDocs = new Map<string, DocState>();

function snapshot(state: DocState | undefined) {
  return {
    exists: state?.exists ?? false,
    data: () => state?.data ?? null,
  };
}

function userSnapshot(uid: string) {
  return snapshot(userDocs.get(uid));
}

let versionCounter = 0;

vi.mock("firebase-admin/firestore", () => {
  const Timestamp = class {
    seconds: number;
    nanoseconds: number;
    constructor(seconds: number, nanoseconds: number) {
      this.seconds = seconds;
      this.nanoseconds = nanoseconds;
    }
    toDate() {
      return new Date(this.seconds * 1000);
    }
  };
  const FieldValue = {
    serverTimestamp: () => new Timestamp(Math.floor(Date.now() / 1000), 0),
    delete: () => "__DELETE__",
  };
  return { Timestamp, FieldValue };
});

function applyMerge(
  current: Record<string, unknown>,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const next = { ...current };
  for (const [k, v] of Object.entries(incoming)) {
    if (v === "__DELETE__") {
      delete next[k];
    } else {
      next[k] = v;
    }
  }
  return next;
}

vi.mock("@/lib/firebase/admin", () => {
  const promptDocRef = (key: string) => ({
    get: async () => snapshot(promptDocs.get(key)),
    set: async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
      const current = promptDocs.get(key);
      const base = opts?.merge ? current?.data || {} : {};
      promptDocs.set(key, {
        exists: true,
        data: applyMerge(base, data),
      });
    },
    update: async (data: Record<string, unknown>) => {
      const current = promptDocs.get(key);
      promptDocs.set(key, {
        exists: true,
        data: applyMerge(current?.data || {}, data),
      });
    },
    collection: (sub: string) => {
      if (sub !== "versions") throw new Error(`Unknown subcollection: ${sub}`);
      const versionsMap = versionDocs.get(key) ?? new Map();
      versionDocs.set(key, versionsMap);

      const versionRef = (versionId: string) => ({
        id: versionId,
        get: async () => snapshot(versionsMap.get(versionId)),
        set: async (data: Record<string, unknown>) => {
          versionsMap.set(versionId, { exists: true, data });
        },
        update: async (data: Record<string, unknown>) => {
          const current = versionsMap.get(versionId);
          versionsMap.set(versionId, {
            exists: true,
            data: applyMerge(current?.data || {}, data),
          });
        },
      });

      return {
        doc: (id?: string) => versionRef(id ?? `v-${++versionCounter}`),
        orderBy: () => ({
          get: async () => ({
            docs: Array.from(versionsMap.entries())
              .sort(
                (a, b) =>
                  (b[1].data.version as number) - (a[1].data.version as number)
              )
              .map(([id, state]) => ({
                id,
                data: () => state.data,
              })),
          }),
        }),
        where: (_field: string, _op: string, value: unknown) => ({
          limit: () => ({
            get: async () => {
              const docs = Array.from(versionsMap.entries())
                .filter(([, s]) => s.data.version === value)
                .map(([id, state]) => ({
                  id,
                  ref: versionRef(id),
                  data: () => state.data,
                }));
              return { empty: docs.length === 0, docs };
            },
          }),
        }),
      };
    },
  });

  return {
    adminAuth: {
      verifyIdToken: mockVerifyIdToken,
    },
    adminDb: {
      collection: (name: string) => ({
        doc: (id: string) => {
          if (name === "app_prompts") return promptDocRef(id);
          if (name === "users") {
            return {
              get: async () => userSnapshot(id),
            };
          }
          throw new Error(`Unmocked collection: ${name}`);
        },
      }),
      runTransaction: async (
        fn: (tx: {
          get: (ref: { get: () => Promise<unknown> }) => Promise<unknown>;
          set: (
            ref: {
              set: (
                d: Record<string, unknown>,
                opts?: { merge?: boolean }
              ) => Promise<unknown>;
            },
            data: Record<string, unknown>,
            opts?: { merge?: boolean }
          ) => unknown;
          update: (
            ref: { update: (d: Record<string, unknown>) => Promise<unknown> },
            data: Record<string, unknown>
          ) => unknown;
        }) => unknown
      ) => {
        const tx = {
          get: (ref: { get: () => Promise<unknown> }) => ref.get(),
          set: (
            ref: {
              set: (
                d: Record<string, unknown>,
                opts?: { merge?: boolean }
              ) => Promise<unknown>;
            },
            data: Record<string, unknown>,
            opts?: { merge?: boolean }
          ) => ref.set(data, opts),
          update: (
            ref: { update: (d: Record<string, unknown>) => Promise<unknown> },
            data: Record<string, unknown>
          ) => ref.update(data),
        };
        return fn(tx);
      },
    },
  };
});

const { GET: listPrompts } = await import("@/app/api/admin/prompts/route");
const { GET: getPrompt } = await import(
  "@/app/api/admin/prompts/[key]/route"
);
const { POST: saveDraftRoute, DELETE: deleteDraftRoute } = await import(
  "@/app/api/admin/prompts/[key]/draft/route"
);
const { POST: publishRoute } = await import(
  "@/app/api/admin/prompts/[key]/publish/route"
);
const { POST: restoreRoute } = await import(
  "@/app/api/admin/prompts/[key]/restore/route"
);
const { invalidatePromptCache } = await import("@/lib/prompt-registry");

function makeRequest(
  token: string | null,
  body?: unknown,
  method = "GET"
): NextRequest {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return new NextRequest("http://localhost/api/admin/prompts/x", {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

function setupAuth(role: "user" | "admin" | "superadmin") {
  mockVerifyIdToken.mockResolvedValue({
    uid: `uid-${role}`,
    email: `${role}@example.com`,
    name: `Test ${role}`,
  });
  userDocs.set(`uid-${role}`, { exists: true, data: { role } });
}

beforeEach(() => {
  vi.clearAllMocks();
  promptDocs.clear();
  versionDocs.clear();
  userDocs.clear();
  versionCounter = 0;
  invalidatePromptCache();
});

describe("Prompts API — auth gates", () => {
  it("rejects unauthenticated requests with 403", async () => {
    const res = await listPrompts(makeRequest(null));
    expect(res.status).toBe(403);
  });

  it("rejects user role with 403", async () => {
    setupAuth("user");
    const res = await listPrompts(makeRequest("token"));
    expect(res.status).toBe(403);
  });

  it("rejects admin role with 403", async () => {
    setupAuth("admin");
    const res = await listPrompts(makeRequest("token"));
    expect(res.status).toBe(403);
  });

  it("allows superadmin", async () => {
    setupAuth("superadmin");
    const res = await listPrompts(makeRequest("token"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { prompts: unknown[] };
    expect(Array.isArray(body.prompts)).toBe(true);
    expect(body.prompts.length).toBeGreaterThan(0);
  });

  it("admin cannot save draft", async () => {
    setupAuth("admin");
    const res = await saveDraftRoute(
      makeRequest("token", { content: "x" }, "POST"),
      { params: Promise.resolve({ key: "builder.platform_rules" }) }
    );
    expect(res.status).toBe(403);
  });

  it("admin cannot publish", async () => {
    setupAuth("admin");
    const res = await publishRoute(
      makeRequest(
        "token",
        { content: "x", changeSummary: "y" },
        "POST"
      ),
      { params: Promise.resolve({ key: "builder.platform_rules" }) }
    );
    expect(res.status).toBe(403);
  });
});

describe("Prompts API — validation", () => {
  beforeEach(() => setupAuth("superadmin"));

  it("rejects unknown prompt key", async () => {
    const res = await getPrompt(makeRequest("token"), {
      params: Promise.resolve({ key: "totally.bogus" }),
    });
    expect(res.status).toBe(404);
  });

  it("rejects publish with empty content", async () => {
    const res = await publishRoute(
      makeRequest("token", { content: "", changeSummary: "ok" }, "POST"),
      { params: Promise.resolve({ key: "builder.platform_rules" }) }
    );
    expect(res.status).toBe(400);
  });

  it("rejects publish with missing changeSummary", async () => {
    const res = await publishRoute(
      makeRequest("token", { content: "hello" }, "POST"),
      { params: Promise.resolve({ key: "builder.platform_rules" }) }
    );
    expect(res.status).toBe(400);
  });

  it("rejects publish with summary > 500 chars", async () => {
    const longSummary = "x".repeat(501);
    const res = await publishRoute(
      makeRequest(
        "token",
        { content: "hello", changeSummary: longSummary },
        "POST"
      ),
      { params: Promise.resolve({ key: "builder.platform_rules" }) }
    );
    expect(res.status).toBe(400);
  });

  it("rejects draft with empty content", async () => {
    const res = await saveDraftRoute(
      makeRequest("token", { content: "" }, "POST"),
      { params: Promise.resolve({ key: "builder.platform_rules" }) }
    );
    expect(res.status).toBe(400);
  });

  it("rejects publish of refresh.system without required placeholders", async () => {
    const res = await publishRoute(
      makeRequest(
        "token",
        { content: "missing all placeholders", changeSummary: "ok" },
        "POST"
      ),
      { params: Promise.resolve({ key: "refresh.system" }) }
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; missing: string[] };
    expect(body.missing).toContain("${mcpFreshness}");
    expect(body.missing).toContain("${title}");
    expect(body.missing).toContain("${description}");
    expect(body.missing).toContain("${currentHtmlBlock}");
    expect(body.missing).toContain("${refreshedAt}");
  });

  it("rejects publish when content contains unknown global variables", async () => {
    const res = await publishRoute(
      makeRequest(
        "token",
        { content: "Use {{customerName}} in the prompt", changeSummary: "ok" },
        "POST"
      ),
      { params: Promise.resolve({ key: "builder.platform_rules" }) }
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; variables: string[] };
    expect(body.error).toBe("Unknown prompt variables");
    expect(body.variables).toEqual(["{{customerName}}"]);
  });

  it("rejects restore when the source version is missing required placeholders", async () => {
    versionDocs.set(
      "refresh.system",
      new Map([
        [
          "legacy-bad",
          {
            exists: true,
            data: {
              version: 1,
              content: "legacy content without template placeholders",
              status: "archived",
              changeSummary: "legacy",
              authorUid: "legacy",
              authorEmail: "legacy@example.com",
              createdAt: new Date("2026-05-15T00:00:00.000Z"),
              restoredFromVersion: null,
            },
          },
        ],
      ])
    );

    const res = await restoreRoute(
      makeRequest(
        "token",
        { versionId: "legacy-bad", changeSummary: "restore legacy" },
        "POST"
      ),
      { params: Promise.resolve({ key: "refresh.system" }) }
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; missing: string[] };
    expect(body.error).toBe("Required placeholders missing from template");
    expect(body.missing).toContain("${mcpFreshness}");
  });

  it("rejects restore when the source version contains unknown global variables", async () => {
    versionDocs.set(
      "builder.platform_rules",
      new Map([
        [
          "legacy-unknown-variable",
          {
            exists: true,
            data: {
              version: 1,
              content: "legacy {{customerName}}",
              status: "archived",
              changeSummary: "legacy",
              authorUid: "legacy",
              authorEmail: "legacy@example.com",
              createdAt: new Date("2026-05-15T00:00:00.000Z"),
              restoredFromVersion: null,
            },
          },
        ],
      ])
    );

    const res = await restoreRoute(
      makeRequest(
        "token",
        { versionId: "legacy-unknown-variable", changeSummary: "restore legacy" },
        "POST"
      ),
      { params: Promise.resolve({ key: "builder.platform_rules" }) }
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; variables: string[] };
    expect(body.error).toBe("Unknown prompt variables");
    expect(body.variables).toEqual(["{{customerName}}"]);
  });

  it("accepts publish when content contains approved global variables", async () => {
    const res = await publishRoute(
      makeRequest(
        "token",
        { content: "Use {{today}} and {{currentDatetime}}", changeSummary: "ok" },
        "POST"
      ),
      { params: Promise.resolve({ key: "builder.platform_rules" }) }
    );

    expect(res.status).toBe(200);
  });

  it("accepts publish of refresh.system when all placeholders present", async () => {
    const content =
      "${mcpFreshness} ${title} ${description} ${currentHtmlBlock} ${refreshedAt}";
    const res = await publishRoute(
      makeRequest(
        "token",
        { content, changeSummary: "ok" },
        "POST"
      ),
      { params: Promise.resolve({ key: "refresh.system" }) }
    );
    expect(res.status).toBe(200);
  });
});

describe("Prompts API — versioning behavior", () => {
  beforeEach(() => setupAuth("superadmin"));

  it("publish creates v1 active when no prior version", async () => {
    const res = await publishRoute(
      makeRequest(
        "token",
        { content: "first content", changeSummary: "initial" },
        "POST"
      ),
      { params: Promise.resolve({ key: "builder.platform_rules" }) }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { version: number };
    expect(body.version).toBe(1);

    const summary = promptDocs.get("builder.platform_rules");
    expect(summary?.data.activeVersion).toBe(1);
    expect(summary?.data.activeContent).toBe("first content");
  });

  it("publish creates v2 and archives v1", async () => {
    await publishRoute(
      makeRequest(
        "token",
        { content: "v1", changeSummary: "first" },
        "POST"
      ),
      { params: Promise.resolve({ key: "builder.platform_rules" }) }
    );
    const res2 = await publishRoute(
      makeRequest(
        "token",
        { content: "v2", changeSummary: "second" },
        "POST"
      ),
      { params: Promise.resolve({ key: "builder.platform_rules" }) }
    );
    expect(res2.status).toBe(200);
    const body = (await res2.json()) as { version: number };
    expect(body.version).toBe(2);

    const versions = Array.from(
      versionDocs.get("builder.platform_rules")?.values() ?? []
    );
    expect(versions.length).toBe(2);
    const statuses = versions.map((v) => v.data.status).sort();
    expect(statuses).toEqual(["active", "archived"]);
    expect(
      versions.find((v) => v.data.version === 1)?.data.status
    ).toBe("archived");
    expect(
      versions.find((v) => v.data.version === 2)?.data.status
    ).toBe("active");
  });

  it("restore creates a new active version referencing the source", async () => {
    await publishRoute(
      makeRequest(
        "token",
        { content: "v1-content", changeSummary: "first" },
        "POST"
      ),
      { params: Promise.resolve({ key: "builder.platform_rules" }) }
    );
    await publishRoute(
      makeRequest(
        "token",
        { content: "v2-content", changeSummary: "second" },
        "POST"
      ),
      { params: Promise.resolve({ key: "builder.platform_rules" }) }
    );

    // Find v1 doc id
    const versions = Array.from(
      versionDocs.get("builder.platform_rules")?.entries() ?? []
    );
    const v1Entry = versions.find(([, s]) => s.data.version === 1);
    expect(v1Entry).toBeDefined();
    const v1Id = v1Entry![0];

    const res = await restoreRoute(
      makeRequest(
        "token",
        { versionId: v1Id, changeSummary: "rollback to v1" },
        "POST"
      ),
      { params: Promise.resolve({ key: "builder.platform_rules" }) }
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { version: number };
    expect(body.version).toBe(3);

    const summary = promptDocs.get("builder.platform_rules");
    expect(summary?.data.activeVersion).toBe(3);
    expect(summary?.data.activeContent).toBe("v1-content");

    const allVersions = Array.from(
      versionDocs.get("builder.platform_rules")?.values() ?? []
    );
    expect(allVersions.length).toBe(3);
    const v3 = allVersions.find((v) => v.data.version === 3);
    expect(v3?.data.restoredFromVersion).toBe(1);
  });

  it("draft save then discard removes draft fields", async () => {
    await saveDraftRoute(
      makeRequest("token", { content: "draft body" }, "POST"),
      { params: Promise.resolve({ key: "builder.platform_rules" }) }
    );
    expect(
      promptDocs.get("builder.platform_rules")?.data.draftContent
    ).toBe("draft body");

    await deleteDraftRoute(makeRequest("token", undefined, "DELETE"), {
      params: Promise.resolve({ key: "builder.platform_rules" }),
    });
    expect(
      promptDocs.get("builder.platform_rules")?.data.draftContent
    ).toBeUndefined();
  });

  it("publish clears any existing draft", async () => {
    await saveDraftRoute(
      makeRequest("token", { content: "stale draft" }, "POST"),
      { params: Promise.resolve({ key: "builder.platform_rules" }) }
    );
    await publishRoute(
      makeRequest(
        "token",
        { content: "fresh published", changeSummary: "publish" },
        "POST"
      ),
      { params: Promise.resolve({ key: "builder.platform_rules" }) }
    );
    expect(
      promptDocs.get("builder.platform_rules")?.data.draftContent
    ).toBeUndefined();
  });
});

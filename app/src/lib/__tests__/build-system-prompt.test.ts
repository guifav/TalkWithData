import { beforeEach, describe, expect, it, vi } from "vitest";
process.env.ALLOWED_AUTH_DOMAIN = "example.com";
process.env.STORAGE_BUCKET_NAME = "test-bucket";

const mockDocGet = vi.fn();

vi.mock("@/lib/firebase/admin", () => ({
  adminDb: {
    collection: () => ({
      doc: () => ({ get: mockDocGet }),
    }),
  },
}));

const { buildSystemPrompt } = await import("@/lib/ai-prompt");
const {
  invalidatePromptCache,
  findMissingPlaceholders,
  getCatalogEntry,
} = await import("@/lib/prompt-registry");

beforeEach(() => {
  vi.clearAllMocks();
  invalidatePromptCache();
});

const servers = [
  {
    name: "TestServer",
    description: "Test source",
    tools: [{ name: "tool_a" }, { name: "tool_b" }],
  },
];

describe("buildSystemPrompt composition", () => {
  it("uses fallback when Firestore returns nothing", async () => {
    mockDocGet.mockResolvedValue({ exists: false, data: () => null });

    const built = await buildSystemPrompt(servers);
    expect(built.prompt).toContain(
      getCatalogEntry("builder.platform_rules").fallback
    );
    expect(built.prompt).toContain(
      getCatalogEntry("builder.platform_playbook").fallback
    );
    expect(built.prompt).toContain("Available Data Sources");
    expect(built.prompt).toContain("**TestServer**");

    // No version was used → every value is null
    expect(built.promptVersions).toEqual({
      "builder.platform_rules": null,
      "builder.mcp_freshness": null,
      "builder.dynamic_dashboard": null,
      "builder.platform_playbook": null,
    });
  });

  it("uses Firestore content for whichever key has an active version", async () => {
    mockDocGet.mockImplementation(() =>
      Promise.resolve({
        exists: true,
        data: () => ({
          activeVersion: 7,
          activeContent: "OVERRIDDEN_LAYER",
        }),
      })
    );

    const built = await buildSystemPrompt(servers);
    expect(built.prompt).toContain("OVERRIDDEN_LAYER");
    // Should NOT contain the hardcoded fallback intro line
    expect(built.prompt).not.toContain("You are a dashboard and app builder");
    for (const key of [
      "builder.platform_rules",
      "builder.mcp_freshness",
      "builder.dynamic_dashboard",
      "builder.platform_playbook",
    ]) {
      expect(built.promptVersions[key]).toBe(7);
    }
  });

  it("includes DB playbook only when hasDatabase=true", async () => {
    mockDocGet.mockResolvedValue({ exists: false, data: () => null });

    const without = await buildSystemPrompt(servers);
    expect(without.prompt).not.toContain(
      getCatalogEntry("builder.db_playbook").fallback
    );

    invalidatePromptCache();
    const withDb = await buildSystemPrompt(servers, {
      hasDatabase: true,
      dbState: { status: "ready", tables: [] },
    });
    expect(withDb.prompt).toContain(
      getCatalogEntry("builder.db_playbook").fallback
    );
    expect("builder.db_playbook" in withDb.promptVersions).toBe(true);
  });

  it("renders database state table list when provided", async () => {
    mockDocGet.mockResolvedValue({ exists: false, data: () => null });

    const built = await buildSystemPrompt(servers, {
      hasDatabase: true,
      dbState: {
        status: "ready",
        tables: [
          { logicalName: "contacts", rowCount: 42 },
          { logicalName: "deals" },
        ],
      },
    });
    expect(built.prompt).toContain("Current Database State");
    expect(built.prompt).toContain("**contacts** (42 rows)");
    expect(built.prompt).toContain("**deals** (? rows)");
  });
});

describe("findMissingPlaceholders", () => {
  it("returns empty for keys with no required placeholders", () => {
    expect(
      findMissingPlaceholders("builder.platform_rules", "anything goes")
    ).toEqual([]);
  });

  it("returns all required placeholders when content is empty-ish", () => {
    const missing = findMissingPlaceholders("refresh.system", "no placeholders here");
    expect(missing.sort()).toEqual(
      [
        "currentHtmlBlock",
        "description",
        "mcpFreshness",
        "refreshedAt",
        "title",
      ].sort()
    );
  });

  it("returns only the placeholders that are actually missing", () => {
    const partial = "Has ${title} and ${mcpFreshness} but not the others";
    const missing = findMissingPlaceholders("refresh.system", partial);
    expect(missing.sort()).toEqual(
      ["currentHtmlBlock", "description", "refreshedAt"].sort()
    );
  });

  it("the fallback for refresh.system contains every required placeholder", () => {
    const entry = getCatalogEntry("refresh.system");
    expect(
      findMissingPlaceholders("refresh.system", entry.fallback)
    ).toEqual([]);
  });
});

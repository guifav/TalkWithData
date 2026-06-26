import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDocGet = vi.fn();

vi.mock("@/lib/firebase/admin", () => ({
  adminDb: {
    collection: () => ({
      doc: () => ({ get: mockDocGet }),
    }),
  },
}));

const {
  renderDataChatSystemPrompt,
  DATA_CHAT_SYSTEM_FALLBACK,
  buildDataChatSystemPrompt,
} = await import("@/lib/data-chat-prompt-fallback");
const { invalidatePromptCache, getCatalogEntry } = await import(
  "@/lib/prompt-registry"
);

beforeEach(() => {
  vi.clearAllMocks();
  invalidatePromptCache();
});

describe("renderDataChatSystemPrompt", () => {
  const baseVars = { mcpFreshness: "[FRESHNESS]" };

  it("substitutes mcpFreshness in the fallback template", () => {
    const out = renderDataChatSystemPrompt(DATA_CHAT_SYSTEM_FALLBACK, baseVars);
    expect(out).toContain("[FRESHNESS]");
    expect(out).not.toContain("${mcpFreshness}");
    expect(out).toContain("data analyst for the GRI Institute");
  });

  it("does NOT re-substitute placeholder syntax that appears inside a value", () => {
    const out = renderDataChatSystemPrompt(
      "Freshness: ${mcpFreshness}",
      { mcpFreshness: "${mcpFreshness}" }
    );
    expect(out).toBe("Freshness: ${mcpFreshness}");
  });

  it("leaves unknown placeholders untouched", () => {
    const out = renderDataChatSystemPrompt("hello ${unknown} world", baseVars);
    expect(out).toBe("hello ${unknown} world");
  });

  it("handles repeated placeholders", () => {
    const out = renderDataChatSystemPrompt(
      "${mcpFreshness} | ${mcpFreshness}",
      baseVars
    );
    expect(out).toBe("[FRESHNESS] | [FRESHNESS]");
  });

  it("fallback template includes every required placeholder", () => {
    expect(DATA_CHAT_SYSTEM_FALLBACK).toContain("${mcpFreshness}");
  });
});

const servers = [
  {
    name: "TestServer",
    description: "Test source",
    tools: [{ name: "tool_a" }, { name: "tool_b" }],
  },
];

describe("buildDataChatSystemPrompt", () => {
  it("uses fallback when Firestore returns nothing", async () => {
    mockDocGet.mockResolvedValue({ exists: false, data: () => null });

    const built = await buildDataChatSystemPrompt(servers);

    // Fallback content present
    expect(built.prompt).toContain("data analyst for the GRI Institute");
    // mcpFreshness layer was substituted (no leftover placeholder)
    expect(built.prompt).not.toContain("${mcpFreshness}");
    expect(built.prompt).toContain(
      getCatalogEntry("builder.mcp_freshness").fallback
    );
    // Data sources block appended
    expect(built.prompt).toContain("## Available Data Sources");
    expect(built.prompt).toContain("**TestServer**");

    expect(built.promptVersions).toEqual({
      "data_chat.system": null,
      "builder.mcp_freshness": null,
    });
  });

  it("uses Firestore active version for data_chat.system when present", async () => {
    // Different content per key — single .doc().get() call per resolve, so we
    // alternate by call order: data_chat.system first, then builder.mcp_freshness.
    mockDocGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          activeVersion: 4,
          activeContent: "OVERRIDDEN_BASE ${mcpFreshness}",
        }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({
          activeVersion: 9,
          activeContent: "FRESH_OVERRIDE",
        }),
      });

    const built = await buildDataChatSystemPrompt(servers);

    expect(built.prompt).toContain("OVERRIDDEN_BASE FRESH_OVERRIDE");
    // mcpFreshness placeholder fully substituted (no leftover literal)
    expect(built.prompt).not.toContain("${mcpFreshness}");
    expect(built.prompt).not.toContain("data analyst for the GRI Institute");
    expect(built.promptVersions["data_chat.system"]).toBe(4);
    expect(built.promptVersions["builder.mcp_freshness"]).toBe(9);
  });

  it("renders the data sources list from MCP servers", async () => {
    mockDocGet.mockResolvedValue({ exists: false, data: () => null });

    const built = await buildDataChatSystemPrompt([
      { name: "Culkin", description: "GRI analytics", tools: [{ name: "x" }] },
      {
        name: "Marketing",
        description: "Ads + SEO",
        tools: [{ name: "y" }, { name: "z" }],
      },
    ]);

    expect(built.prompt).toContain("- **Culkin**: GRI analytics (1 tools)");
    expect(built.prompt).toContain("- **Marketing**: Ads + SEO (2 tools)");
  });
});

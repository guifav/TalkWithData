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
  resolvePrompt,
  invalidatePromptCache,
  isKnownPromptKey,
  getCatalogEntry,
  PROMPT_CATALOG,
  validatePromptContent,
} = await import("@/lib/prompt-registry");

beforeEach(() => {
  vi.clearAllMocks();
  invalidatePromptCache();
});

describe("prompt-registry catalog", () => {
  it("exposes all expected keys", () => {
    const keys = PROMPT_CATALOG.map((e) => e.key).sort();
    expect(keys).toEqual(
      [
        "builder.db_playbook",
        "builder.dynamic_dashboard",
        "builder.gri_playbook",
        "builder.mcp_freshness",
        "builder.platform_rules",
        "data_chat.system",
        "refresh.system",
      ].sort()
    );
  });

  it("marks refresh.system as a template", () => {
    const entry = getCatalogEntry("refresh.system");
    expect(entry.isTemplate).toBe(true);
  });

  it("marks data_chat.system as a template requiring mcpFreshness", () => {
    const entry = getCatalogEntry("data_chat.system");
    expect(entry.isTemplate).toBe(true);
    expect(entry.requiredPlaceholders).toEqual(["mcpFreshness"]);
  });

  it("isKnownPromptKey accepts known and rejects unknown", () => {
    expect(isKnownPromptKey("builder.platform_rules")).toBe(true);
    expect(isKnownPromptKey("data_chat.system")).toBe(true);
    expect(isKnownPromptKey("does.not.exist")).toBe(false);
  });

  it("every catalog entry has a non-empty fallback", () => {
    for (const entry of PROMPT_CATALOG) {
      expect(entry.fallback.length).toBeGreaterThan(0);
    }
  });

  it("every catalog entry exposes governance metadata and global variables", () => {
    for (const entry of PROMPT_CATALOG) {
      expect(entry.governance.purpose.length).toBeGreaterThan(0);
      expect(entry.governance.consumers.length).toBeGreaterThan(0);
      expect(entry.governance.sourceFiles.length).toBeGreaterThan(0);
      expect(entry.governance.impact.length).toBeGreaterThan(0);
      expect(entry.governance.risks.length).toBeGreaterThan(0);
      expect(entry.globalVariables.map((v) => v.token)).toContain("{{today}}");
    }
  });

  it("every catalog fallback has no unknown global variables", () => {
    for (const entry of PROMPT_CATALOG) {
      expect(validatePromptContent(entry.key, entry.fallback)).toEqual({
        missingPlaceholders: [],
        unknownVariables: [],
      });
    }
  });
});

describe("resolvePrompt", () => {
  it("returns Firestore active version when present", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ activeVersion: 3, activeContent: "live content" }),
    });

    const resolved = await resolvePrompt("builder.platform_rules");
    expect(resolved.source).toBe("firestore");
    expect(resolved.version).toBe(3);
    expect(resolved.content).toBe("live content");
  });

  it("falls back to hardcoded when doc does not exist", async () => {
    mockDocGet.mockResolvedValueOnce({ exists: false, data: () => null });

    const resolved = await resolvePrompt("builder.gri_playbook");
    expect(resolved.source).toBe("fallback");
    expect(resolved.version).toBeNull();
    expect(resolved.content).toBe(
      getCatalogEntry("builder.gri_playbook").fallback
    );
  });

  it("falls back when activeContent is empty string", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ activeVersion: 1, activeContent: "" }),
    });

    const resolved = await resolvePrompt("builder.mcp_freshness");
    expect(resolved.source).toBe("fallback");
    expect(resolved.version).toBeNull();
  });

  it("falls back when Firestore read throws", async () => {
    mockDocGet.mockRejectedValueOnce(new Error("boom"));

    const resolved = await resolvePrompt("builder.dynamic_dashboard");
    expect(resolved.source).toBe("fallback");
    expect(resolved.content).toBe(
      getCatalogEntry("builder.dynamic_dashboard").fallback
    );
  });

  it("caches resolution within TTL", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ activeVersion: 1, activeContent: "cached" }),
    });

    const first = await resolvePrompt("builder.db_playbook");
    const second = await resolvePrompt("builder.db_playbook");

    expect(first.content).toBe("cached");
    expect(second.content).toBe("cached");
    expect(mockDocGet).toHaveBeenCalledTimes(1);
  });

  it("invalidatePromptCache forces a fresh read", async () => {
    mockDocGet
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ activeVersion: 1, activeContent: "v1" }),
      })
      .mockResolvedValueOnce({
        exists: true,
        data: () => ({ activeVersion: 2, activeContent: "v2" }),
      });

    const first = await resolvePrompt("builder.platform_rules");
    expect(first.content).toBe("v1");

    invalidatePromptCache("builder.platform_rules");
    const second = await resolvePrompt("builder.platform_rules");
    expect(second.content).toBe("v2");
    expect(mockDocGet).toHaveBeenCalledTimes(2);
  });

  it("renders approved global variables before returning prompt content", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-15T03:30:45.000Z"));
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        activeVersion: 5,
        activeContent: "Use data {{today}} e horario {{currentDatetime}}",
      }),
    });

    try {
      const resolved = await resolvePrompt("builder.platform_rules");
      expect(resolved.content).toBe(
        "Use data 2026-05-15 e horario 2026-05-15 00:30:45 America/Sao_Paulo"
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders global variables after cache hits so temporal values do not go stale", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-15T03:30:00.000Z"));
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        activeVersion: 5,
        activeContent: "Horario {{currentDatetime}}",
      }),
    });

    try {
      const first = await resolvePrompt("builder.platform_rules");
      vi.setSystemTime(new Date("2026-05-15T03:30:10.000Z"));
      const second = await resolvePrompt("builder.platform_rules");

      expect(first.content).toBe(
        "Horario 2026-05-15 00:30:00 America/Sao_Paulo"
      );
      expect(second.content).toBe(
        "Horario 2026-05-15 00:30:10 America/Sao_Paulo"
      );
      expect(mockDocGet).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back instead of returning Firestore content with unknown variables", async () => {
    mockDocGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        activeVersion: 5,
        activeContent: "Invalid {{customerName}}",
      }),
    });

    const resolved = await resolvePrompt("builder.platform_rules");
    expect(resolved.source).toBe("fallback");
    expect(resolved.version).toBeNull();
    expect(resolved.content).toBe(
      getCatalogEntry("builder.platform_rules").fallback
    );
  });
});

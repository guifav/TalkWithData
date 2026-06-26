import { describe, it, expect } from "vitest";
import {
process.env.ALLOWED_AUTH_DOMAIN = "example.com";
process.env.STORAGE_BUCKET_NAME = "test-bucket";
  renderRefreshSystemPrompt,
  REFRESH_SYSTEM_FALLBACK,
} from "@/lib/refresh-prompt-fallback";

describe("renderRefreshSystemPrompt", () => {
  const baseVars = {
    mcpFreshness: "[FRESHNESS]",
    title: "My Dashboard",
    description: "Test",
    currentHtmlBlock: "[HTML BLOCK]",
    refreshedAt: "2026-05-14T17:00:00.000Z",
  };

  it("substitutes all known placeholders", () => {
    const out = renderRefreshSystemPrompt(REFRESH_SYSTEM_FALLBACK, baseVars);
    expect(out).toContain("[FRESHNESS]");
    expect(out).toContain("My Dashboard");
    expect(out).toContain("Test");
    expect(out).toContain("[HTML BLOCK]");
    expect(out).toContain("2026-05-14T17:00:00.000Z");
  });

  it("does NOT re-substitute placeholder syntax that appears inside a value", () => {
    // A malicious / weird dashboard title that contains placeholder syntax
    // must be inserted as-is and not trigger a second substitution pass.
    const out = renderRefreshSystemPrompt(
      "Title: ${title}\nFreshness: ${mcpFreshness}",
      { ...baseVars, title: "${mcpFreshness}", mcpFreshness: "REAL_FRESHNESS" }
    );
    expect(out).toBe(
      "Title: ${mcpFreshness}\nFreshness: REAL_FRESHNESS"
    );
  });

  it("leaves unknown placeholders untouched", () => {
    const out = renderRefreshSystemPrompt("hello ${unknown} world", baseVars);
    expect(out).toBe("hello ${unknown} world");
  });

  it("handles repeated placeholders", () => {
    const out = renderRefreshSystemPrompt(
      "${title} - ${title} - ${title}",
      baseVars
    );
    expect(out).toBe("My Dashboard - My Dashboard - My Dashboard");
  });

  it("fallback template includes every required placeholder", () => {
    for (const name of [
      "mcpFreshness",
      "title",
      "description",
      "currentHtmlBlock",
      "refreshedAt",
    ]) {
      expect(REFRESH_SYSTEM_FALLBACK).toContain(`\${${name}}`);
    }
  });
});

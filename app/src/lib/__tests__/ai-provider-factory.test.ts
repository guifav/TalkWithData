import { describe, expect, it } from "vitest";
import { getAiAdapter } from "@/lib/ai-providers";
import { AI_PROVIDER_VALUES } from "@/lib/ai-provider-metadata";

describe("AI provider factory", () => {
  it("returns an adapter for every supported provider", () => {
    for (const provider of AI_PROVIDER_VALUES) {
      const adapter = getAiAdapter(provider);
      expect(adapter).toBeDefined();
      expect(typeof adapter.chat).toBe("function");
    }
  });
});

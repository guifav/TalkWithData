import { describe, expect, it } from "vitest";
import {
process.env.ALLOWED_AUTH_DOMAIN = "example.com";
process.env.STORAGE_BUCKET_NAME = "test-bucket";
  findUnknownGlobalVariables,
  getGlobalPromptVariableValues,
  renderGlobalPromptVariables,
} from "@/lib/prompt-governance";

describe("prompt global variables", () => {
  const now = new Date("2026-05-15T03:30:45.000Z");

  it("renders approved date variables in the product timezone", () => {
    const rendered = renderGlobalPromptVariables(
      "Hoje={{today}} Data={{currentDate}} Agora={{currentDatetime}}",
      { now }
    );

    expect(rendered.content).toBe(
      "Hoje=2026-05-15 Data=2026-05-15 Agora=2026-05-15 00:30:45 America/Sao_Paulo"
    );
    expect(rendered.unknownVariables).toEqual([]);
  });

  it("leaves unknown variables untouched and reports them", () => {
    const rendered = renderGlobalPromptVariables(
      "Known {{today}} unknown {{customerName}}",
      { now }
    );

    expect(rendered.content).toContain("Known 2026-05-15");
    expect(rendered.content).toContain("{{customerName}}");
    expect(rendered.unknownVariables).toEqual(["{{customerName}}"]);
  });

  it("deduplicates unknown variables in first-seen order", () => {
    expect(
      findUnknownGlobalVariables("{{foo}} {{today}} {{bar}} {{foo}}")
    ).toEqual(["{{foo}}", "{{bar}}"]);
  });

  it("exposes values for preview rendering", () => {
    expect(getGlobalPromptVariableValues({ now })).toEqual({
      today: "2026-05-15",
      currentDate: "2026-05-15",
      currentDatetime: "2026-05-15 00:30:45 America/Sao_Paulo",
    });
  });
});

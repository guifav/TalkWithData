import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { anthropicAdapter } from "@/lib/ai-providers/anthropic";
import type { AiMessage } from "@/lib/ai-providers/types";
import type { AiModelConfig } from "@/lib/ai-model";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

afterAll(() => {
  vi.unstubAllGlobals();
});

const CONFIG = {
  provider: "anthropic",
  model: "claude-sonnet-5",
  apiKey: "k-test",
} as AiModelConfig;

function okResponse(): Response {
  return new Response(
    JSON.stringify({
      content: [{ type: "text", text: "ok" }],
      stop_reason: "end_turn",
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        cache_read_input_tokens: 7,
        cache_creation_input_tokens: 3,
      },
    }),
    { status: 200 },
  );
}

function sentBody(): Record<string, unknown> {
  const [, init] = fetchMock.mock.calls[0] as [string, { body: string }];
  return JSON.parse(init.body) as Record<string, unknown>;
}

const MESSAGES: AiMessage[] = [
  { role: "user", content: "pergunta" },
  {
    role: "assistant",
    content: [{ type: "tool_use", id: "t1", name: "query_dataset", input: {} }],
  },
  {
    role: "user",
    content: [
      { type: "tool_result", tool_use_id: "t1", content: "resultado-1" },
      { type: "tool_result", tool_use_id: "t2", content: "resultado-2" },
    ],
  },
];

describe("anthropic adapter prompt caching", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(okResponse());
  });

  it("com enableCache marca system e o ultimo bloco da ultima mensagem", async () => {
    await anthropicAdapter.chat(MESSAGES, CONFIG, {
      system: "SYS",
      enableCache: true,
    });

    const body = sentBody();
    expect(body.system).toEqual([
      { type: "text", text: "SYS", cache_control: { type: "ephemeral" } },
    ]);

    const messages = body.messages as Array<{
      content: Array<Record<string, unknown>> | string;
    }>;
    const lastContent = messages[messages.length - 1]
      .content as Array<Record<string, unknown>>;
    expect(lastContent[0].cache_control).toBeUndefined();
    expect(lastContent[1].cache_control).toEqual({ type: "ephemeral" });
    // Nenhum outro bloco de mensagens anteriores recebe cache_control.
    const middleContent = messages[1].content as Array<Record<string, unknown>>;
    expect(middleContent[0].cache_control).toBeUndefined();
  });

  it("nao muta as mensagens do caller", async () => {
    const snapshot = JSON.parse(JSON.stringify(MESSAGES));
    await anthropicAdapter.chat(MESSAGES, CONFIG, {
      system: "SYS",
      enableCache: true,
    });
    expect(MESSAGES).toEqual(snapshot);
  });

  it("sem enableCache mantem o formato legado (system string, sem cache_control)", async () => {
    await anthropicAdapter.chat(MESSAGES, CONFIG, { system: "SYS" });
    const body = sentBody();
    expect(body.system).toBe("SYS");
    expect(JSON.stringify(body.messages)).not.toContain("cache_control");
  });

  it("mapeia os tokens de cache no usage", async () => {
    const result = await anthropicAdapter.chat(MESSAGES, CONFIG, {
      system: "SYS",
      enableCache: true,
    });
    expect(result.usage).toEqual({
      inputTokens: 10,
      outputTokens: 5,
      cacheReadInputTokens: 7,
      cacheCreationInputTokens: 3,
    });
  });

  it("envolve conteudo string da ultima mensagem em bloco de texto", async () => {
    await anthropicAdapter.chat(
      [{ role: "user", content: "so texto" }],
      CONFIG,
      { system: "SYS", enableCache: true },
    );
    const body = sentBody();
    const messages = body.messages as Array<{ content: unknown }>;
    expect(messages[0].content).toEqual([
      { type: "text", text: "so texto", cache_control: { type: "ephemeral" } },
    ]);
  });
});

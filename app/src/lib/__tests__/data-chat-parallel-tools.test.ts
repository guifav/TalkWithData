import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Testa o loop agentico da rota data-chat: multiplos tool_use no MESMO turno
// devem executar em paralelo e os tool_results devem voltar em UMA mensagem
// user, na ordem original dos blocos.

const chatMock = vi.fn();
const queryDatasetMock = vi.fn();

vi.mock("@/lib/api-auth", () => ({
  verifyRequest: async () => ({ uid: "u1" }),
}));
vi.mock("@/lib/ai-model", () => ({
  resolveUserModel: async () => ({
    config: { provider: "anthropic", model: "m", apiKey: "k" },
  }),
}));
vi.mock("@/lib/ai-providers", () => ({
  AiProviderError: class AiProviderError extends Error {},
  getAiAdapter: () => ({
    chat: (...args: unknown[]) => chatMock(...args),
  }),
}));
vi.mock("@/lib/firebase/admin", () => ({ adminDb: {} }));
vi.mock("@/lib/data-sources/firestore", () => ({
  listDataSources: async () => [
    {
      id: "ds-a",
      kind: "csv",
      orgId: "org",
      bucket: "b",
      prefix: "p/",
      configVersion: 1,
      ownerColumn: "owner",
      accessGrants: { assignedUsers: ["u1"], assignedDepartments: [] },
    },
  ],
}));
vi.mock("@/lib/data-sources/access", () => ({
  canQueryDataSource: async () => ({ canQuery: true }),
}));
vi.mock("@/lib/data-sources/query", () => ({
  queryDataset: (...args: unknown[]) => queryDatasetMock(...args),
  dataSourceToRuntime: (meta: object) => meta,
  createQuerySession: () => ({
    dsMeta: new Map(),
    auth: new Map(),
    viewerScope: new Map(),
    credDoc: new Map(),
  }),
}));
vi.mock("@/lib/dataset-chat-prompt", () => ({
  buildDatasetChatSystemPrompt: async () => ({
    prompt: "SYS",
    promptVersions: {},
  }),
  QUERY_DATASET_TOOL: {
    name: "query_dataset",
    description: "",
    input_schema: { type: "object", properties: {} },
  },
}));
vi.mock("@/lib/data-sources/duckdb-engine", () => ({
  getCachedSchema: () => null,
}));

import { POST } from "@/app/api/ai/data-chat/route";

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/ai/data-chat", {
    method: "POST",
    body: JSON.stringify({
      messages: [{ role: "user", content: "pergunta" }],
    }),
  });
}

describe("POST /api/ai/data-chat (execucao paralela de tools)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executa tool_use do mesmo turno em paralelo e preserva a ordem dos results", async () => {
    chatMock
      .mockResolvedValueOnce({
        content: "",
        rawContent: [
          {
            type: "tool_use",
            id: "call-a",
            name: "query_dataset",
            input: { dataSourceId: "ds-a", query: "SELECT 1" },
          },
          {
            type: "tool_use",
            id: "call-b",
            name: "query_dataset",
            input: { dataSourceId: "ds-a", query: "SELECT 2" },
          },
        ],
        stopReason: "tool_use",
      })
      .mockResolvedValueOnce({
        content: "pronto",
        rawContent: [{ type: "text", text: "pronto" }],
        stopReason: "end_turn",
      });

    // As duas queries so resolvem depois que AMBAS iniciarem: uma
    // implementacao sequencial ficaria em deadlock (timeout do teste).
    const started: Array<(value: unknown) => void> = [];
    queryDatasetMock.mockImplementation(
      (args: { sql: string }) =>
        new Promise((resolve) => {
          started.push(() =>
            resolve({ columns: ["x"], rows: [[args.sql]], truncated: false }),
          );
          if (started.length === 2) {
            for (const release of started) release(undefined);
          }
        }),
    );

    const res = await POST(makeRequest());
    const streamText = await res.text();

    expect(queryDatasetMock).toHaveBeenCalledTimes(2);
    expect(chatMock).toHaveBeenCalledTimes(2);

    // Segunda chamada ao modelo: ultima mensagem e UMA mensagem user com os
    // tool_results na ordem original dos blocos (call-a antes de call-b).
    const secondCallMessages = chatMock.mock.calls[1][0] as Array<{
      role: string;
      content: unknown;
    }>;
    const lastMessage = secondCallMessages[secondCallMessages.length - 1];
    expect(lastMessage.role).toBe("user");
    const results = lastMessage.content as Array<{
      type: string;
      tool_use_id: string;
    }>;
    expect(results.map((r) => r.tool_use_id)).toEqual(["call-a", "call-b"]);

    // Os eventos SSE contem os dois status de done e o done final do stream.
    expect(streamText).toContain('"type":"done"');
  }, 10_000);
});

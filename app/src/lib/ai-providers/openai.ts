import type { AiAdapter, AiChatOptions, AiChatResult, AiContentBlock, AiMessage, AiTool } from "./types";
import { AiProviderError } from "./types";
import type { AiModelConfig, AiProvider } from "@/lib/ai-model";

interface OpenAiToolCall {
  id: string;
  type?: string;
  function?: { name?: string; arguments?: string };
}

interface OpenAiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_call_id?: string;
  tool_calls?: OpenAiToolCall[];
}

function textFromBlocks(blocks: AiContentBlock[]): string {
  return blocks
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}

function parseJsonObject(value: string | undefined): Record<string, unknown> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function toOpenAiTools(tools?: AiTool[]) {
  if (!tools?.length) return undefined;
  return tools.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }));
}

function toOpenAiMessages(messages: AiMessage[], options?: AiChatOptions): OpenAiMessage[] {
  const out: OpenAiMessage[] = [];
  if (options?.system) {
    out.push({ role: "system", content: options.system });
  }

  for (const message of messages) {
    if (typeof message.content === "string") {
      out.push({ role: message.role, content: message.content });
      continue;
    }

    if (message.role === "assistant") {
      const toolCalls = message.content
        .filter((block): block is Extract<AiContentBlock, { type: "tool_use" }> => block.type === "tool_use")
        .map((block) => ({
          id: block.id,
          type: "function" as const,
          function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) },
        }));
      out.push({
        role: "assistant",
        content: textFromBlocks(message.content) || null,
        ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
      });
      continue;
    }

    for (const block of message.content) {
      if (block.type === "tool_result") {
        out.push({ role: "tool", tool_call_id: block.tool_use_id, content: block.content });
      } else if (block.type === "text") {
        out.push({ role: message.role === "system" ? "system" : "user", content: block.text });
      }
    }
  }

  return out;
}

function normalizeBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  return `${trimmed}/chat/completions`;
}

export class OpenAiAdapter implements AiAdapter {
  constructor(
    private readonly provider: AiProvider = "openai",
    private readonly baseUrl = "https://api.openai.com/v1/chat/completions"
  ) {}

  async chat(messages: AiMessage[], config: AiModelConfig, options: AiChatOptions = {}): Promise<AiChatResult> {
    if (!config.apiKey) {
      throw new AiProviderError(
        `AI provider "${this.provider}" is not configured. Set its API key before using this model.`,
        { provider: this.provider, type: "missing_api_key" }
      );
    }

    const endpoint = normalizeBaseUrl(config.baseUrl || this.baseUrl);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: toOpenAiMessages(messages, options),
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
        ...(options.tools?.length ? { tools: toOpenAiTools(options.tools), tool_choice: "auto" } : {}),
      }),
    });

    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? JSON.parse(text) as Record<string, unknown> : {};
    } catch {
      data = { raw: text };
    }

    if (!res.ok) {
      const error = data.error as { message?: string; type?: string } | undefined;
      throw new AiProviderError(error?.message || `${this.provider} API error: ${res.status}`, {
        provider: this.provider,
        status: res.status,
        type: error?.type || "api_error",
        detail: text,
      });
    }

    const choices = data.choices as Array<{ finish_reason?: string; message?: { content?: string | null; tool_calls?: OpenAiToolCall[] } }> | undefined;
    const message = choices?.[0]?.message || {};
    const rawContent: AiContentBlock[] = [];
    if (message.content) rawContent.push({ type: "text", text: message.content });
    for (const call of message.tool_calls || []) {
      rawContent.push({
        type: "tool_use",
        id: call.id,
        name: call.function?.name || "unknown_tool",
        input: parseJsonObject(call.function?.arguments),
      });
    }

    const usage = data.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
    return {
      content: rawContent.filter((block): block is { type: "text"; text: string } => block.type === "text").map((block) => block.text).join("\n"),
      rawContent,
      stopReason: message.tool_calls?.length ? "tool_use" : choices?.[0]?.finish_reason,
      usage: usage ? { inputTokens: usage.prompt_tokens || 0, outputTokens: usage.completion_tokens || 0 } : undefined,
    };
  }
}

export const openAiAdapter = new OpenAiAdapter();

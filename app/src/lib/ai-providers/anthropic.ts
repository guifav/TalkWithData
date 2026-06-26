import type { AiAdapter, AiChatOptions, AiChatResult, AiContentBlock, AiMessage } from "./types";
import { AiProviderError } from "./types";
import type { AiModelConfig } from "@/lib/ai-model";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

function toAnthropicMessages(messages: AiMessage[]): Array<{ role: "user" | "assistant"; content: string | AiContentBlock[] }> {
  return messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
    }));
}

function collectSystem(messages: AiMessage[], options?: AiChatOptions): string | undefined {
  const systemMessages = messages
    .filter((message) => message.role === "system")
    .map((message) => typeof message.content === "string" ? message.content : "")
    .filter(Boolean);
  if (options?.system) systemMessages.unshift(options.system);
  return systemMessages.length > 0 ? systemMessages.join("\n\n") : undefined;
}

export function buildAnthropicHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  };
}

class AnthropicAdapter implements AiAdapter {
  async chat(messages: AiMessage[], config: AiModelConfig, options: AiChatOptions = {}): Promise<AiChatResult> {
    if (!config.apiKey) {
      throw new AiProviderError(
        "AI provider \"anthropic\" is not configured. Set ANTHROPIC_API_KEY before using Anthropic models.",
        { provider: "anthropic", type: "missing_api_key" }
      );
    }

    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: buildAnthropicHeaders(config.apiKey),
      body: JSON.stringify({
        model: config.model,
        max_tokens: options.maxTokens || 16384,
        system: collectSystem(messages, options),
        ...(options.tools?.length ? { tools: options.tools } : {}),
        messages: toAnthropicMessages(messages),
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
      throw new AiProviderError(error?.message || `Anthropic API error: ${res.status}`, {
        provider: "anthropic",
        status: res.status,
        type: error?.type || "api_error",
        detail: text,
      });
    }

    const rawContent = (data.content || []) as AiContentBlock[];
    const usage = data.usage as { input_tokens?: number; output_tokens?: number } | undefined;
    return {
      content: rawContent
        .filter((block): block is { type: "text"; text: string } => block.type === "text")
        .map((block) => block.text)
        .join("\n"),
      rawContent,
      stopReason: data.stop_reason as string | undefined,
      usage: usage ? { inputTokens: usage.input_tokens || 0, outputTokens: usage.output_tokens || 0 } : undefined,
    };
  }
}

export const anthropicAdapter = new AnthropicAdapter();

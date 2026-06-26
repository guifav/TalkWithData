import type { AiAdapter, AiChatOptions, AiChatResult, AiContentBlock, AiMessage, AiTool } from "./types";
import { AiProviderError } from "./types";
import type { AiModelConfig } from "@/lib/ai-model";

interface GeminiPart {
  text?: string;
  functionCall?: { name?: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

function toolNameById(messages: AiMessage[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const message of messages) {
    if (Array.isArray(message.content)) {
      for (const block of message.content) {
        if (block.type === "tool_use") map.set(block.id, block.name);
      }
    }
  }
  return map;
}

function toGeminiTools(tools?: AiTool[]) {
  if (!tools?.length) return undefined;
  return [{
    functionDeclarations: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    })),
  }];
}

function toGeminiContents(messages: AiMessage[]) {
  const idToName = toolNameById(messages);
  return messages
    .filter((message) => message.role !== "system")
    .flatMap((message) => {
      if (typeof message.content === "string") {
        return [{ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] }];
      }

      const parts: GeminiPart[] = [];
      for (const block of message.content) {
        if (block.type === "text") parts.push({ text: block.text });
        if (block.type === "tool_use") parts.push({ functionCall: { name: block.name, args: block.input || {} } });
        if (block.type === "tool_result") {
          parts.push({
            functionResponse: {
              name: idToName.get(block.tool_use_id) || block.tool_use_id,
              response: { content: block.content },
            },
          });
        }
      }

      if (parts.length === 0) return [];
      const hasFunctionResponse = parts.some((part) => part.functionResponse);
      return [{ role: hasFunctionResponse ? "function" : message.role === "assistant" ? "model" : "user", parts }];
    });
}

function collectSystem(messages: AiMessage[], options?: AiChatOptions): string | undefined {
  const systemMessages = messages
    .filter((message) => message.role === "system")
    .map((message) => typeof message.content === "string" ? message.content : "")
    .filter(Boolean);
  if (options?.system) systemMessages.unshift(options.system);
  return systemMessages.length > 0 ? systemMessages.join("\n\n") : undefined;
}

class GoogleAdapter implements AiAdapter {
  async chat(messages: AiMessage[], config: AiModelConfig, options: AiChatOptions = {}): Promise<AiChatResult> {
    if (!config.apiKey) {
      throw new AiProviderError(
        "AI provider \"google\" is not configured. Set GOOGLE_AI_API_KEY before using Gemini models.",
        { provider: "google", type: "missing_api_key" }
      );
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`;
    const system = collectSystem(messages, options);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: toGeminiContents(messages),
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        ...(options.tools?.length ? { tools: toGeminiTools(options.tools) } : {}),
        generationConfig: { maxOutputTokens: options.maxTokens || 8192 },
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
      const error = data.error as { message?: string; status?: string } | undefined;
      throw new AiProviderError(error?.message || `Google Gemini API error: ${res.status}`, {
        provider: "google",
        status: res.status,
        type: error?.status || "api_error",
        detail: text,
      });
    }

    const candidate = (data.candidates as Array<{ finishReason?: string; content?: { parts?: GeminiPart[] } }> | undefined)?.[0];
    const rawContent: AiContentBlock[] = [];
    for (const [idx, part] of (candidate?.content?.parts || []).entries()) {
      if (part.text) rawContent.push({ type: "text", text: part.text });
      if (part.functionCall?.name) {
        rawContent.push({
          type: "tool_use",
          id: `gemini_${Date.now()}_${idx}`,
          name: part.functionCall.name,
          input: part.functionCall.args || {},
        });
      }
    }

    const usage = data.usageMetadata as { promptTokenCount?: number; candidatesTokenCount?: number } | undefined;
    return {
      content: rawContent.filter((block): block is { type: "text"; text: string } => block.type === "text").map((block) => block.text).join("\n"),
      rawContent,
      stopReason: rawContent.some((block) => block.type === "tool_use") ? "tool_use" : candidate?.finishReason,
      usage: usage ? { inputTokens: usage.promptTokenCount || 0, outputTokens: usage.candidatesTokenCount || 0 } : undefined,
    };
  }
}

export const googleAdapter = new GoogleAdapter();

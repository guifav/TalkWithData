import type { AiModelConfig, AiProvider } from "@/lib/ai-model";

export type AiContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

export interface AiMessage {
  role: "user" | "assistant" | "system";
  content: string | AiContentBlock[];
}

export interface AiChatResult {
  content: string;
  usage?: { inputTokens: number; outputTokens: number };
  rawContent?: AiContentBlock[];
  stopReason?: string;
}

export interface AiTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface AiChatOptions {
  maxTokens?: number;
  system?: string;
  tools?: AiTool[];
}

export interface AiAdapter {
  chat(
    messages: AiMessage[],
    config: AiModelConfig,
    options?: AiChatOptions
  ): Promise<AiChatResult>;
  streamChat?(
    messages: AiMessage[],
    config: AiModelConfig,
    options?: AiChatOptions
  ): AsyncGenerator<AiChatResult>;
}

export class AiProviderError extends Error {
  provider?: AiProvider;
  status?: number;
  type?: string;
  detail?: string;

  constructor(
    message: string,
    opts: { provider?: AiProvider; status?: number; type?: string; detail?: string } = {}
  ) {
    super(message);
    this.name = "AiProviderError";
    this.provider = opts.provider;
    this.status = opts.status;
    this.type = opts.type;
    this.detail = opts.detail;
  }
}

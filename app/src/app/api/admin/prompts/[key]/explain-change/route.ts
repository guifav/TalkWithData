import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/api-auth";
import { isKnownPromptKey, getCatalogEntry } from "@/lib/prompt-registry";
import { resolveUserModel } from "@/lib/ai-model";
import { getAiAdapter } from "@/lib/ai-providers";
import type { AiMessage } from "@/lib/ai-providers";

export const dynamic = "force-dynamic";

// Note: compared against String.length (UTF-16 code units), not bytes.
// Safe because we just want to prevent unbounded payloads to the AI provider.
const MAX_CONTENT_CHARS = 200_000;

interface ExplainBody {
  previousContent?: unknown;
  newContent?: unknown;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { key } = await params;
  if (!isKnownPromptKey(key)) {
    return NextResponse.json({ error: "Unknown prompt key" }, { status: 404 });
  }

  let body: ExplainBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const previous =
    typeof body.previousContent === "string" ? body.previousContent : "";
  const next = typeof body.newContent === "string" ? body.newContent : "";

  if (!next.trim()) {
    return NextResponse.json(
      { error: "newContent is required" },
      { status: 400 }
    );
  }
  if (previous.length > MAX_CONTENT_CHARS || next.length > MAX_CONTENT_CHARS) {
    return NextResponse.json(
      { error: "Content too large for explain-change" },
      { status: 413 }
    );
  }

  const entry = getCatalogEntry(key);

  let aiModel;
  try {
    aiModel = await resolveUserModel(auth.uid);
  } catch (err) {
    console.error("[Prompts API] explain-change: model unavailable:", err);
    return NextResponse.json(
      { error: "AI model not configured" },
      { status: 503 }
    );
  }

  const system = `You compare two versions of an internal system prompt and write a short, factual change summary in Brazilian Portuguese.

Rules:
- Maximum 280 characters.
- Describe FUNCTIONAL changes only (rules added/removed, behavior changes). Skip purely cosmetic edits (whitespace, punctuation).
- No marketing language. No filler. No "this change..." preamble.
- Plain text, single line preferred.
- If there are no meaningful changes, respond exactly: "Sem mudancas funcionais relevantes."`;

  const user = `Prompt key: ${key}
Label: ${entry.label}

--- VERSAO ANTERIOR ---
${previous || "(vazio, nao havia versao anterior)"}

--- NOVA VERSAO ---
${next}

Resumo da mudanca:`;

  try {
    const adapter = getAiAdapter(aiModel.config.provider);
    const messages: AiMessage[] = [{ role: "user", content: user }];
    const result = await adapter.chat(messages, aiModel.config, {
      maxTokens: 400,
      system,
    });
    const summary = result.content.trim();

    if (!summary) {
      return NextResponse.json(
        { error: "AI returned an empty summary" },
        { status: 502 }
      );
    }

    const capped = summary.length > 500 ? summary.slice(0, 500) : summary;
    return NextResponse.json({ summary: capped });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      console.error("[Prompts API] explain-change timed out");
      return NextResponse.json(
        { error: "AI provider timeout" },
        { status: 504 }
      );
    }
    console.error("[Prompts API] explain-change failed:", err);
    return NextResponse.json(
      { error: "Failed to generate summary" },
      { status: 500 }
    );
  }
}

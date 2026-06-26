import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/api-auth";
import { isKnownPromptKey, validatePromptContent } from "@/lib/prompt-registry";
import {
  publishVersion,
  validateChangeSummary,
  validateContent,
} from "@/lib/firestore/prompts";

export const dynamic = "force-dynamic";

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

  let body: { content?: unknown; changeSummary?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!validateContent(body.content)) {
    return NextResponse.json(
      { error: "Content must be a non-empty string" },
      { status: 400 }
    );
  }
  const { missingPlaceholders: missing, unknownVariables } =
    validatePromptContent(key, body.content);
  if (missing.length > 0) {
    return NextResponse.json(
      {
        error: "Required placeholders missing from template",
        missing: missing.map((name) => `\${${name}}`),
      },
      { status: 400 }
    );
  }
  if (unknownVariables.length > 0) {
    return NextResponse.json(
      {
        error: "Unknown prompt variables",
        variables: unknownVariables,
      },
      { status: 400 }
    );
  }
  if (!validateChangeSummary(body.changeSummary)) {
    return NextResponse.json(
      { error: "changeSummary is required (max 500 chars)" },
      { status: 400 }
    );
  }

  try {
    const result = await publishVersion(
      key,
      body.content,
      body.changeSummary,
      auth
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[Prompts API] publish failed:", err);
    return NextResponse.json(
      { error: "Failed to publish version" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/api-auth";
import { isKnownPromptKey, validatePromptContent } from "@/lib/prompt-registry";
import {
  getPromptVersion,
  restoreVersion,
  validateChangeSummary,
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

  let body: { versionId?: unknown; changeSummary?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.versionId !== "string" || !body.versionId) {
    return NextResponse.json(
      { error: "versionId is required" },
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
    const source = await getPromptVersion(key, body.versionId);
    if (!source) {
      return NextResponse.json(
        { error: "Source version not found" },
        { status: 404 }
      );
    }
    const { missingPlaceholders, unknownVariables } = validatePromptContent(
      key,
      source.content
    );
    if (missingPlaceholders.length > 0) {
      return NextResponse.json(
        {
          error: "Required placeholders missing from template",
          missing: missingPlaceholders.map((name) => `\${${name}}`),
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
    const result = await restoreVersion(
      key,
      body.versionId,
      body.changeSummary,
      auth
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg.includes("not found")) {
      return NextResponse.json(
        { error: "Source version not found" },
        { status: 404 }
      );
    }
    console.error("[Prompts API] restore failed:", err);
    return NextResponse.json(
      { error: "Failed to restore version" },
      { status: 500 }
    );
  }
}

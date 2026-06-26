import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/api-auth";
import { isKnownPromptKey } from "@/lib/prompt-registry";
import {
  saveDraft,
  discardDraft,
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

  let body: { content?: unknown };
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

  try {
    await saveDraft(key, body.content, auth);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Prompts API] draft save failed:", err);
    return NextResponse.json(
      { error: "Failed to save draft" },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

  try {
    await discardDraft(key);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Prompts API] draft discard failed:", err);
    return NextResponse.json(
      { error: "Failed to discard draft" },
      { status: 500 }
    );
  }
}

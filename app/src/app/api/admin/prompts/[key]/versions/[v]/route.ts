import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/api-auth";
import { isKnownPromptKey } from "@/lib/prompt-registry";
import { getPromptVersion } from "@/lib/firestore/prompts";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string; v: string }> }
) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { key, v } = await params;
  if (!isKnownPromptKey(key)) {
    return NextResponse.json({ error: "Unknown prompt key" }, { status: 404 });
  }
  if (!v) {
    return NextResponse.json({ error: "Missing version id" }, { status: 400 });
  }

  try {
    const version = await getPromptVersion(key, v);
    if (!version) {
      return NextResponse.json(
        { error: "Version not found" },
        { status: 404 }
      );
    }
    return NextResponse.json({ version });
  } catch (err) {
    console.error("[Prompts API] version fetch failed:", err);
    return NextResponse.json(
      { error: "Failed to load version" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/api-auth";
import { isKnownPromptKey } from "@/lib/prompt-registry";
import {
  getPromptDetail,
  listPromptVersions,
} from "@/lib/firestore/prompts";

export const dynamic = "force-dynamic";

export async function GET(
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
    const [detail, versions] = await Promise.all([
      getPromptDetail(key),
      listPromptVersions(key),
    ]);
    return NextResponse.json({ prompt: detail, versions });
  } catch (err) {
    console.error("[Prompts API] detail failed:", err);
    return NextResponse.json(
      { error: "Failed to load prompt" },
      { status: 500 }
    );
  }
}

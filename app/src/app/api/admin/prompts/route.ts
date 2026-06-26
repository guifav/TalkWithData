import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/api-auth";
import { listPromptSummaries } from "@/lib/firestore/prompts";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const prompts = await listPromptSummaries();
    return NextResponse.json({ prompts });
  } catch (err) {
    console.error("[Prompts API] list failed:", err);
    return NextResponse.json(
      { error: "Failed to list prompts" },
      { status: 500 }
    );
  }
}

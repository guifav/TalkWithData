import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/api-auth";

/**
 * POST /api/admin/mcp-servers/seed
 * No default MCP servers are seeded. Configure MCP servers from the admin UI.
 */
export async function POST(request: NextRequest) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({
    created: [],
    skipped: [],
    message: "No default MCP servers configured. Add MCP servers from the admin UI.",
  });
}

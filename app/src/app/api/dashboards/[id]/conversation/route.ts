import { NextRequest, NextResponse } from "next/server";
import { verifyRequest, type UserRole } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";
import { checkUserHasMcpAccess } from "@/lib/mcp-access";

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function canAccessConversation(
  dashboardId: string,
  user: { uid: string }
): Promise<boolean | "not-found" | "mcp-required"> {
  const [dashDoc, userDoc] = await Promise.all([
    adminDb.collection("dashboards").doc(dashboardId).get(),
    adminDb.collection("users").doc(user.uid).get(),
  ]);

  if (!dashDoc.exists) return "not-found";

  const role = (userDoc.data()?.role as UserRole | undefined) || "user";
  if (role === "superadmin") return true;

  if (dashDoc.data()?.createdBy !== user.uid) return false;

  const hasMcpAccess = await checkUserHasMcpAccess(user.uid);
  return hasMcpAccess ? true : "mcp-required";
}

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await verifyRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const access = await canAccessConversation(id, auth);
    if (access === "not-found") {
      return NextResponse.json({ error: "Dashboard not found" }, { status: 404 });
    }
    if (access === "mcp-required") {
      return NextResponse.json({ error: "MCP access required" }, { status: 403 });
    }
    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const doc = await adminDb
      .collection("dashboards")
      .doc(id)
      .collection("conversations")
      .doc("main")
      .get();

    if (!doc.exists) {
      return NextResponse.json({ messages: [], parsedFiles: [] });
    }

    const data = doc.data();
    return NextResponse.json({
      messages: data?.messages || [],
      parsedFiles: data?.parsedFiles || [],
    });
  } catch (error) {
    console.error("[Conversation GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversation" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await verifyRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const { messages } = body as { messages: unknown[] };

    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { error: "messages array required" },
        { status: 400 }
      );
    }

    const access = await canAccessConversation(id, auth);
    if (access === "not-found") {
      return NextResponse.json(
        { error: "Dashboard not found" },
        { status: 404 }
      );
    }
    if (access === "mcp-required") {
      return NextResponse.json({ error: "MCP access required" }, { status: 403 });
    }
    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await adminDb
      .collection("dashboards")
      .doc(id)
      .collection("conversations")
      .doc("main")
      .set({ messages, updatedAt: new Date().toISOString() });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Conversation POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to save conversation" },
      { status: 500 }
    );
  }
}

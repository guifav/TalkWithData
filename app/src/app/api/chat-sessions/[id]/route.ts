import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";

/**
 * GET — Get a specific chat session with messages.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const docRef = adminDb.collection("chat_sessions").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    const data = doc.data()!;
    if (data.userId !== auth.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      id: doc.id,
      title: data.title,
      messages: data.messages || [],
      mcpServerIds: data.mcpServerIds || [],
      usedTools: data.usedTools || [],
      selectedMcpIds: data.selectedMcpIds || null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  } catch (error) {
    console.error("[Chat Sessions] Get error:", error);
    return NextResponse.json(
      { error: "Failed to get chat session" },
      { status: 500 }
    );
  }
}

/**
 * PATCH — Update session (title, messages, mcpServerIds, usedTools).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const docRef = adminDb.collection("chat_sessions").doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    if (doc.data()?.userId !== auth.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.title !== undefined) updates.title = body.title;
    if (body.messages !== undefined) updates.messages = body.messages;
    if (body.mcpServerIds !== undefined) updates.mcpServerIds = body.mcpServerIds;
    if (body.usedTools !== undefined) updates.usedTools = body.usedTools;
    if (body.selectedMcpIds !== undefined) updates.selectedMcpIds = body.selectedMcpIds;

    await docRef.update(updates);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Chat Sessions] Update error:", error);
    return NextResponse.json(
      { error: "Failed to update chat session" },
      { status: 500 }
    );
  }
}

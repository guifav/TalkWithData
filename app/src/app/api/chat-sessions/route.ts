import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

/**
 * GET — List user's chat sessions (ordered by updatedAt desc).
 */
export async function GET(request: NextRequest) {
  const auth = await verifyRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const snap = await adminDb
      .collection("chat_sessions")
      .where("userId", "==", auth.uid)
      .orderBy("updatedAt", "desc")
      .get();

    const sessions = snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || "Untitled",
        updatedAt: data.updatedAt || data.createdAt,
        messageCount: (data.messages || []).length,
      };
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("[Chat Sessions] List error:", error);
    return NextResponse.json(
      { error: "Failed to list chat sessions" },
      { status: 500 }
    );
  }
}

/**
 * POST — Create a new chat session.
 */
export async function POST(request: NextRequest) {
  const auth = await verifyRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const title = (body.title as string)?.trim() || "New Chat";

    const docRef = adminDb.collection("chat_sessions").doc();
    const now = new Date().toISOString();

    const selectedMcpIds = Array.isArray(body.selectedMcpIds) ? body.selectedMcpIds : [];

    await docRef.set({
      userId: auth.uid,
      title,
      messages: [],
      mcpServerIds: selectedMcpIds,
      selectedMcpIds,
      usedTools: [],
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ id: docRef.id, title });
  } catch (error) {
    console.error("[Chat Sessions] Create error:", error);
    return NextResponse.json(
      { error: "Failed to create chat session" },
      { status: 500 }
    );
  }
}

/**
 * DELETE — Delete a chat session (body: { sessionId }).
 */
export async function DELETE(request: NextRequest) {
  const auth = await verifyRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const sessionId = body.sessionId as string;
    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId required" },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection("chat_sessions").doc(sessionId);
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

    await docRef.delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Chat Sessions] Delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete chat session" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/parse-file
 *
 * Server-side file parsing for AI builder attachments.
 * Accepts .xlsx and .md files, returns structured text content.
 *
 * Issue #115
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { parseFileBuffer, type ParsedFile } from "@/lib/file-parser";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  const auth = await verifyRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum ${MAX_FILE_SIZE / 1024 / 1024}MB.` },
        { status: 400 }
      );
    }

    const name = file.name;
    if (!name.endsWith(".xlsx") && !name.endsWith(".md") && !name.endsWith(".markdown")) {
      return NextResponse.json(
        { error: "Only .xlsx and .md files are supported" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const parsed = await parseFileBuffer(name, buffer);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("[Parse File] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to parse file" },
      { status: 500 }
    );
  }
}

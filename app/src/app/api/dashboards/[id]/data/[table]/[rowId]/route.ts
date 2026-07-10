/**
 * GET/PATCH/DELETE /api/dashboards/{id}/data/{table}/{rowId}
 *
 * Runtime Data API — single row operations.
 * Auth: dash_session cookie or Firebase Bearer token.
 *
 * Issue #141
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyDataApiRequest } from "@/lib/data-api-auth";
import { sanitizeIdentifier } from "@/lib/app-db/naming";
import { updateRows, deleteRows } from "@/lib/app-db/schema-manager";
import { recordAudit, getInstanceTables } from "@/lib/app-db/registry";


const DATA_API_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "null",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "authorization,content-type",
  "Access-Control-Max-Age": "600",
};

function shouldApplyCors(request: NextRequest) {
  return request.headers.get("origin") === "null";
}

function withCors(response: NextResponse, request: NextRequest) {
  if (!shouldApplyCors(request)) return response;
  for (const [key, value] of Object.entries(DATA_API_CORS_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export async function OPTIONS(request: NextRequest) {
  return shouldApplyCors(request)
    ? new NextResponse(null, { status: 204, headers: DATA_API_CORS_HEADERS })
    : new NextResponse(null, { status: 204 });
}

interface RouteContext {
  params: Promise<{ id: string; table: string; rowId: string }>;
}

/**
 * GET — Read a single row by ID.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { id, table: logicalName, rowId } = await context.params;

  const auth = await verifyDataApiRequest(request, id);
  if (!auth) {
    return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), request);
  }

  const safeName = sanitizeIdentifier(logicalName);
  if (!safeName) {
    return withCors(NextResponse.json({ error: "Invalid table name" }, { status: 400 }), request);
  }

  const tables = await getInstanceTables(auth.instance.id);
  const table = tables.find((t) => t.logicalName === safeName);
  if (!table) {
    return withCors(NextResponse.json({ error: "Table not found" }, { status: 404 }), request);
  }

  try {
    const { prisma } = await import("@/lib/prisma");
    const result = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM "${auth.instance.userSchema}"."${table.tableName}" WHERE "id" = $1 LIMIT 1`,
      rowId
    );

    if (result.length === 0) {
      return withCors(NextResponse.json({ error: "Row not found" }, { status: 404 }), request);
    }

    return withCors(NextResponse.json({ row: result[0] }), request);
  } catch (error) {
    console.error("[Data API] GET row failed:", error);
    return withCors(NextResponse.json({ error: "Failed to read row" }, { status: 500 }), request);
  }
}

/**
 * PATCH — Update a single row.
 * Body: { data: Record<string, unknown> }
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id, table: logicalName, rowId } = await context.params;

  const auth = await verifyDataApiRequest(request, id);
  if (!auth) {
    return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), request);
  }

  const safeName = sanitizeIdentifier(logicalName);
  if (!safeName) {
    return withCors(NextResponse.json({ error: "Invalid table name" }, { status: 400 }), request);
  }

  const tables = await getInstanceTables(auth.instance.id);
  const table = tables.find((t) => t.logicalName === safeName);
  if (!table) {
    return withCors(NextResponse.json({ error: "Table not found" }, { status: 404 }), request);
  }

  try {
    const body = await request.json();
    const data = body.data as Record<string, unknown>;
    if (!data || typeof data !== "object") {
      return withCors(NextResponse.json({ error: "data object required" }, { status: 400 }), request);
    }

    const updated = await updateRows(auth.instance.userSchema, table.tableName, [
      { id: rowId, data },
    ]);

    await recordAudit({
      instanceId: auth.instance.id,
      dashboardId: id,
      ownerUid: auth.instance.ownerUid,
      operationType: "update",
      tableName: table.tableName,
      rowCount: updated,
      executedBy: "html_runtime",
    });

    return withCors(NextResponse.json({ updated }), request);
  } catch (error) {
    console.error("[Data API] PATCH failed:", error);
    return withCors(NextResponse.json({ error: "Failed to update row" }, { status: 500 }), request);
  }
}

/**
 * DELETE — Delete a single row.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id, table: logicalName, rowId } = await context.params;

  const auth = await verifyDataApiRequest(request, id);
  if (!auth) {
    return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), request);
  }

  const safeName = sanitizeIdentifier(logicalName);
  if (!safeName) {
    return withCors(NextResponse.json({ error: "Invalid table name" }, { status: 400 }), request);
  }

  const tables = await getInstanceTables(auth.instance.id);
  const table = tables.find((t) => t.logicalName === safeName);
  if (!table) {
    return withCors(NextResponse.json({ error: "Table not found" }, { status: 404 }), request);
  }

  try {
    const deleted = await deleteRows(auth.instance.userSchema, table.tableName, [rowId]);

    await recordAudit({
      instanceId: auth.instance.id,
      dashboardId: id,
      ownerUid: auth.instance.ownerUid,
      operationType: "delete",
      tableName: table.tableName,
      rowCount: deleted,
      executedBy: "html_runtime",
    });

    return withCors(NextResponse.json({ deleted }), request);
  } catch (error) {
    console.error("[Data API] DELETE failed:", error);
    return withCors(NextResponse.json({ error: "Failed to delete row" }, { status: 500 }), request);
  }
}

/**
 * GET/POST /api/dashboards/{id}/data/{table}
 *
 * Runtime Data API — called by HTML dashboards to read/write data.
 * Auth: dash_session cookie or Firebase Bearer token.
 *
 * Issue #141
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyDataApiRequest } from "@/lib/data-api-auth";
import { sanitizeIdentifier, physicalTableName, tableMatchesPrefix } from "@/lib/app-db/naming";
import { readRows, insertRows } from "@/lib/app-db/schema-manager";
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
  params: Promise<{ id: string; table: string }>;
}

/**
 * GET — Read rows from a table.
 * Query params: limit (default 100, max 1000), offset (default 0), orderBy, orderDir
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { id, table: logicalName } = await context.params;

  const auth = await verifyDataApiRequest(request, id);
  if (!auth) {
    return withCors(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), request);
  }

  const safeName = sanitizeIdentifier(logicalName);
  if (!safeName) {
    return withCors(NextResponse.json({ error: "Invalid table name" }, { status: 400 }), request);
  }

  // Verify table belongs to this dashboard
  const tables = await getInstanceTables(auth.instance.id);
  const table = tables.find((t) => t.logicalName === safeName);
  if (!table) {
    return withCors(NextResponse.json({ error: "Table not found" }, { status: 404 }), request);
  }

  try {
    const params = request.nextUrl.searchParams;
    const result = await readRows(auth.instance.userSchema, table.tableName, {
      orderBy: params.get("orderBy") || undefined,
      orderDir: (params.get("orderDir") as "ASC" | "DESC") || undefined,
      limit: Math.min(Number(params.get("limit")) || 100, 1000),
      offset: Number(params.get("offset")) || 0,
    });

    return withCors(NextResponse.json(result), request);
  } catch (error) {
    console.error("[Data API] GET failed:", error);
    return withCors(NextResponse.json({ error: "Failed to read data" }, { status: 500 }), request);
  }
}

/**
 * POST — Insert rows into a table.
 * Body: { rows: Record<string, unknown>[] }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { id, table: logicalName } = await context.params;

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
    const rows = body.rows as Record<string, unknown>[];
    if (!Array.isArray(rows) || rows.length === 0) {
      return withCors(NextResponse.json({ error: "rows array required" }, { status: 400 }), request);
    }
    if (rows.length > 100) {
      return withCors(NextResponse.json({ error: "Max 100 rows per request" }, { status: 400 }), request);
    }

    const inserted = await insertRows(auth.instance.userSchema, table.tableName, rows);

    await recordAudit({
      instanceId: auth.instance.id,
      dashboardId: id,
      ownerUid: auth.instance.ownerUid,
      operationType: "insert",
      tableName: table.tableName,
      rowCount: inserted,
      executedBy: "html_runtime",
    });

    return withCors(NextResponse.json({ inserted }), request);
  } catch (error) {
    console.error("[Data API] POST failed:", error);
    return withCors(NextResponse.json({ error: "Failed to insert data" }, { status: 500 }), request);
  }
}

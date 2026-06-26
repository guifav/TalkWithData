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
import { readRows, updateRows, deleteRows } from "@/lib/app-db/schema-manager";
import { recordAudit, getInstanceTables } from "@/lib/app-db/registry";

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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const safeName = sanitizeIdentifier(logicalName);
  if (!safeName) {
    return NextResponse.json({ error: "Invalid table name" }, { status: 400 });
  }

  const tables = await getInstanceTables(auth.instance.id);
  const table = tables.find((t) => t.logicalName === safeName);
  if (!table) {
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  }

  try {
    // Read with a filter by ID — readRows doesn't support WHERE, so read all and filter
    // For v1 this is acceptable; future: add ID filter to readRows
    const { rows } = await readRows(auth.instance.userSchema, table.tableName, {
      limit: 1,
      offset: 0,
    });
    // Actually we need to query by ID. Let me use a raw approach:
    const { prisma } = await import("@/lib/prisma");
    const result = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT * FROM "${auth.instance.userSchema}"."${table.tableName}" WHERE "id" = $1 LIMIT 1`,
      rowId
    );

    if (result.length === 0) {
      return NextResponse.json({ error: "Row not found" }, { status: 404 });
    }

    return NextResponse.json({ row: result[0] });
  } catch (error) {
    console.error("[Data API] GET row failed:", error);
    return NextResponse.json({ error: "Failed to read row" }, { status: 500 });
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const safeName = sanitizeIdentifier(logicalName);
  if (!safeName) {
    return NextResponse.json({ error: "Invalid table name" }, { status: 400 });
  }

  const tables = await getInstanceTables(auth.instance.id);
  const table = tables.find((t) => t.logicalName === safeName);
  if (!table) {
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const data = body.data as Record<string, unknown>;
    if (!data || typeof data !== "object") {
      return NextResponse.json({ error: "data object required" }, { status: 400 });
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

    return NextResponse.json({ updated });
  } catch (error) {
    console.error("[Data API] PATCH failed:", error);
    return NextResponse.json({ error: "Failed to update row" }, { status: 500 });
  }
}

/**
 * DELETE — Delete a single row.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { id, table: logicalName, rowId } = await context.params;

  const auth = await verifyDataApiRequest(request, id);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const safeName = sanitizeIdentifier(logicalName);
  if (!safeName) {
    return NextResponse.json({ error: "Invalid table name" }, { status: 400 });
  }

  const tables = await getInstanceTables(auth.instance.id);
  const table = tables.find((t) => t.logicalName === safeName);
  if (!table) {
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
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

    return NextResponse.json({ deleted });
  } catch (error) {
    console.error("[Data API] DELETE failed:", error);
    return NextResponse.json({ error: "Failed to delete row" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/api-auth";
import {
  DataSourceNotFoundError,
  deleteDataSource,
  getDataSource,
  updateDataSource,
} from "@/lib/data-sources/firestore";
import { parseUpdateDataSourceBody } from "@/app/api/admin/data-sources/validation";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const dataSource = await getDataSource(id);
    if (!dataSource) {
      return NextResponse.json(
        { error: "Data source not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(dataSource);
  } catch (error) {
    console.error("Get data source failed:", error);
    return NextResponse.json(
      { error: "Failed to get data source" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = parseUpdateDataSourceBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const dataSource = await updateDataSource(id, parsed.value);
    return NextResponse.json(dataSource);
  } catch (error) {
    if (error instanceof DataSourceNotFoundError) {
      return NextResponse.json(
        { error: "Data source not found" },
        { status: 404 },
      );
    }

    console.error("Update data source failed:", error);
    return NextResponse.json(
      { error: "Failed to update data source" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    await deleteDataSource(id);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    if (error instanceof DataSourceNotFoundError) {
      return NextResponse.json(
        { error: "Data source not found" },
        { status: 404 },
      );
    }

    console.error("Delete data source failed:", error);
    return NextResponse.json(
      { error: "Failed to delete data source" },
      { status: 500 },
    );
  }
}

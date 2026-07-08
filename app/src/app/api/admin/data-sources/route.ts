import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/api-auth";
import {
  createDataSource,
  listDataSources,
} from "@/lib/data-sources/firestore";
import { parseCreateDataSourceBody } from "@/app/api/admin/data-sources/validation";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const dataSources = await listDataSources();
    return NextResponse.json({ dataSources });
  } catch (error) {
    console.error("List data sources failed:", error);
    return NextResponse.json(
      { error: "Failed to list data sources" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await verifySuperAdmin(request);
  if (!auth) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const parsed = parseCreateDataSourceBody(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const dataSource = await createDataSource(parsed.value, auth.uid);
    return NextResponse.json(dataSource);
  } catch (error) {
    console.error("Create data source failed:", error);
    return NextResponse.json(
      { error: "Failed to create data source" },
      { status: 500 },
    );
  }
}

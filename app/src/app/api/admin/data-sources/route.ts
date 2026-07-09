import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/api-auth";
import {
  createDataSource,
  listDataSources,
  type CreateDataSourceInput,
} from "@/lib/data-sources/firestore";
import { parseCreateDataSourceBody } from "@/app/api/admin/data-sources/validation";
import {
  credentialEncProof,
  verifyDataSourceInspectionToken,
} from "@/lib/data-sources/inspection-token";

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

    const verified = verifyDataSourceInspectionToken({
      token: parsed.value.inspectionToken,
      bucket: parsed.value.bucket,
      prefix: parsed.value.prefix,
      credentialRef: parsed.value.credentialRef,
      credentialProof: credentialEncProof(parsed.value.credentialEnc ?? ""),
      ownerColumn: parsed.value.ownerColumn,
    });
    if (!verified.ok) {
      return NextResponse.json({ error: verified.error }, { status: 400 });
    }

    const input = omitInspectionToken(parsed.value);
    const dataSource = await createDataSource(input, auth.uid);
    return NextResponse.json(dataSource);
  } catch (error) {
    console.error("Create data source failed:", error);
    return NextResponse.json(
      { error: "Failed to create data source" },
      { status: 500 },
    );
  }
}

function omitInspectionToken(
  input: CreateDataSourceInput & { inspectionToken: string },
): CreateDataSourceInput {
  const { inspectionToken: _inspectionToken, ...dataSourceInput } = input;
  void _inspectionToken;
  return dataSourceInput;
}

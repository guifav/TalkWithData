import { NextRequest, NextResponse } from "next/server";
import { verifySuperAdmin } from "@/lib/api-auth";
import {
  DataSourceConcurrentModificationError,
  DataSourceNotFoundError,
  deleteDataSource,
  getDataSource,
  updateDataSource,
  type DataSourceDoc,
  type UpdateDataSourcePatch,
} from "@/lib/data-sources/firestore";
import { parseUpdateDataSourceBody } from "@/app/api/admin/data-sources/validation";
import {
  credentialEncProof,
  storedCredentialProof,
  verifyDataSourceInspectionToken,
} from "@/lib/data-sources/inspection-token";

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

    const needsInspection = requiresInspectionToken(parsed.value);
    const patch = omitInspectionToken(parsed.value);
    const dataSource = await updateDataSource(id, patch, {
      validateCurrent: needsInspection
        ? (current) => validateInspectedPatch(id, current, parsed.value)
        : undefined,
    });
    return NextResponse.json(dataSource);
  } catch (error) {
    if (error instanceof DataSourceNotFoundError) {
      return NextResponse.json(
        { error: "Data source not found" },
        { status: 404 },
      );
    }

    if (error instanceof DataSourceConcurrentModificationError) {
      return NextResponse.json(
        { error: "Data source was modified concurrently; inspect headers again" },
        { status: 409 },
      );
    }

    if (error instanceof DataSourcePatchValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
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

class DataSourcePatchValidationError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "DataSourcePatchValidationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

function validateInspectedPatch(
  id: string,
  current: DataSourceDoc,
  patch: UpdateDataSourcePatch & { inspectionToken?: string },
): void {
  if (!current.credentialEnc && !patch.credentialEnc) {
    throw new DataSourcePatchValidationError("Data source has no credential configured", 400);
  }

  const effective = {
    bucket: patch.bucket ?? current.bucket,
    prefix: patch.prefix ?? current.prefix,
    credentialRef: patch.credentialRef ?? current.credentialRef,
    ownerColumn: patch.ownerColumn ?? current.ownerColumn,
  };
  const credentialProof = patch.credentialEnc
    ? credentialEncProof(patch.credentialEnc, {
        dataSourceId: current.id,
        configVersion: current.configVersion,
      })
    : storedCredentialProof({
        dataSourceId: current.id,
        configVersion: current.configVersion,
        credentialRef: current.credentialRef,
      });
  const verified = verifyDataSourceInspectionToken({
    token: patch.inspectionToken,
    bucket: effective.bucket,
    prefix: effective.prefix,
    credentialRef: effective.credentialRef,
    credentialProof,
    ownerColumn: effective.ownerColumn,
  });
  if (!verified.ok) {
    if (verified.error === "inspectionToken configVersion is stale") {
      throw new DataSourceConcurrentModificationError(id);
    }
    throw new DataSourcePatchValidationError(verified.error, 400);
  }
}

function requiresInspectionToken(patch: UpdateDataSourcePatch & { inspectionToken?: string }): boolean {
  return (
    patch.bucket !== undefined ||
    patch.prefix !== undefined ||
    patch.credentialRef !== undefined ||
    patch.credentialEnc !== undefined ||
    patch.ownerColumn !== undefined
  );
}

function omitInspectionToken(
  patch: UpdateDataSourcePatch & { inspectionToken?: string },
): UpdateDataSourcePatch {
  const { inspectionToken: _inspectionToken, ...dataSourcePatch } = patch;
  void _inspectionToken;
  return dataSourcePatch;
}

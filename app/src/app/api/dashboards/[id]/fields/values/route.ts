import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";
import { prisma } from "@/lib/prisma";
import { validateFieldValue } from "@/lib/field-validation";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify dashboard exists and caller is owner
  try {
    const doc = await adminDb.collection("dashboards").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Dashboard not found" }, { status: 404 });
    }
    if (doc.data()?.createdBy !== auth.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } catch (error) {
    console.error("[Fields/Values] Firestore check failed:", error);
    return NextResponse.json({ error: "Failed to verify dashboard" }, { status: 500 });
  }

  try {
    const fields = await prisma.dashboardFieldSchema.findMany({
      where: { dashboardId: id },
      include: { value: true },
      orderBy: { order: "asc" },
    });

    const values: Record<string, { value: string | null; updatedBy: string | null; updatedAt: string }> = {};
    for (const field of fields) {
      if (field.value) {
        values[field.key] = {
          value: field.value.value,
          updatedBy: field.value.updatedBy,
          updatedAt: field.value.updatedAt.toISOString(),
        };
      }
    }

    return NextResponse.json({ values });
  } catch (error) {
    console.error("[Fields/Values] GET failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch field values" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify dashboard exists and caller has access
  let dashData: Record<string, unknown> | undefined;
  try {
    const doc = await adminDb.collection("dashboards").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Dashboard not found" }, { status: 404 });
    }
    dashData = doc.data() as Record<string, unknown>;
    // Check ownership: only the dashboard creator can write field values
    if (dashData?.createdBy !== auth.uid) {
      return NextResponse.json({ error: "Forbidden: only the dashboard owner can edit fields" }, { status: 403 });
    }
  } catch (error) {
    console.error("[Fields/Values] Firestore check failed:", error);
    return NextResponse.json({ error: "Failed to verify dashboard" }, { status: 500 });
  }

  const body = await request.json();
  const incoming: Record<string, string | null> = body.values;

  if (!incoming || typeof incoming !== "object") {
    return NextResponse.json({ error: "values must be an object" }, { status: 400 });
  }

  try {
    // Get all field schemas for this dashboard
    const schemas = await prisma.dashboardFieldSchema.findMany({
      where: { dashboardId: id },
      include: { value: true },
    });

    type Schema = typeof schemas[number];
    const schemaByKey = new Map<string, Schema>(schemas.map((s: Schema) => [s.key, s]));

    const errors: Record<string, string> = {};
    const updates: Array<{
      fieldId: string;
      key: string;
      oldValue: string | null;
      newValue: string | null;
    }> = [];

    // Validate all values first
    for (const [key, rawValue] of Object.entries(incoming)) {
      const schema = schemaByKey.get(key);
      if (!schema) continue; // skip unknown keys

      const validation = validateFieldValue(
        rawValue,
        schema.type,
        schema.options,
        schema.required
      );

      if (!validation.valid) {
        errors[key] = validation.error!;
        continue;
      }

      const oldValue = schema.value?.value ?? null;
      if (validation.sanitized !== oldValue) {
        updates.push({
          fieldId: schema.id,
          key,
          oldValue,
          newValue: validation.sanitized,
        });
      }
    }

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ error: "Validation failed", errors }, { status: 400 });
    }

    // Apply updates in a transaction
    if (updates.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.$transaction(async (tx: any) => {
        for (const update of updates) {
          // Upsert value (avoids race conditions on first write)
          await tx.dashboardFieldValue.upsert({
            where: { fieldId: update.fieldId },
            create: {
              fieldId: update.fieldId,
              value: update.newValue,
              updatedBy: auth.uid,
            },
            update: {
              value: update.newValue,
              updatedBy: auth.uid,
            },
          });

          // Audit trail
          await tx.dashboardFieldAudit.create({
            data: {
              dashboardId: id,
              fieldKey: update.key,
              oldValue: update.oldValue,
              newValue: update.newValue,
              changedBy: auth.uid,
            },
          });
        }
      });
    }

    return NextResponse.json({ success: true, updatedCount: updates.length });
  } catch (error) {
    console.error("[Fields/Values] POST failed:", error);
    return NextResponse.json(
      { error: "Failed to save field values" },
      { status: 500 }
    );
  }
}

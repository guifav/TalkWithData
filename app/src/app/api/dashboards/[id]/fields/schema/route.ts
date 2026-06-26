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
    console.error("[Fields/Schema] Firestore check failed:", error);
    return NextResponse.json({ error: "Failed to verify dashboard" }, { status: 500 });
  }

  try {
    const fields = await prisma.dashboardFieldSchema.findMany({
      where: { dashboardId: id },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({ fields });
  } catch (error) {
    console.error("[Fields/Schema] GET failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch field schemas" },
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

  // Verify dashboard ownership
  try {
    const doc = await adminDb.collection("dashboards").doc(id).get();
    if (!doc.exists) {
      return NextResponse.json({ error: "Dashboard not found" }, { status: 404 });
    }
    if (doc.data()?.createdBy !== auth.uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } catch (error) {
    console.error("[Fields/Schema] Firestore check failed:", error);
    return NextResponse.json({ error: "Failed to verify dashboard" }, { status: 500 });
  }

  const body = await request.json();
  const incomingFields: Array<{
    key: string;
    name: string;
    type: string;
    required?: boolean;
    options?: string[];
    order?: number;
  }> = body.fields;

  if (!Array.isArray(incomingFields)) {
    return NextResponse.json({ error: "fields must be an array" }, { status: 400 });
  }

  // Reject duplicate keys in the same payload
  const seenKeys = new Set<string>();
  for (const f of incomingFields) {
    if (!f.key) continue;
    if (seenKeys.has(f.key)) {
      return NextResponse.json(
        { error: `Duplicate field key: "${f.key}"` },
        { status: 400 }
      );
    }
    seenKeys.add(f.key);
  }

  try {
    // Get existing fields with their values
    const existing = await prisma.dashboardFieldSchema.findMany({
      where: { dashboardId: id },
      include: { value: true },
    });

    type ExistingField = typeof existing[number];
    const existingByKey = new Map<string, ExistingField>(existing.map((f: ExistingField) => [f.key, f]));
    const incomingKeys = new Set(incomingFields.map((f: { key: string }) => f.key));

    // Fields to delete (exist in DB but not in incoming)
    const toDelete = existing.filter((f: typeof existing[number]) => !incomingKeys.has(f.key));

    // Process in a transaction
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.$transaction(async (tx: any) => {
      // Delete removed fields (cascade deletes values)
      if (toDelete.length > 0) {
        await tx.dashboardFieldValue.deleteMany({
          where: { fieldId: { in: toDelete.map((f: { id: string }) => f.id) } },
        });
        await tx.dashboardFieldSchema.deleteMany({
          where: { id: { in: toDelete.map((f: { id: string }) => f.id) } },
        });
      }

      // Upsert each incoming field
      for (let i = 0; i < incomingFields.length; i++) {
        const field = incomingFields[i];
        const existingField = existingByKey.get(field.key);

        await tx.dashboardFieldSchema.upsert({
          where: {
            dashboardId_key: { dashboardId: id, key: field.key },
          },
          create: {
            dashboardId: id,
            key: field.key,
            name: field.name,
            type: field.type,
            required: field.required ?? false,
            options: field.options ?? [],
            order: field.order ?? i,
          },
          update: {
            name: field.name,
            type: field.type,
            required: field.required ?? false,
            options: field.options ?? [],
            order: field.order ?? i,
          },
        });

        // Revalidate existing value against new type/options/required
        if (existingField?.value?.value != null) {
          const validation = validateFieldValue(
            existingField.value.value,
            field.type,
            field.options ?? [],
            field.required ?? false
          );

          if (!validation.valid) {
            // Clear incompatible value
            await tx.dashboardFieldValue.update({
              where: { id: existingField.value.id },
              data: { value: null, updatedBy: auth.uid },
            });
          }
        }
      }
    });

    // Return updated schema
    const updated = await prisma.dashboardFieldSchema.findMany({
      where: { dashboardId: id },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({ fields: updated });
  } catch (error) {
    console.error("[Fields/Schema] POST failed:", error);
    return NextResponse.json(
      { error: "Failed to save field schema" },
      { status: 500 }
    );
  }
}

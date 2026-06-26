import { NextRequest, NextResponse } from "next/server";
import { verifyRequest } from "@/lib/api-auth";
import { adminDb } from "@/lib/firebase/admin";

export async function GET(request: NextRequest) {
  const auth = await verifyRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q")?.trim().toLowerCase();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  try {
    // With <500 dashboards, scanning all docs is fast enough.
    // We query non-archived dashboards visible to the user.
    const snap = await adminDb
      .collection("dashboards")
      .where("archivedAt", "==", null)
      .get();

    // Fetch user's department IDs for permission check
    const deptSnap = await adminDb
      .collection("departments")
      .where("memberUids", "array-contains", auth.uid)
      .get();
    const userDeptIds = deptSnap.docs.map((d) => d.id);

    // Fetch dashboard IDs accessible via shared folders
    const email = auth.email.toLowerCase();
    const sfQueries = [
      adminDb.collection("shared-folders").where("createdBy", "==", auth.uid).get(),
      adminDb.collection("shared-folders").where("sharedWithEmails", "array-contains", email).get(),
    ];
    for (const deptId of userDeptIds) {
      sfQueries.push(
        adminDb.collection("shared-folders").where("sharedWithDepartments", "array-contains", deptId).get()
      );
    }
    const sfResults = await Promise.all(sfQueries);
    const sharedFolderDashboardIds = new Set<string>();
    for (const sfSnap of sfResults) {
      for (const sfDoc of sfSnap.docs) {
        const ids = sfDoc.data().dashboardIds;
        if (Array.isArray(ids)) ids.forEach((id: string) => sharedFolderDashboardIds.add(id));
      }
    }

    const terms = q.split(/\s+/).filter(Boolean);
    const results: Array<{
      id: string;
      slug: string;
      title: string;
      description: string | null;
      category: string;
      createdByName: string;
      matchField: string;
    }> = [];

    for (const doc of snap.docs) {
      const data = doc.data();

      // Check visibility
      const isOwner = data.createdBy === auth.uid;
      const isTeam = data.visibility === "team";
      const isAllowed =
        data.allowedEmails?.includes(auth.email?.toLowerCase());
      const isDeptAllowed =
        Array.isArray(data.allowedDepartments) &&
        data.allowedDepartments.length > 0 &&
        userDeptIds.length > 0 &&
        data.allowedDepartments.some((dId: string) => userDeptIds.includes(dId));
      const hasSharedFolderAccess = sharedFolderDashboardIds.has(doc.id);
      if (!isOwner && !isTeam && !isAllowed && !isDeptAllowed && !hasSharedFolderAccess) continue;

      // Search in title, description, searchableText
      const title = (data.title || "").toLowerCase();
      const description = (data.description || "").toLowerCase();
      const searchableText = (data.searchableText || "").toLowerCase();

      let matchField = "";
      const allTermsMatch = terms.every((term) => {
        if (title.includes(term)) {
          matchField = matchField || "title";
          return true;
        }
        if (description.includes(term)) {
          matchField = matchField || "description";
          return true;
        }
        if (searchableText.includes(term)) {
          matchField = matchField || "content";
          return true;
        }
        return false;
      });

      if (allTermsMatch) {
        results.push({
          id: doc.id,
          slug: data.slug,
          title: data.title,
          description: data.description,
          category: data.category || "Other",
          createdByName: data.createdByName,
          matchField,
        });
      }
    }

    return NextResponse.json({ results: results.slice(0, 50) });
  } catch (error) {
    console.error("Search failed:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

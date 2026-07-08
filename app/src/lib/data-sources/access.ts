import { adminDb } from "@/lib/firebase/admin";
import type {
  DataSource,
  QueryAuthorization,
  ViewerScope,
} from "@/lib/data-sources/types";

const DEPARTMENTS_COLLECTION = "departments";
const USERS_COLLECTION = "users";

export async function canQueryDataSource(
  uid: string,
  ds: DataSource,
): Promise<QueryAuthorization> {
  const grants = ds.accessGrants;
  if (!grants) return { canQuery: false };

  if (grants.assignedUsers.includes(uid)) {
    return { canQuery: true };
  }

  for (const departmentId of uniqueStrings(grants.assignedDepartments)) {
    const memberUids = await loadDepartmentMemberUids(departmentId);
    if (memberUids.includes(uid)) {
      return { canQuery: true };
    }
  }

  return { canQuery: false };
}

export async function resolveViewerScope(
  uid: string,
  ds: DataSource,
): Promise<ViewerScope> {
  const ownerColumnIdentity = ds.ownerColumnIdentity ?? "email";

  if (ownerColumnIdentity === "uid") {
    return { ownerKeys: uniqueStrings(uid ? [uid] : []) };
  }

  return { ownerKeys: await resolveOwnerEmails(uid ? [uid] : []) };
}

async function loadDepartmentMemberUids(
  departmentId: string,
): Promise<string[]> {
  try {
    const doc = await adminDb
      .collection(DEPARTMENTS_COLLECTION)
      .doc(departmentId)
      .get();
    if (!doc.exists) return [];

    return stringArray(doc.data()?.memberUids);
  } catch {
    return [];
  }
}

async function resolveOwnerEmails(ownerUids: string[]): Promise<string[]> {
  if (ownerUids.length === 0) return [];

  const usersCollection = adminDb.collection(USERS_COLLECTION);
  const userRefs = ownerUids.map((ownerUid) => usersCollection.doc(ownerUid));

  try {
    const docs = await adminDb.getAll(...userRefs);
    const emails = docs.flatMap((doc) => {
      if (!doc.exists) return [];

      const email = doc.data()?.email;
      if (typeof email !== "string") return [];

      const normalized = email.toLowerCase().trim();
      return normalized ? [normalized] : [];
    });

    return uniqueStrings(emails);
  } catch {
    return [];
  }
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

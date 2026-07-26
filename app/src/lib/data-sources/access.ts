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

  // Uma unica ida ao Firestore (getAll) em vez de um get sequencial por
  // departamento. Erros degradam para lista vazia (fail-closed: sem acesso).
  const departmentIds = uniqueStrings(grants.assignedDepartments);
  if (departmentIds.length > 0) {
    const memberUidLists = await loadDepartmentsMemberUids(departmentIds);
    if (memberUidLists.some((memberUids) => memberUids.includes(uid))) {
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

async function loadDepartmentsMemberUids(
  departmentIds: string[],
): Promise<string[][]> {
  try {
    const refs = departmentIds.map((departmentId) =>
      adminDb.collection(DEPARTMENTS_COLLECTION).doc(departmentId),
    );
    const docs = await adminDb.getAll(...refs);
    return docs.map((doc) =>
      doc.exists ? stringArray(doc.data()?.memberUids) : [],
    );
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

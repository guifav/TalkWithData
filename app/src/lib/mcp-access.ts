/**
 * MCP Access Check — shared utility for verifying user access to MCP features.
 *
 * Extracted from ai/save to avoid duplication across routes.
 */

import { adminDb } from "@/lib/firebase/admin";

/**
 * Check if a user has access to at least one MCP server
 * (via department membership or direct user assignment).
 */
export async function checkUserHasMcpAccess(uid: string): Promise<boolean> {
  try {
    const userDoc = await adminDb.collection("users").doc(uid).get();
    const userDepartment: string | undefined = userDoc.data()?.department;

    const accessSnap = await adminDb.collection("mcp_access").get();
    for (const doc of accessSnap.docs) {
      const data = doc.data() as {
        assignedDepartments?: string[];
        assignedUsers?: string[];
      };
      const depts = data.assignedDepartments || [];
      const users = data.assignedUsers || [];

      if (
        (userDepartment && depts.includes(userDepartment)) ||
        users.includes(uid)
      ) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

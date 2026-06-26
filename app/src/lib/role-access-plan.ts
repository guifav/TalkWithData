export type Role = "user" | "admin" | "superadmin";
export type RoleBucket = Role | "missing" | "invalid";

export interface RoleAuditUser {
  uid: string;
  email?: string;
  displayName?: string;
  role?: unknown;
}

export interface RolePlanItem {
  uid: string;
  email: string;
  displayName: string;
  currentRole: string | null;
  plannedRole: Role;
  action: "preserve" | "update";
  reason: string;
}

export interface RolePlanSummary {
  totalUsers: number;
  before: Record<RoleBucket, number>;
  after: Record<Role, number>;
  changeCount: number;
}

export interface RolePlan {
  policy: string;
  summary: RolePlanSummary;
  items: RolePlanItem[];
  changes: RolePlanItem[];
}

const VALID_ROLES: Role[] = ["user", "admin", "superadmin"];

export const ISSUE_155_ROLE_POLICY =
  "Preserve existing superadmins; set every other existing user to user.";

function roleBucket(role: unknown): RoleBucket {
  if (role === undefined || role === null || role === "") return "missing";
  if (VALID_ROLES.includes(role as Role)) return role as Role;
  return "invalid";
}

function plannedRoleFor(bucket: RoleBucket): Role {
  return bucket === "superadmin" ? "superadmin" : "user";
}

function emptyBeforeCounts(): Record<RoleBucket, number> {
  return {
    user: 0,
    admin: 0,
    superadmin: 0,
    missing: 0,
    invalid: 0,
  };
}

function emptyAfterCounts(): Record<Role, number> {
  return {
    user: 0,
    admin: 0,
    superadmin: 0,
  };
}

export function buildIssue155RolePlan(users: RoleAuditUser[]): RolePlan {
  const before = emptyBeforeCounts();
  const after = emptyAfterCounts();

  const items = users.map((user) => {
    const bucket = roleBucket(user.role);
    const plannedRole = plannedRoleFor(bucket);
    const currentRole =
      bucket === "missing" ? null : typeof user.role === "string" ? user.role : String(user.role);
    const action = currentRole === plannedRole ? "preserve" : "update";

    before[bucket] += 1;
    after[plannedRole] += 1;

    return {
      uid: user.uid,
      email: user.email || "unknown",
      displayName: user.displayName || "unknown",
      currentRole,
      plannedRole,
      action,
      reason:
        plannedRole === "superadmin"
          ? "Current superadmin preserved by issue #155 policy"
          : "Issue #155 policy sets every non-superadmin account to user",
    } satisfies RolePlanItem;
  });

  const changes = items.filter((item) => item.action === "update");

  return {
    policy: ISSUE_155_ROLE_POLICY,
    summary: {
      totalUsers: users.length,
      before,
      after,
      changeCount: changes.length,
    },
    items,
    changes,
  };
}

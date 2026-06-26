import { describe, expect, it } from "vitest";

import { buildIssue155RolePlan } from "@/lib/role-access-plan";

describe("buildIssue155RolePlan", () => {
  it("preserves current superadmins and plans every other existing user as user", () => {
    const plan = buildIssue155RolePlan([
      { uid: "super-1", email: "super@griinstitute.org", role: "superadmin" },
      { uid: "admin-1", email: "admin@griinstitute.org", role: "admin" },
      { uid: "user-1", email: "user@griinstitute.org", role: "user" },
      { uid: "missing-1", email: "missing@griinstitute.org" },
      { uid: "invalid-1", email: "invalid@griinstitute.org", role: "owner" },
    ]);

    expect(plan.summary).toEqual({
      totalUsers: 5,
      before: {
        user: 1,
        admin: 1,
        superadmin: 1,
        missing: 1,
        invalid: 1,
      },
      after: {
        user: 4,
        admin: 0,
        superadmin: 1,
      },
      changeCount: 3,
    });

    expect(plan.changes).toEqual([
      expect.objectContaining({
        uid: "admin-1",
        currentRole: "admin",
        plannedRole: "user",
      }),
      expect.objectContaining({
        uid: "missing-1",
        currentRole: null,
        plannedRole: "user",
      }),
      expect.objectContaining({
        uid: "invalid-1",
        currentRole: "owner",
        plannedRole: "user",
      }),
    ]);
  });
});

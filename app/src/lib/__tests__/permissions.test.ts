import { describe, expect, it } from "vitest";
import { canViewDashboard, canViewDashboardViaSharedFolder } from "@/lib/permissions";

const owner = { uid: "owner-uid", email: "owner@example.com" };
const viewer = { uid: "viewer-uid", email: "viewer@example.com" };

describe("canViewDashboard", () => {
  it("allows the owner even when the dashboard is private with empty allow lists", () => {
    const dashboard = {
      createdBy: owner.uid,
      visibility: "specific" as const,
      allowedEmails: [],
      allowedDepartments: [],
    };

    expect(canViewDashboard(dashboard, owner)).toBe(true);
  });

  it("allows anyone when visibility is team", () => {
    const dashboard = {
      createdBy: owner.uid,
      visibility: "team" as const,
      allowedEmails: [],
      allowedDepartments: [],
    };

    expect(canViewDashboard(dashboard, viewer)).toBe(true);
  });

  it("matches allowedEmails using lowercase semantics: mixed-case user email matches a lowercase stored entry", () => {
    const dashboard = {
      createdBy: owner.uid,
      visibility: "specific" as const,
      allowedEmails: ["viewer@example.com"],
      allowedDepartments: [],
    };

    expect(
      canViewDashboard(dashboard, { uid: viewer.uid, email: "Viewer@Example.com" })
    ).toBe(true);
  });

  it("does not match a stored mixed-case allowedEmails entry against a lowercase user email", () => {
    const dashboard = {
      createdBy: owner.uid,
      visibility: "specific" as const,
      allowedEmails: ["Viewer@Example.com"],
      allowedDepartments: [],
    };

    expect(canViewDashboard(dashboard, viewer)).toBe(false);
  });

  it("returns false when allowedEmails is missing", () => {
    const dashboard = {
      createdBy: owner.uid,
      visibility: "specific" as const,
      allowedEmails: undefined as unknown as string[],
      allowedDepartments: [],
    };

    expect(canViewDashboard(dashboard, viewer)).toBe(false);
  });

  it("returns false when allowedEmails is not an array", () => {
    const dashboard = {
      createdBy: owner.uid,
      visibility: "specific" as const,
      allowedEmails: "viewer@example.com" as unknown as string[],
      allowedDepartments: [],
    };

    expect(canViewDashboard(dashboard, viewer)).toBe(false);
  });

  it("allows access when allowedDepartments overlaps the user's departments", () => {
    const dashboard = {
      createdBy: owner.uid,
      visibility: "specific" as const,
      allowedEmails: [],
      allowedDepartments: ["dept-a", "dept-b"],
    };

    expect(canViewDashboard(dashboard, viewer, ["dept-b"])).toBe(true);
  });

  it("denies access when allowedDepartments does not overlap the user's departments", () => {
    const dashboard = {
      createdBy: owner.uid,
      visibility: "specific" as const,
      allowedEmails: [],
      allowedDepartments: ["dept-a", "dept-b"],
    };

    expect(canViewDashboard(dashboard, viewer, ["dept-c"])).toBe(false);
  });

  it("denies access when userDepartmentIds is empty even if allowedDepartments is set", () => {
    const dashboard = {
      createdBy: owner.uid,
      visibility: "specific" as const,
      allowedEmails: [],
      allowedDepartments: ["dept-a"],
    };

    expect(canViewDashboard(dashboard, viewer, [])).toBe(false);
  });

  it("denies a non-owner on a private dashboard with no allow lists", () => {
    const dashboard = {
      createdBy: owner.uid,
      visibility: "specific" as const,
      allowedEmails: [],
      allowedDepartments: [],
    };

    expect(canViewDashboard(dashboard, viewer)).toBe(false);
  });
});

// Hand-rolled fake Firestore, no vi.mock: mirrors the subset of the
// Firestore query surface that canViewDashboardViaSharedFolder relies on
// (collection().where().get() with array-contains semantics).
interface FakeFolderDoc {
  id: string;
  data: Record<string, unknown>;
}

// Firestore `where` requires "array-contains" for the folder/department
// membership queries this fake stands in for. Asserting on the operator here
// means production code that regresses to e.g. "==" fails the test instead of
// silently passing against a fake that would match on any operator.
function assertArrayContains(collectionName: string, op: string) {
  if (op !== "array-contains") {
    throw new Error(
      `Expected "array-contains" operator on collection "${collectionName}", got "${op}"`
    );
  }
}

function makeFakeAdminDb(folders: FakeFolderDoc[], departments: FakeFolderDoc[] = []) {
  return {
    collection: (name: string) => {
      if (name === "shared-folders") {
        return {
          where: (field: string, op: string, value: string) => {
            assertArrayContains(name, op);
            return {
              get: async () => {
                const docs = folders
                  .filter((f) => {
                    const ids = f.data[field] as string[] | undefined;
                    return Array.isArray(ids) && ids.includes(value);
                  })
                  .map((f) => ({ id: f.id, data: () => f.data }));
                return { empty: docs.length === 0, docs };
              },
            };
          },
        };
      }

      if (name === "departments") {
        return {
          where: (field: string, op: string, value: string) => {
            assertArrayContains(name, op);
            return {
              get: async () => {
                const docs = departments
                  .filter((d) => {
                    const uids = d.data[field] as string[] | undefined;
                    return Array.isArray(uids) && uids.includes(value);
                  })
                  .map((d) => ({ id: d.id, data: () => d.data }));
                return { empty: docs.length === 0, docs };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected collection: ${name}`);
    },
    // Cast to the Firestore type expected by the function signature.
  } as unknown as FirebaseFirestore.Firestore;
}

describe("canViewDashboardViaSharedFolder", () => {
  it("returns not allowed when no shared folder contains the dashboard", async () => {
    const adminDb = makeFakeAdminDb([]);

    const result = await canViewDashboardViaSharedFolder("dash-1", viewer, adminDb);

    expect(result).toEqual({ allowed: false });
  });

  it("allows the folder owner and returns folderName/folderId", async () => {
    const adminDb = makeFakeAdminDb([
      {
        id: "folder-1",
        data: {
          dashboardIds: ["dash-1"],
          createdBy: owner.uid,
          name: "Owner's Folder",
        },
      },
    ]);

    const result = await canViewDashboardViaSharedFolder("dash-1", owner, adminDb);

    expect(result).toEqual({
      allowed: true,
      folderName: "Owner's Folder",
      folderId: "folder-1",
    });
  });

  it("allows a user whose email is in sharedWithEmails", async () => {
    const adminDb = makeFakeAdminDb([
      {
        id: "folder-1",
        data: {
          dashboardIds: ["dash-1"],
          createdBy: "someone-else-uid",
          name: "Shared Folder",
          sharedWithEmails: [viewer.email],
        },
      },
    ]);

    const result = await canViewDashboardViaSharedFolder("dash-1", viewer, adminDb);

    expect(result).toEqual({
      allowed: true,
      folderName: "Shared Folder",
      folderId: "folder-1",
    });
  });

  it("matches sharedWithEmails using lowercase semantics: mixed-case user email matches a lowercase stored entry", async () => {
    const adminDb = makeFakeAdminDb([
      {
        id: "folder-1",
        data: {
          dashboardIds: ["dash-1"],
          createdBy: "someone-else-uid",
          name: "Shared Folder",
          sharedWithEmails: [viewer.email], // stored lowercase
        },
      },
    ]);

    const result = await canViewDashboardViaSharedFolder(
      "dash-1",
      { uid: viewer.uid, email: "Viewer@Example.com" },
      adminDb
    );

    expect(result).toEqual({
      allowed: true,
      folderName: "Shared Folder",
      folderId: "folder-1",
    });
  });

  it("allows department-based access via the department membership query", async () => {
    const adminDb = makeFakeAdminDb(
      [
        {
          id: "folder-1",
          data: {
            dashboardIds: ["dash-1"],
            createdBy: "someone-else-uid",
            name: "Dept Folder",
            sharedWithDepartments: ["dept-a"],
          },
        },
      ],
      [{ id: "dept-a", data: { memberUids: [viewer.uid] } }]
    );

    const result = await canViewDashboardViaSharedFolder("dash-1", viewer, adminDb);

    expect(result).toEqual({
      allowed: true,
      folderName: "Dept Folder",
      folderId: "folder-1",
    });
  });

  it("denies department-based access when the user is not a member of the shared department", async () => {
    const adminDb = makeFakeAdminDb(
      [
        {
          id: "folder-1",
          data: {
            dashboardIds: ["dash-1"],
            createdBy: "someone-else-uid",
            name: "Dept Folder",
            sharedWithDepartments: ["dept-a"],
          },
        },
      ],
      [{ id: "dept-a", data: { memberUids: ["someone-else-uid"] } }]
    );

    const result = await canViewDashboardViaSharedFolder("dash-1", viewer, adminDb);

    expect(result).toEqual({ allowed: false });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataSourceKind, type DataSource } from "@/lib/data-sources/types";

type DocData = Record<string, unknown>;
type DocState = { exists: boolean; data: DocData };

const firestoreMocks = vi.hoisted(() => {
  const users = new Map<string, DocState>();
  const departments = new Map<string, DocState>();

  function snapshot(id: string, state: DocState | undefined) {
    return {
      id,
      exists: state?.exists ?? false,
      data: () => state?.data ?? null,
    };
  }

  function docRef(collectionName: string, id: string) {
    return {
      id,
      collectionName,
      get: vi.fn(async () => {
        if (collectionName === "users") {
          return snapshot(id, users.get(id));
        }
        if (collectionName === "departments") {
          return snapshot(id, departments.get(id));
        }

        throw new Error(`Unmocked collection: ${collectionName}`);
      }),
    };
  }

  function stateFor(collectionName: string, id: string) {
    if (collectionName === "users") return users.get(id);
    if (collectionName === "departments") return departments.get(id);
    throw new Error(`Unmocked collection: ${collectionName}`);
  }

  return {
    users,
    departments,
    docRef,
    getAll: vi.fn(
      async (...refs: Array<{ id: string; collectionName: string }>) =>
        refs.map((ref) => snapshot(ref.id, stateFor(ref.collectionName, ref.id))),
    ),
    reset: () => {
      users.clear();
      departments.clear();
    },
  };
});

vi.mock("@/lib/firebase/admin", () => ({
  adminDb: {
    collection: (name: string) => ({
      doc: (id: string) => firestoreMocks.docRef(name, id),
    }),
    getAll: firestoreMocks.getAll,
  },
}));

const { canQueryDataSource, resolveViewerScope } = await import(
  "@/lib/data-sources/access"
);

function dataSource(overrides: Partial<DataSource> = {}): DataSource {
  return {
    id: "source-a",
    kind: DataSourceKind.CSV,
    orgId: "org-a",
    configVersion: 1,
    accessGrants: {
      assignedUsers: [],
      assignedDepartments: [],
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  firestoreMocks.reset();
});

describe("canQueryDataSource", () => {
  it("permite consulta quando o usuário está em assignedUsers", async () => {
    const result = await canQueryDataSource(
      "uid-a",
      dataSource({
        accessGrants: {
          assignedUsers: ["uid-a"],
          assignedDepartments: [],
        },
      }),
    );

    expect(result).toEqual({ canQuery: true });
  });

  it("permite consulta quando o usuário pertence a department atribuído", async () => {
    firestoreMocks.departments.set("sales", {
      exists: true,
      data: { memberUids: ["uid-supervisor"] },
    });

    const result = await canQueryDataSource(
      "uid-supervisor",
      dataSource({
        accessGrants: {
          assignedUsers: [],
          assignedDepartments: ["sales"],
        },
      }),
    );

    expect(result).toEqual({ canQuery: true });
  });

  it("bloqueia rep comum quando o department dele não está atribuído", async () => {
    firestoreMocks.departments.set("support", {
      exists: true,
      data: { memberUids: ["uid-rep"] },
    });
    firestoreMocks.departments.set("sales", {
      exists: true,
      data: { memberUids: ["uid-supervisor"] },
    });

    const result = await canQueryDataSource(
      "uid-rep",
      dataSource({
        accessGrants: {
          assignedUsers: [],
          assignedDepartments: ["sales"],
        },
      }),
    );

    expect(result).toEqual({ canQuery: false });
  });

  it("bloqueia consulta quando accessGrants está ausente", async () => {
    const result = await canQueryDataSource(
      "uid-a",
      dataSource({ accessGrants: undefined }),
    );

    expect(result).toEqual({ canQuery: false });
  });
});

describe("resolveViewerScope", () => {
  it("retorna apenas o email normalizado do viewer para ownerColumnIdentity=email", async () => {
    firestoreMocks.users.set("uid-viewer", {
      exists: true,
      data: { email: " Viewer@Example.COM " },
    });
    firestoreMocks.users.set("uid-other", {
      exists: true,
      data: { email: "other@example.com" },
    });

    const result = await resolveViewerScope(
      "uid-viewer",
      dataSource({
        ownerColumnIdentity: "email",
        accessGrants: {
          assignedUsers: ["uid-viewer", "uid-other"],
          assignedDepartments: [],
        },
      }),
    );

    expect(result.ownerKeys).toEqual(["viewer@example.com"]);
  });

  it("retorna apenas o uid do viewer quando ownerColumnIdentity é uid", async () => {
    const result = await resolveViewerScope(
      "uid-viewer",
      dataSource({
        ownerColumnIdentity: "uid",
        accessGrants: {
          assignedUsers: ["uid-viewer", "uid-other"],
          assignedDepartments: [],
        },
      }),
    );

    expect(result.ownerKeys).toEqual(["uid-viewer"]);
  });

  it("ignora user doc ausente ao resolver email do viewer", async () => {
    firestoreMocks.users.set("uid-other", {
      exists: true,
      data: { email: "other@example.com" },
    });

    const result = await resolveViewerScope(
      "uid-viewer",
      dataSource({
        accessGrants: {
          assignedUsers: ["uid-viewer", "uid-other"],
          assignedDepartments: [],
        },
      }),
    );

    expect(result).toEqual({ ownerKeys: [] });
  });

  it("viewer autorizado por department ve somente as proprias linhas", async () => {
    firestoreMocks.departments.set("sales", {
      exists: true,
      data: { memberUids: ["uid-viewer", "uid-other"] },
    });
    firestoreMocks.users.set("uid-viewer", {
      exists: true,
      data: { email: "viewer@example.com" },
    });
    firestoreMocks.users.set("uid-other", {
      exists: true,
      data: { email: "other@example.com" },
    });

    const auth = await canQueryDataSource(
      "uid-viewer",
      dataSource({
        accessGrants: {
          assignedUsers: [],
          assignedDepartments: ["sales"],
        },
      }),
    );
    const scope = await resolveViewerScope(
      "uid-viewer",
      dataSource({
        accessGrants: {
          assignedUsers: [],
          assignedDepartments: ["sales"],
        },
      }),
    );

    expect(auth).toEqual({ canQuery: true });
    expect(scope).toEqual({ ownerKeys: ["viewer@example.com"] });
  });

  it("retorna ownerKeys vazio quando uid do viewer está vazio", async () => {
    const result = await resolveViewerScope(
      "",
      dataSource({
        accessGrants: {
          assignedUsers: [],
          assignedDepartments: [],
        },
      }),
    );

    expect(result).toEqual({ ownerKeys: [] });
  });
});

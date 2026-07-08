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
  it("retorna emails normalizados para comparação case-insensitive", async () => {
    firestoreMocks.departments.set("sales", {
      exists: true,
      data: { memberUids: ["uid-member"] },
    });
    firestoreMocks.users.set("uid-member", {
      exists: true,
      data: { email: "MEMBER@EXAMPLE.COM" },
    });
    firestoreMocks.users.set("uid-direct", {
      exists: true,
      data: { email: " Direct@Example.COM " },
    });

    const result = await resolveViewerScope(
      "uid-viewer",
      dataSource({
        ownerColumnIdentity: "email",
        accessGrants: {
          assignedUsers: ["uid-direct"],
          assignedDepartments: ["sales"],
        },
      }),
    );

    expect(result.ownerKeys).toEqual([
      "member@example.com",
      "direct@example.com",
    ]);
  });

  it("retorna uids diretos quando ownerColumnIdentity é uid", async () => {
    firestoreMocks.departments.set("sales", {
      exists: true,
      data: { memberUids: ["uid-member"] },
    });

    const result = await resolveViewerScope(
      "uid-viewer",
      dataSource({
        ownerColumnIdentity: "uid",
        accessGrants: {
          assignedUsers: ["uid-direct"],
          assignedDepartments: ["sales"],
        },
      }),
    );

    expect(result.ownerKeys).toEqual(["uid-member", "uid-direct"]);
  });

  it("ignora user doc ausente ao resolver emails", async () => {
    firestoreMocks.departments.set("sales", {
      exists: true,
      data: { memberUids: ["uid-member", "uid-missing"] },
    });
    firestoreMocks.users.set("uid-member", {
      exists: true,
      data: { email: "member@example.com" },
    });

    const result = await resolveViewerScope(
      "uid-viewer",
      dataSource({
        accessGrants: {
          assignedUsers: [],
          assignedDepartments: ["sales"],
        },
      }),
    );

    expect(result).toEqual({ ownerKeys: ["member@example.com"] });
  });

  it("deduplica owner keys repetidos", async () => {
    firestoreMocks.departments.set("sales", {
      exists: true,
      data: { memberUids: ["uid-a", "uid-b"] },
    });
    firestoreMocks.users.set("uid-a", {
      exists: true,
      data: { email: "owner@example.com" },
    });
    firestoreMocks.users.set("uid-b", {
      exists: true,
      data: { email: "OWNER@EXAMPLE.COM" },
    });

    const result = await resolveViewerScope(
      "uid-viewer",
      dataSource({
        accessGrants: {
          assignedUsers: ["uid-a"],
          assignedDepartments: ["sales"],
        },
      }),
    );

    expect(result).toEqual({ ownerKeys: ["owner@example.com"] });
  });

  it("retorna ownerKeys vazio quando não há grants nem members", async () => {
    firestoreMocks.departments.set("sales", {
      exists: true,
      data: { memberUids: [] },
    });

    const result = await resolveViewerScope(
      "uid-viewer",
      dataSource({
        accessGrants: {
          assignedUsers: [],
          assignedDepartments: ["sales"],
        },
      }),
    );

    expect(result).toEqual({ ownerKeys: [] });
  });
});

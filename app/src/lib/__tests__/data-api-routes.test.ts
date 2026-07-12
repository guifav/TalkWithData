import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const routeMocks = vi.hoisted(() => ({
  verifyDataApiRequest: vi.fn(),
  getInstanceTables: vi.fn(),
  recordAudit: vi.fn(),
  readRows: vi.fn(),
  insertRows: vi.fn(),
  updateRows: vi.fn(),
  deleteRows: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock("@/lib/data-api-auth", () => ({
  verifyDataApiRequest: routeMocks.verifyDataApiRequest,
}));

vi.mock("@/lib/app-db/registry", () => ({
  getInstanceTables: routeMocks.getInstanceTables,
  recordAudit: routeMocks.recordAudit,
}));

vi.mock("@/lib/app-db/schema-manager", () => ({
  readRows: routeMocks.readRows,
  insertRows: routeMocks.insertRows,
  updateRows: routeMocks.updateRows,
  deleteRows: routeMocks.deleteRows,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRawUnsafe: routeMocks.queryRaw,
  },
}));

const tableRoute = await import("@/app/api/dashboards/[id]/data/[table]/route");
const rowRoute = await import("@/app/api/dashboards/[id]/data/[table]/[rowId]/route");

const auth = {
  dashboardId: "dashboard-1",
  instance: {
    id: "instance-1",
    dashboardId: "dashboard-1",
    ownerUid: "owner-1",
    userSchema: "usr_owner",
  },
};

const table = {
  logicalName: "orders",
  tableName: "d_dashboard__orders",
};

function request(
  method: string,
  options: { body?: unknown; origin?: string; query?: string } = {},
): NextRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.origin) headers.Origin = options.origin;
  return new NextRequest(
    `http://localhost/api/dashboards/dashboard-1/data/orders${options.query || ""}`,
    {
      method,
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    },
  );
}

function tableContext(logicalName = "orders") {
  return { params: Promise.resolve({ id: "dashboard-1", table: logicalName }) };
}

function rowContext(logicalName = "orders") {
  return {
    params: Promise.resolve({
      id: "dashboard-1",
      table: logicalName,
      rowId: "row-1",
    }),
  };
}

describe("dashboard Data API routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.verifyDataApiRequest.mockResolvedValue(auth);
    routeMocks.getInstanceTables.mockResolvedValue([table]);
    routeMocks.recordAudit.mockResolvedValue(undefined);
    routeMocks.readRows.mockResolvedValue({ rows: [{ id: "row-1" }], total: 1 });
    routeMocks.insertRows.mockResolvedValue(2);
    routeMocks.updateRows.mockResolvedValue(1);
    routeMocks.deleteRows.mockResolvedValue(1);
    routeMocks.queryRaw.mockResolvedValue([{ id: "row-1", amount: 10 }]);
  });

  describe("CORS preflight", () => {
    it.each([tableRoute.OPTIONS, rowRoute.OPTIONS])(
      "autoriza somente origem sandbox nula",
      async (optionsHandler) => {
        const allowed = await optionsHandler(request("OPTIONS", { origin: "null" }));
        const regular = await optionsHandler(request("OPTIONS", { origin: "https://app.test" }));

        expect(allowed.status).toBe(204);
        expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe("null");
        expect(regular.status).toBe(204);
        expect(regular.headers.get("Access-Control-Allow-Origin")).toBeNull();
      },
    );
  });

  describe("table collection route", () => {
    it.each([
      ["GET", tableRoute.GET],
      ["POST", tableRoute.POST],
    ] as const)("nega %s antes de consultar tabelas", async (method, handler) => {
      routeMocks.verifyDataApiRequest.mockResolvedValue(null);

      const response = await handler(
        request(method, { body: method === "POST" ? { rows: [{ amount: 10 }] } : undefined }),
        tableContext(),
      );

      expect(response.status).toBe(401);
      expect(routeMocks.getInstanceTables).not.toHaveBeenCalled();
      expect(routeMocks.readRows).not.toHaveBeenCalled();
      expect(routeMocks.insertRows).not.toHaveBeenCalled();
    });

    it("preserva CORS na resposta não autorizada", async () => {
      routeMocks.verifyDataApiRequest.mockResolvedValue(null);

      const response = await tableRoute.GET(
        request("GET", { origin: "null" }),
        tableContext(),
      );

      expect(response.status).toBe(401);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("null");
    });

    it.each([
      ["GET", tableRoute.GET, "Failed to read data"],
      ["POST", tableRoute.POST, "Failed to insert data"],
    ] as const)("falha fechada quando a autorização de %s fica indisponível", async (method, handler, error) => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      routeMocks.verifyDataApiRequest.mockRejectedValue(new Error("authorization backend details"));

      const response = await handler(
        request(method, {
          body: method === "POST" ? { rows: [{ amount: 10 }] } : undefined,
          origin: "null",
        }),
        tableContext(),
      );

      expect(response.status).toBe(500);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("null");
      await expect(response.json()).resolves.toEqual({ error });
      expect(routeMocks.getInstanceTables).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledOnce();
    });

    it("sanitiza indisponibilidade do registro de tabelas", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      routeMocks.getInstanceTables.mockRejectedValue(new Error("registry details"));

      const response = await tableRoute.GET(
        request("GET", { origin: "null" }),
        tableContext(),
      );

      expect(response.status).toBe(500);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("null");
      await expect(response.json()).resolves.toEqual({ error: "Failed to read data" });
      expect(routeMocks.readRows).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledOnce();
    });

    it.each([
      ["GET", tableRoute.GET],
      ["POST", tableRoute.POST],
    ] as const)("rejeita tabela inválida em %s", async (method, handler) => {
      const response = await handler(
        request(method, { body: method === "POST" ? { rows: [{ amount: 10 }] } : undefined }),
        tableContext("123-invalid"),
      );

      expect(response.status).toBe(400);
      expect(routeMocks.getInstanceTables).not.toHaveBeenCalled();
    });

    it("não aceita tabela fora do escopo da instância", async () => {
      routeMocks.getInstanceTables.mockResolvedValue([]);

      const response = await tableRoute.GET(request("GET"), tableContext());

      expect(response.status).toBe(404);
      expect(routeMocks.readRows).not.toHaveBeenCalled();
    });

    it("lê linhas com limites normalizados", async () => {
      const response = await tableRoute.GET(
        request("GET", { query: "?limit=5000&offset=20&orderBy=amount&orderDir=DESC" }),
        tableContext(),
      );

      expect(response.status).toBe(200);
      expect(routeMocks.readRows).toHaveBeenCalledWith(
        "usr_owner",
        "d_dashboard__orders",
        { orderBy: "amount", orderDir: "DESC", limit: 1000, offset: 20 },
      );
      await expect(response.json()).resolves.toEqual({ rows: [{ id: "row-1" }], total: 1 });
    });

    it("sanitiza falha de leitura", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      routeMocks.readRows.mockRejectedValue(new Error("database details"));

      const response = await tableRoute.GET(request("GET"), tableContext());

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({ error: "Failed to read data" });
      expect(consoleError).toHaveBeenCalledOnce();
    });

    it.each([null, {}, { rows: null }, { rows: [] }, { rows: [null] }, { rows: [42] }])(
      "rejeita corpo de insert inválido: %j",
      async (body) => {
        const response = await tableRoute.POST(request("POST", { body }), tableContext());

        expect(response.status).toBe(400);
        expect(routeMocks.insertRows).not.toHaveBeenCalled();
      },
    );

    it("limita insert a 100 linhas", async () => {
      const response = await tableRoute.POST(
        request("POST", { body: { rows: Array.from({ length: 101 }, () => ({ amount: 10 })) } }),
        tableContext(),
      );

      expect(response.status).toBe(400);
      expect(routeMocks.insertRows).not.toHaveBeenCalled();
    });

    it("insere e registra auditoria obrigatória", async () => {
      const rows = [{ amount: 10 }, { amount: 20 }];

      const response = await tableRoute.POST(
        request("POST", { body: { rows } }),
        tableContext(),
      );

      expect(response.status).toBe(200);
      expect(routeMocks.insertRows).toHaveBeenCalledWith(
        "usr_owner",
        "d_dashboard__orders",
        rows,
      );
      expect(routeMocks.recordAudit).toHaveBeenCalledWith({
        instanceId: "instance-1",
        dashboardId: "dashboard-1",
        ownerUid: "owner-1",
        operationType: "insert",
        tableName: "d_dashboard__orders",
        rowCount: 2,
        executedBy: "html_runtime",
      });
      await expect(response.json()).resolves.toEqual({ inserted: 2 });
    });

    it("não reporta sucesso quando insert ou auditoria falha", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      routeMocks.recordAudit.mockRejectedValue(new Error("audit unavailable"));

      const response = await tableRoute.POST(
        request("POST", { body: { rows: [{ amount: 10 }] } }),
        tableContext(),
      );

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({ error: "Failed to insert data" });
      expect(consoleError).toHaveBeenCalledOnce();
    });
  });

  describe("single-row route", () => {
    it.each([
      ["GET", rowRoute.GET],
      ["PATCH", rowRoute.PATCH],
      ["DELETE", rowRoute.DELETE],
    ] as const)("nega %s antes de consultar tabelas", async (method, handler) => {
      routeMocks.verifyDataApiRequest.mockResolvedValue(null);

      const response = await handler(
        request(method, { body: method === "PATCH" ? { data: { amount: 10 } } : undefined }),
        rowContext(),
      );

      expect(response.status).toBe(401);
      expect(routeMocks.getInstanceTables).not.toHaveBeenCalled();
      expect(routeMocks.queryRaw).not.toHaveBeenCalled();
      expect(routeMocks.updateRows).not.toHaveBeenCalled();
      expect(routeMocks.deleteRows).not.toHaveBeenCalled();
    });

    it.each([
      ["GET", rowRoute.GET, "Failed to read row"],
      ["PATCH", rowRoute.PATCH, "Failed to update row"],
      ["DELETE", rowRoute.DELETE, "Failed to delete row"],
    ] as const)("falha fechada quando a autorização de %s fica indisponível", async (method, handler, error) => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      routeMocks.verifyDataApiRequest.mockRejectedValue(new Error("authorization backend details"));

      const response = await handler(
        request(method, {
          body: method === "PATCH" ? { data: { amount: 10 } } : undefined,
          origin: "null",
        }),
        rowContext(),
      );

      expect(response.status).toBe(500);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("null");
      await expect(response.json()).resolves.toEqual({ error });
      expect(routeMocks.getInstanceTables).not.toHaveBeenCalled();
      expect(consoleError).toHaveBeenCalledOnce();
    });

    it("rejeita nome inválido e tabela fora do escopo", async () => {
      const invalid = await rowRoute.GET(request("GET"), rowContext("123-invalid"));
      expect(invalid.status).toBe(400);

      routeMocks.getInstanceTables.mockResolvedValue([]);
      const missing = await rowRoute.GET(request("GET"), rowContext());
      expect(missing.status).toBe(404);
      expect(routeMocks.queryRaw).not.toHaveBeenCalled();
    });

    it("lê uma linha com id parametrizado", async () => {
      const response = await rowRoute.GET(request("GET"), rowContext());

      expect(response.status).toBe(200);
      expect(routeMocks.queryRaw).toHaveBeenCalledWith(
        'SELECT * FROM "usr_owner"."d_dashboard__orders" WHERE "id" = $1 LIMIT 1',
        "row-1",
      );
      await expect(response.json()).resolves.toEqual({ row: { id: "row-1", amount: 10 } });
    });

    it("retorna 404 quando a linha não existe", async () => {
      routeMocks.queryRaw.mockResolvedValue([]);

      const response = await rowRoute.GET(request("GET"), rowContext());

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({ error: "Row not found" });
    });

    it("sanitiza falha de leitura de linha", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      routeMocks.queryRaw.mockRejectedValue(new Error("database details"));

      const response = await rowRoute.GET(request("GET"), rowContext());

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({ error: "Failed to read row" });
      expect(consoleError).toHaveBeenCalledOnce();
    });

    it.each([null, [], "invalid", 42, {}])(
      "rejeita corpo de update inválido: %j",
      async (data) => {
        const response = await rowRoute.PATCH(
          request("PATCH", { body: { data } }),
          rowContext(),
        );

        expect(response.status).toBe(400);
        expect(routeMocks.updateRows).not.toHaveBeenCalled();
      },
    );

    it("atualiza e registra auditoria obrigatória", async () => {
      const data = { amount: 15 };

      const response = await rowRoute.PATCH(
        request("PATCH", { body: { data } }),
        rowContext(),
      );

      expect(response.status).toBe(200);
      expect(routeMocks.updateRows).toHaveBeenCalledWith(
        "usr_owner",
        "d_dashboard__orders",
        [{ id: "row-1", data }],
      );
      expect(routeMocks.recordAudit).toHaveBeenCalledWith({
        instanceId: "instance-1",
        dashboardId: "dashboard-1",
        ownerUid: "owner-1",
        operationType: "update",
        tableName: "d_dashboard__orders",
        rowCount: 1,
        executedBy: "html_runtime",
      });
      await expect(response.json()).resolves.toEqual({ updated: 1 });
    });

    it("sanitiza falha de update ou auditoria", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      routeMocks.updateRows.mockRejectedValue(new Error("database details"));

      const response = await rowRoute.PATCH(
        request("PATCH", { body: { data: { amount: 15 } } }),
        rowContext(),
      );

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({ error: "Failed to update row" });
      expect(consoleError).toHaveBeenCalledOnce();
    });

    it("exclui e registra auditoria obrigatória", async () => {
      const response = await rowRoute.DELETE(request("DELETE"), rowContext());

      expect(response.status).toBe(200);
      expect(routeMocks.deleteRows).toHaveBeenCalledWith(
        "usr_owner",
        "d_dashboard__orders",
        ["row-1"],
      );
      expect(routeMocks.recordAudit).toHaveBeenCalledWith({
        instanceId: "instance-1",
        dashboardId: "dashboard-1",
        ownerUid: "owner-1",
        operationType: "delete",
        tableName: "d_dashboard__orders",
        rowCount: 1,
        executedBy: "html_runtime",
      });
      await expect(response.json()).resolves.toEqual({ deleted: 1 });
    });

    it("sanitiza falha de delete ou auditoria", async () => {
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      routeMocks.recordAudit.mockRejectedValue(new Error("audit unavailable"));

      const response = await rowRoute.DELETE(request("DELETE"), rowContext());

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({ error: "Failed to delete row" });
      expect(consoleError).toHaveBeenCalledOnce();
    });
  });
});

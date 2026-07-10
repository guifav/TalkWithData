import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
process.env.ALLOWED_AUTH_DOMAIN = "example.com";
process.env.STORAGE_BUCKET_NAME = "test-bucket";

const mockVerifyRequest = vi.fn();
const mockCanViewViaSharedFolder = vi.fn();
const mockVerifyEmbedToken = vi.fn();
const mockGetHtmlFile = vi.fn();
const mockGetDashboardAsset = vi.fn();
const mockDashboardGet = vi.fn();
const mockVersionGet = vi.fn();

function snapshot(exists: boolean, data: Record<string, unknown> = {}) {
  return {
    exists,
    data: () => data,
  };
}

vi.mock("@/lib/api-auth", () => ({
  verifyRequest: mockVerifyRequest,
}));

vi.mock("@/lib/permissions", () => ({
  canViewDashboardViaSharedFolder: mockCanViewViaSharedFolder,
}));

vi.mock("@/lib/embed-tokens", () => ({
  verifyEmbedToken: mockVerifyEmbedToken,
}));

vi.mock("@/lib/storage", () => ({
  getHtmlFile: mockGetHtmlFile,
  getDashboardAsset: mockGetDashboardAsset,
}));

vi.mock("@/lib/dash-session", () => ({
  createDashSessionToken: vi.fn().mockReturnValue("session-token"),
  verifyDashSessionToken: vi.fn().mockReturnValue(false),
}));

// Passthrough: o shim de compat nao importa para os asserts de headers
vi.mock("@/lib/dashboard-html", () => ({
  prepareDashboardHtmlForRender: (html: string) => html,
}));

vi.mock("@/lib/firebase/admin", () => ({
  adminDb: {
    collection: (collectionName: string) => ({
      doc: () => ({
        get:
          collectionName === "dashboards"
            ? mockDashboardGet
            : vi.fn().mockResolvedValue(snapshot(false)),
        update: vi.fn().mockResolvedValue(undefined),
        set: vi.fn().mockResolvedValue(undefined),
        collection: () => ({
          add: vi.fn().mockResolvedValue(undefined),
          doc: () => ({
            set: vi.fn().mockResolvedValue(undefined),
            get: mockVersionGet,
          }),
        }),
      }),
      where: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ docs: [] }),
      }),
    }),
  },
}));

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    increment: vi.fn(),
    serverTimestamp: vi.fn(),
  },
}));

const { GET: getView } = await import("@/app/api/dashboards/[id]/view/route");
const { GET: getAsset } = await import(
  "@/app/api/dashboards/[id]/view/[...path]/route"
);
const { GET: getVersion } = await import(
  "@/app/api/dashboards/[id]/versions/[versionId]/view/route"
);

function viewRequest(query = ""): NextRequest {
  return new NextRequest(
    `http://localhost/api/dashboards/dash-id/view${query}`,
    { headers: { Authorization: "Bearer token" } }
  );
}

function assetRequest(path: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/dashboards/dash-id/view/${path}`,
    { headers: { Authorization: "Bearer token" } }
  );
}

const viewParams = { params: Promise.resolve({ id: "dash-id" }) };

function assetParams(path: string) {
  return { params: Promise.resolve({ id: "dash-id", path: path.split("/") }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifyRequest.mockResolvedValue({
    uid: "owner-uid",
    email: "owner@example.com",
    name: "Owner",
  });
  mockCanViewViaSharedFolder.mockResolvedValue({ allowed: false });
  mockVerifyEmbedToken.mockResolvedValue(false);
  mockDashboardGet.mockResolvedValue(
    snapshot(true, {
      createdBy: "owner-uid",
      visibility: "specific",
      allowedEmails: [],
      allowedDepartments: [],
      storagePath: "dashboards/owner-uid/dash-id/index.html",
    })
  );
  mockGetHtmlFile.mockResolvedValue(
    Buffer.from("<html><head></head><body>ok</body></html>")
  );
  mockGetDashboardAsset.mockResolvedValue(null);
  mockVersionGet.mockResolvedValue(
    snapshot(true, {
      storagePath: "dashboards/owner-uid/dash-id/versions/v1.html",
    })
  );
});

// HTML enviado por usuario e executavel; o CSP sandbox (sem allow-same-origin)
// garante origem opaca tambem quando a URL da rota e aberta direto no browser,
// em paridade com o sandbox="allow-scripts" dos iframes da UI.
describe("GET /api/dashboards/[id]/view security headers", () => {
  it("serves dashboard HTML with CSP sandbox and nosniff headers", async () => {
    const response = await getView(viewRequest(), viewParams);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    expect(response.headers.get("Content-Security-Policy")).toBe(
      "sandbox allow-scripts"
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  });

  it("keeps security headers on raw=1 responses", async () => {
    const response = await getView(viewRequest("?raw=1"), viewParams);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Security-Policy")).toBe(
      "sandbox allow-scripts"
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("keeps security headers on embed token access", async () => {
    mockVerifyRequest.mockResolvedValue(null);
    mockVerifyEmbedToken.mockResolvedValue(true);

    const response = await getView(
      new NextRequest(
        "http://localhost/api/dashboards/dash-id/view?embed_token=tok"
      ),
      viewParams
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Security-Policy")).toBe(
      "sandbox allow-scripts"
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});

describe("GET /api/dashboards/[id]/versions/[versionId]/view security headers", () => {
  it("serves version HTML with CSP sandbox and nosniff headers", async () => {
    const response = await getVersion(
      new NextRequest(
        "http://localhost/api/dashboards/dash-id/versions/v1/view",
        { headers: { Authorization: "Bearer token" } }
      ),
      { params: Promise.resolve({ id: "dash-id", versionId: "v1" }) }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    expect(response.headers.get("Content-Security-Policy")).toBe(
      "sandbox allow-scripts"
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  });
});

describe("GET /api/dashboards/[id]/view/[...path] security headers", () => {
  it("serves sub-page HTML with CSP sandbox and nosniff headers", async () => {
    mockGetDashboardAsset.mockResolvedValue({
      buffer: Buffer.from("<html><head></head><body>page</body></html>"),
      contentType: "text/html",
    });

    const response = await getAsset(
      assetRequest("pages/detail.html"),
      assetParams("pages/detail.html")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    expect(response.headers.get("Content-Security-Policy")).toBe(
      "sandbox allow-scripts"
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
  });

  it("serves non-HTML assets with nosniff and without CSP sandbox", async () => {
    mockGetDashboardAsset.mockResolvedValue({
      buffer: Buffer.from("body { color: black; }"),
      contentType: "text/css",
    });

    const response = await getAsset(
      assetRequest("assets/style.css"),
      assetParams("assets/style.css")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("Content-Security-Policy")).toBeNull();
    expect(response.headers.get("Cache-Control")).toContain("private");
  });

  // Um SVG enviado renderiza como documento ativo em navegacao direta e pode
  // executar <script> na origem do app, entao precisa do mesmo sandbox do HTML.
  it("sandboxes uploaded SVG served as an active document", async () => {
    mockGetDashboardAsset.mockResolvedValue({
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
      contentType: "image/svg+xml",
    });

    const response = await getAsset(
      assetRequest("assets/logo.svg"),
      assetParams("assets/logo.svg")
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Security-Policy")).toBe(
      "sandbox allow-scripts"
    );
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { NextRequest } from "next/server";

process.env.ALLOWED_AUTH_DOMAIN = "example.com";

const dashboardData = new Map<string, Record<string, unknown>>();
let nextDashboardId = 0;

const auth = {
  uid: "local-user",
  email: "owner@example.com",
  name: "Owner",
};

vi.mock("@/lib/api-auth", () => ({
  verifyRequest: vi.fn().mockResolvedValue(auth),
}));

vi.mock("@/lib/categories", () => ({
  isValidCategory: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/slug", () => ({
  generateSlug: vi.fn().mockReturnValue("local-dashboard"),
  reserveUniqueSlug: vi.fn().mockResolvedValue("local-dashboard"),
  releaseSlug: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/thumbnail", () => ({
  triggerThumbnailGeneration: vi.fn(),
}));

vi.mock("@/lib/permissions", () => ({
  canViewDashboardViaSharedFolder: vi.fn().mockResolvedValue({ allowed: false }),
}));

vi.mock("@/lib/embed-tokens", () => ({
  verifyEmbedToken: vi.fn().mockResolvedValue(false),
}));

vi.mock("@/lib/dash-session", () => ({
  createDashSessionToken: vi.fn().mockReturnValue("session-token"),
  verifyDashSessionToken: vi.fn().mockReturnValue(false),
}));

vi.mock("@/lib/dashboard-html", () => ({
  prepareDashboardHtmlForRender: (html: string) => html,
}));

vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    increment: vi.fn().mockReturnValue(1),
    serverTimestamp: vi.fn().mockReturnValue("timestamp"),
  },
}));

vi.mock("@/lib/firebase/admin", () => ({
  adminDb: {
    collection: (collectionName: string) => ({
      doc: (requestedId?: string) => {
        const id = requestedId || `dash-${++nextDashboardId}`;
        return {
          id,
          get: vi.fn().mockImplementation(async () => ({
            exists: dashboardData.has(id),
            data: () => dashboardData.get(id),
          })),
          set: vi.fn().mockImplementation(async (data: Record<string, unknown>) => {
            if (collectionName === "dashboards") dashboardData.set(id, data);
          }),
          update: vi.fn().mockResolvedValue(undefined),
          collection: () => ({
            add: vi.fn().mockResolvedValue(undefined),
            doc: () => ({ set: vi.fn().mockResolvedValue(undefined) }),
          }),
        };
      },
      where: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ docs: [] }),
      }),
    }),
  },
}));

const { POST: uploadDashboard } = await import("@/app/api/upload/route");
const { GET: viewDashboard } = await import("@/app/api/dashboards/[id]/view/route");
const { GET: viewAsset } = await import("@/app/api/dashboards/[id]/view/[...path]/route");

let storageRoot: string;
const previousProvider = process.env.STORAGE_PROVIDER;
const previousRoot = process.env.LOCAL_STORAGE_ROOT;
const previousBucket = process.env.STORAGE_BUCKET_NAME;

beforeAll(async () => {
  storageRoot = await mkdtemp(path.join(tmpdir(), "twd-local-routes-"));
  process.env.STORAGE_PROVIDER = "local";
  process.env.LOCAL_STORAGE_ROOT = storageRoot;
  delete process.env.STORAGE_BUCKET_NAME;
});

beforeEach(() => {
  dashboardData.clear();
  nextDashboardId = 0;
});

afterAll(async () => {
  await rm(storageRoot, { recursive: true, force: true });
  restoreEnv("STORAGE_PROVIDER", previousProvider);
  restoreEnv("LOCAL_STORAGE_ROOT", previousRoot);
  restoreEnv("STORAGE_BUCKET_NAME", previousBucket);
});

describe("local storage routes", () => {
  it("uploads and serves a single HTML dashboard without a bucket", async () => {
    const form = new FormData();
    form.set("title", "Local dashboard");
    form.set("file", new File(["<html><body>local route</body></html>"], "index.html"));

    const uploadResponse = await uploadDashboard(
      new NextRequest("http://localhost/api/upload", { method: "POST", body: form })
    );
    const uploaded = (await uploadResponse.json()) as { id: string };

    expect(uploadResponse.status).toBe(200);
    const viewResponse = await viewDashboard(
      new NextRequest(`http://localhost/api/dashboards/${uploaded.id}/view`, {
        headers: { Authorization: "Bearer token" },
      }),
      { params: Promise.resolve({ id: uploaded.id }) }
    );
    expect(viewResponse.status).toBe(200);
    expect(await viewResponse.text()).toContain("local route");
  });

  it("uploads a ZIP and serves an asset through the catch-all route", async () => {
    const zip = new AdmZip();
    zip.addFile("site/index.html", Buffer.from("<html><body>multi</body></html>"));
    zip.addFile("site/assets/main.css", Buffer.from("body { color: teal; }"));
    const form = new FormData();
    form.set("title", "Local multi-page dashboard");
    form.set("file", new File([zip.toBuffer()], "dashboard.zip"));

    const uploadResponse = await uploadDashboard(
      new NextRequest("http://localhost/api/upload", { method: "POST", body: form })
    );
    const uploaded = (await uploadResponse.json()) as { id: string };

    expect(uploadResponse.status).toBe(200);
    const assetResponse = await viewAsset(
      new NextRequest(
        `http://localhost/api/dashboards/${uploaded.id}/view/assets/main.css`,
        { headers: { Authorization: "Bearer token" } }
      ),
      {
        params: Promise.resolve({
          id: uploaded.id,
          path: ["assets", "main.css"],
        }),
      }
    );
    expect(assetResponse.status).toBe(200);
    expect(await assetResponse.text()).toBe("body { color: teal; }");
  });
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

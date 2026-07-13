import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import AdmZip from "adm-zip";
import { NextRequest } from "next/server";

process.env.ALLOWED_AUTH_DOMAIN = "example.com";

const routeMocks = vi.hoisted(() => ({
  verifyRequest: vi.fn(),
}));

const dashboardData = new Map<string, Record<string, unknown>>();
const versionData = new Map<string, Record<string, unknown>>();
let nextDashboardId = 0;
let dashboardUpdateError: Error | null = null;

const auth = {
  uid: "local-user",
  email: "owner@example.com",
  name: "Owner",
};

function toBlobPart(buffer: Buffer): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(buffer.length);
  bytes.set(buffer);
  return bytes;
}

vi.mock("@/lib/api-auth", () => ({
  verifyRequest: routeMocks.verifyRequest,
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

vi.mock("@/lib/versions", () => ({
  archiveCurrentVersion: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/permissions", () => ({
  canViewDashboard: vi.fn().mockReturnValue(true),
  canViewDashboardViaSharedFolder: vi.fn().mockResolvedValue({ allowed: false }),
}));

vi.mock("@/lib/app-db/registry", () => ({
  finalizeDeleted: vi.fn().mockResolvedValue(undefined),
  getInstance: vi.fn().mockResolvedValue(null),
  markForDeletion: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/app-db/schema-manager", () => ({
  dropTablesWithPrefix: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    dashboardFieldAudit: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    dashboardFieldSchema: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
  },
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
    delete: vi.fn().mockReturnValue("deleted-field"),
    increment: vi.fn().mockReturnValue(1),
    arrayRemove: vi.fn().mockReturnValue("array-remove"),
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
          update: vi.fn().mockImplementation(async (updates: Record<string, unknown>) => {
            if (collectionName === "dashboards") {
              if (dashboardUpdateError) throw dashboardUpdateError;
              dashboardData.set(id, { ...dashboardData.get(id), ...updates });
            }
          }),
          delete: vi.fn().mockImplementation(async () => {
            if (collectionName === "dashboards") dashboardData.delete(id);
          }),
          collection: (subcollectionName: string) => ({
            add: vi.fn().mockResolvedValue(undefined),
            doc: (versionId = "generated-version") => ({
              get: vi.fn().mockImplementation(async () => {
                const key = `${id}/${versionId}`;
                return {
                  exists: versionData.has(key),
                  data: () => versionData.get(key),
                };
              }),
              set: vi.fn().mockImplementation(async (data: Record<string, unknown>) => {
                if (subcollectionName === "versions") {
                  versionData.set(`${id}/${versionId}`, data);
                }
              }),
            }),
          }),
        };
      },
      where: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ docs: [] }),
      }),
    }),
    collectionGroup: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
      }),
    }),
    batch: vi.fn().mockReturnValue({
      update: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

const { POST: uploadDashboard } = await import("@/app/api/upload/route");
const { GET: viewDashboard } = await import("@/app/api/dashboards/[id]/view/route");
const { GET: viewAsset } = await import("@/app/api/dashboards/[id]/view/[...path]/route");
const { POST: replaceDashboard } = await import("@/app/api/dashboards/[id]/replace/route");
const { POST: restoreDashboardVersion } = await import(
  "@/app/api/dashboards/[id]/versions/route"
);
const { DELETE: deleteDashboard } = await import("@/app/api/dashboards/[id]/route");
const {
  getHtmlFile,
  uploadHtmlFile,
  uploadZipDashboard,
  uploadZipDashboardRevision,
} = await import("@/lib/storage");
const { getStorageProvider } = await import("@/lib/storage-provider");

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
  versionData.clear();
  nextDashboardId = 0;
  dashboardUpdateError = null;
  routeMocks.verifyRequest.mockReset();
  routeMocks.verifyRequest.mockResolvedValue(auth);
});

afterAll(async () => {
  await rm(storageRoot, { recursive: true, force: true });
  restoreEnv("STORAGE_PROVIDER", previousProvider);
  restoreEnv("LOCAL_STORAGE_ROOT", previousRoot);
  restoreEnv("STORAGE_BUCKET_NAME", previousBucket);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("local storage routes", () => {
  it("correlaciona e sanitiza rejeições de upload", async () => {
    routeMocks.verifyRequest.mockResolvedValue(null);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const response = await uploadDashboard(new NextRequest("http://localhost/api/upload", {
      method: "POST",
      headers: {
        Authorization: "Bearer request-secret",
        "x-request-id": "018f52a2-7e1d-7c4b-9a80-123456789abc",
      },
    }));

    expect(response.status).toBe(401);
    expect(response.headers.get("x-request-id")).toBe("018f52a2-7e1d-7c4b-9a80-123456789abc");
    expect(warn).toHaveBeenCalledOnce();
    const output = warn.mock.calls[0][0] as string;
    expect(output).toContain('"event":"request.upload.rejected"');
    expect(output).toContain('"reason":"unauthorized"');
    expect(output).not.toContain("request-secret");
  });

  it("correlaciona falhas sem serializar o corpo da requisição", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await uploadDashboard(new NextRequest("http://localhost/api/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-request-id": "018f52a2-7e1d-7c4b-9a80-abcdef123456",
      },
      body: JSON.stringify({ authorization: "Bearer body-secret" }),
    }));

    expect(response.status).toBe(500);
    expect(response.headers.get("x-request-id")).toBe("018f52a2-7e1d-7c4b-9a80-abcdef123456");
    expect(errorLog).toHaveBeenCalledOnce();
    const output = errorLog.mock.calls[0][0] as string;
    expect(output).toContain('"event":"request.upload.failed"');
    expect(output).toContain('"name":"TypeError"');
    expect(output).not.toContain("body-secret");
    expect(output).not.toContain("authorization");
  });

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
    form.set("file", new File([toBlobPart(zip.toBuffer())], "dashboard.zip"));

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

  it("replaces index.html with a ZIP whose entrypoint has the same name", async () => {
    const id = "html-to-zip";
    const oldStoragePath = await uploadHtmlFile(
      auth.uid,
      id,
      "index.html",
      Buffer.from("<html><body>old single</body></html>")
    );
    dashboardData.set(id, {
      createdBy: auth.uid,
      fileName: "index.html",
      fileSizeBytes: 36,
      storagePath: oldStoragePath,
    });
    const zip = new AdmZip();
    zip.addFile("index.html", Buffer.from("<html><body>new package</body></html>"));
    zip.addFile("assets/main.css", Buffer.from("body { color: green; }"));
    const form = new FormData();
    form.set("file", new File([toBlobPart(zip.toBuffer())], "dashboard.zip"));

    const response = await replaceDashboard(
      new NextRequest(`http://localhost/api/dashboards/${id}/replace`, {
        method: "POST",
        body: form,
      }),
      { params: Promise.resolve({ id }) }
    );

    expect(response.status).toBe(200);
    const updated = dashboardData.get(id)!;
    expect(updated.storagePath).not.toBe(oldStoragePath);
    expect(updated.storagePrefix).toMatch(
      /^dashboards\/local-user\/html-to-zip\/revisions\/[^/]+\/$/
    );
    await expect(getHtmlFile(updated.storagePath as string)).resolves.toEqual(
      Buffer.from("<html><body>new package</body></html>")
    );
    const assetResponse = await viewAsset(
      new NextRequest(`http://localhost/api/dashboards/${id}/view/assets/main.css`, {
        headers: { Authorization: "Bearer token" },
      }),
      { params: Promise.resolve({ id, path: ["assets", "main.css"] }) }
    );
    expect(assetResponse.status).toBe(200);
    expect(await assetResponse.text()).toBe("body { color: green; }");
  });

  it("replaces a ZIP with index.html without deleting the new file", async () => {
    const id = "zip-to-html";
    const zip = new AdmZip();
    zip.addFile("index.html", Buffer.from("<html><body>old package</body></html>"));
    zip.addFile("assets/main.css", Buffer.from("body { color: navy; }"));
    const oldPackage = await uploadZipDashboard(auth.uid, id, zip.toBuffer());
    dashboardData.set(id, {
      createdBy: auth.uid,
      fileName: oldPackage.entrypoint,
      fileSizeBytes: oldPackage.totalSizeBytes,
      storagePath: oldPackage.storagePath,
      storagePrefix: oldPackage.storagePrefix,
      isMultiPage: true,
      entrypoint: oldPackage.entrypoint,
      files: oldPackage.files,
    });
    const form = new FormData();
    form.set("file", new File(["<html><body>new single</body></html>"], "index.html"));

    const response = await replaceDashboard(
      new NextRequest(`http://localhost/api/dashboards/${id}/replace`, {
        method: "POST",
        body: form,
      }),
      { params: Promise.resolve({ id }) }
    );

    expect(response.status).toBe(200);
    const updated = dashboardData.get(id)!;
    expect(updated.storagePath).not.toBe(oldPackage.storagePath);
    await expect(getHtmlFile(updated.storagePath as string)).resolves.toEqual(
      Buffer.from("<html><body>new single</body></html>")
    );
  });

  it("keeps the live dashboard and removes the staged ZIP when metadata swap fails", async () => {
    const id = "failed-zip-swap";
    const oldContents = Buffer.from("<html><body>still live</body></html>");
    const oldStoragePath = await uploadHtmlFile(
      auth.uid,
      id,
      "index.html",
      oldContents
    );
    dashboardData.set(id, {
      createdBy: auth.uid,
      fileName: "index.html",
      fileSizeBytes: oldContents.length,
      storagePath: oldStoragePath,
    });
    dashboardUpdateError = new Error("metadata update failed");
    const zip = new AdmZip();
    zip.addFile("index.html", Buffer.from("<html><body>never live</body></html>"));
    zip.addFile("assets/main.css", Buffer.from("body { color: red; }"));
    const form = new FormData();
    form.set("file", new File([toBlobPart(zip.toBuffer())], "dashboard.zip"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await replaceDashboard(
      new NextRequest(`http://localhost/api/dashboards/${id}/replace`, {
        method: "POST",
        body: form,
      }),
      { params: Promise.resolve({ id }) }
    );

    expect(response.status).toBe(500);
    await expect(getHtmlFile(oldStoragePath)).resolves.toEqual(oldContents);
    await expect(
      readdir(path.join(storageRoot, "dashboards", auth.uid, id, "revisions"))
    ).resolves.toEqual([]);
    consoleError.mockRestore();
  });

  it("restores a version through the selected local provider", async () => {
    const id = "restore-version";
    const currentPath = await uploadHtmlFile(
      auth.uid,
      id,
      "current.html",
      Buffer.from("<html><body>current</body></html>")
    );
    const versionPath = `versions/${id}/1/restored.html`;
    await getStorageProvider().upload(
      versionPath,
      Buffer.from("<html><body>restored</body></html>")
    );
    dashboardData.set(id, {
      createdBy: auth.uid,
      fileName: "current.html",
      fileSizeBytes: 33,
      storagePath: currentPath,
    });
    versionData.set(`${id}/1`, {
      storagePath: versionPath,
      fileName: "restored.html",
      fileSizeBytes: 34,
    });

    const response = await restoreDashboardVersion(
      new NextRequest(`http://localhost/api/dashboards/${id}/versions`, {
        method: "POST",
        body: JSON.stringify({ versionId: "1" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: Promise.resolve({ id }) }
    );

    expect(response.status).toBe(200);
    const restoredPath = dashboardData.get(id)!.storagePath as string;
    await expect(getHtmlFile(restoredPath)).resolves.toEqual(
      Buffer.from("<html><body>restored</body></html>")
    );
  });

  it("deletes a revisioned multi-page package through its stable parent prefix", async () => {
    const id = "delete-revisioned-package";
    const zip = new AdmZip();
    zip.addFile("index.html", Buffer.from("<html><body>delete me</body></html>"));
    zip.addFile("assets/main.css", Buffer.from("body { color: black; }"));
    const livePackage = await uploadZipDashboardRevision(
      auth.uid,
      id,
      zip.toBuffer()
    );
    dashboardData.set(id, {
      createdBy: auth.uid,
      fileName: livePackage.entrypoint,
      fileSizeBytes: livePackage.totalSizeBytes,
      storagePath: livePackage.storagePath,
      storagePrefix: livePackage.storagePrefix,
      isMultiPage: true,
      entrypoint: livePackage.entrypoint,
      files: livePackage.files,
      slug: "delete-revisioned-package",
    });

    const response = await deleteDashboard(
      new NextRequest(`http://localhost/api/dashboards/${id}`, { method: "DELETE" }),
      { params: Promise.resolve({ id }) }
    );

    expect(response.status).toBe(200);
    expect(dashboardData.has(id)).toBe(false);
    await expect(getHtmlFile(livePackage.storagePath)).rejects.toMatchObject({
      code: "ENOENT",
    });
  });
});

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

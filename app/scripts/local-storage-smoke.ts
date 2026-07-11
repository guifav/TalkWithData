import assert from "node:assert/strict";
import AdmZip from "adm-zip";
import {
  deleteDashboardFiles,
  getDashboardAsset,
  getHtmlFile,
  uploadHtmlFile,
  uploadZipDashboard,
} from "../src/lib/storage";

const mode = process.argv[2];
const userId = "compose-user";
const htmlDashboardId = "compose-html";
const zipDashboardId = "compose-zip";
const html = Buffer.from("<html><body>local compose storage</body></html>");
const css = Buffer.from("body { color: purple; }");

async function main(): Promise<void> {
  if (process.env.STORAGE_PROVIDER !== "local") {
    throw new Error("The storage smoke requires STORAGE_PROVIDER=local");
  }
  if (process.env.STORAGE_BUCKET_NAME) {
    throw new Error("The local storage smoke must run without STORAGE_BUCKET_NAME");
  }

  if (mode === "write") {
    await deleteDashboardFiles(`dashboards/${userId}/`);
    await uploadHtmlFile(userId, htmlDashboardId, "index.html", html);

    const zip = new AdmZip();
    zip.addFile("site/index.html", Buffer.from("<html><body>multi page</body></html>"));
    zip.addFile("site/assets/main.css", css);
    await uploadZipDashboard(userId, zipDashboardId, zip.toBuffer());

    console.log("Local storage write completed");
  } else if (mode === "read") {
    const storedHtml = await getHtmlFile(
      `dashboards/${userId}/${htmlDashboardId}/index.html`
    );
    assert.deepEqual(storedHtml, html);

    const asset = await getDashboardAsset(
      `dashboards/${userId}/${zipDashboardId}/`,
      "assets/main.css"
    );
    assert.ok(asset);
    assert.deepEqual(asset.buffer, css);
    assert.equal(asset.contentType, "text/css");

    console.log("Local storage read completed");
  } else {
    throw new Error('Expected smoke mode "write" or "read"');
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

import * as ff from "@google-cloud/functions-framework";
import { Storage } from "@google-cloud/storage";
import { Firestore } from "@google-cloud/firestore";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

const BUCKET_NAME = process.env.GCS_BUCKET || "example-uploads";
const THUMBNAIL_SECRET = process.env.THUMBNAIL_SECRET || "";

const storage = new Storage();
const firestore = new Firestore();

ff.http("generateThumbnail", async (req, res) => {
  // Only accept POST
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Auth check
  const internalKey = req.headers["x-internal-key"] as string | undefined;
  if (!THUMBNAIL_SECRET || internalKey !== THUMBNAIL_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { dashboardId } = req.body as { dashboardId?: string };
  if (!dashboardId) {
    res.status(400).json({ error: "dashboardId is required" });
    return;
  }

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    // 1. Read dashboard doc from Firestore
    const docRef = firestore.collection("dashboards").doc(dashboardId);
    const doc = await docRef.get();
    if (!doc.exists) {
      res.status(404).json({ error: "Dashboard not found" });
      return;
    }

    const data = doc.data()!;
    const storagePath = data.storagePath as string | undefined;
    if (!storagePath) {
      res.status(400).json({ error: "Dashboard has no storagePath" });
      return;
    }

    // 2. Download HTML from GCS
    const bucket = storage.bucket(BUCKET_NAME);
    const [htmlBuffer] = await bucket.file(storagePath).download();
    const htmlContent = htmlBuffer.toString("utf-8");

    // 3. Launch headless Chrome — fully sandboxed: no JS, no network
    browser = await puppeteer.launch({
      args: [...chromium.args, "--disable-gpu"],
      defaultViewport: { width: 1280, height: 720 },
      executablePath: await chromium.executablePath(),
      headless: true,
    });

    const page = await browser.newPage();

    // Block ALL outbound network requests. HTML is rendered purely from
    // static content. Prevents user-controlled HTML from probing internal
    // services, exfiltrating data, or loading arbitrary code.
    await page.setRequestInterception(true);
    page.on("request", (req) => req.abort());

    // Disable JavaScript execution. User-uploaded and AI-generated HTML
    // must not execute arbitrary code inside the Cloud Function.
    await page.setJavaScriptEnabled(false);

    // 4. Set content (static render only — no JS, no external resources)
    await page.setContent(htmlContent, {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });

    // 5. Take screenshot
    const screenshotBuffer = await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: 1280, height: 720 },
    });

    // 6. Upload PNG to GCS — private, NOT public.
    // Thumbnails are served through the protected /api/dashboards/[id]/thumbnail
    // route which enforces visibility and allowedEmails checks.
    const timestamp = Date.now();
    const thumbnailPath = `thumbnails/${dashboardId}_${timestamp}.png`;
    const thumbnailFile = bucket.file(thumbnailPath);
    await thumbnailFile.save(Buffer.from(screenshotBuffer), {
      contentType: "image/png",
      metadata: {
        cacheControl: "private, max-age=31536000, immutable",
      },
    });

    // Thumbnail URL points to the auth-protected API route
    const thumbnailUrl = `/api/dashboards/${dashboardId}/thumbnail`;

    // 7. Update Firestore doc
    const oldStoragePath = data.thumbnailStoragePath as string | undefined;
    await docRef.update({
      thumbnailUrl,
      thumbnailUpdatedAt: Date.now(),
      thumbnailStoragePath: thumbnailPath,
      thumbnailContentType: "image/png",
    });

    // 8. Best-effort cleanup of previous thumbnail blob
    if (oldStoragePath && oldStoragePath !== thumbnailPath) {
      bucket.file(oldStoragePath).delete({ ignoreNotFound: true }).catch(() => {});
    }

    console.log(`[Thumbnail] Generated for dashboard ${dashboardId}`);

    res.status(200).json({ ok: true, thumbnailUrl });
  } catch (error) {
    console.error(`[Thumbnail] Error for ${dashboardId}:`, error);
    res.status(500).json({
      error: "Failed to generate thumbnail",
      details: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
});

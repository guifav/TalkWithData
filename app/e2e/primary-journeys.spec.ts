import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { Client } from "pg";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

test("login, upload, authenticated view, embed, and neutral CSV onboarding", async ({ browser, page }) => {
  await signInWithGoogleEmulator(page, "owner@example.com", "Example Owner");
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Admin" })).toBeVisible();

  await page.goto("/upload");
  await page.locator('input[type="file"]').setInputFiles(
    path.join(process.cwd(), "e2e/fixtures/neutral-dashboard.html"),
  );
  await page.getByLabel("Title").fill("Neutral Revenue Overview");

  const uploadResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/upload") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Upload Dashboard" }).click();
  const uploadResponse = await uploadResponsePromise;
  expect(uploadResponse.ok()).toBe(true);
  const { id: dashboardId } = await uploadResponse.json() as { id: string };
  const ownerUid = await authenticatedUid(page);
  await provisionActiveAppDatabase(dashboardId, ownerUid);

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Neutral Revenue Overview", { exact: true })).toBeVisible();

  await page.goto(`/view/${dashboardId}`);
  await expect(page.getByRole("heading", { name: "Neutral Revenue Overview" })).toBeVisible();
  const dashboardFrame = page.frameLocator('iframe[title="Neutral Revenue Overview"]');
  await expect(dashboardFrame.getByRole("heading", { name: "Neutral Revenue Overview" })).toBeVisible();
  await expectWriteStatus(dashboardFrame, 404);

  const embed = await page.evaluate(async (id) => {
    const response = await fetch(`/api/dashboards/${id}/embed-token`, { method: "POST" });
    if (!response.ok) throw new Error(`embed token failed: ${response.status}`);
    return response.json() as Promise<{ embedUrl: string }>;
  }, dashboardId);

  await transferDashboardOwnership(dashboardId);
  await page.goto(`/view/${dashboardId}`);
  await expect(page.getByRole("heading", { name: "Neutral Revenue Overview" })).toBeVisible();
  await expect(page.getByTitle("Configure fields")).toHaveCount(0);
  const viewerFrame = page.frameLocator('iframe[title="Neutral Revenue Overview"]');
  await expect(viewerFrame.getByRole("heading", { name: "Neutral Revenue Overview" })).toBeVisible();
  await expectWriteStatus(viewerFrame, 401);

  const embedContext = await browser.newContext();
  const embedPage = await embedContext.newPage();
  await embedPage.goto(embed.embedUrl);
  const embedFrame = embedPage.frameLocator('iframe[title="Dashboard"]');
  await expect(embedFrame.getByRole("heading", { name: "Neutral Revenue Overview" })).toBeVisible();
  await expectWriteStatus(embedFrame, 401);
  await embedContext.close();

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin Dashboard" })).toBeVisible();
  await page.getByRole("tab", { name: "Data Sources" }).click();

  await page.getByPlaceholder("Sales export").fill("Neutral sales fixture");
  await page.getByPlaceholder("my-gcs-bucket").fill("neutral-fixtures");
  await page.getByPlaceholder("exports/").fill("fixtures/");
  await page.getByPlaceholder("credential-a").fill("neutral-credential");
  await page.getByPlaceholder("Paste the service account JSON").fill(createLocalFixtureCredential());
  await page.getByRole("button", { name: "Inspect headers" }).click();
  await expect(page.getByText(/Inspected fixtures\/neutral-sales\.csv/)).toBeVisible();
  await expect(page.getByRole("combobox")).toHaveValue("owner_email");
  await page.getByRole("button", { name: "Create source" }).click();
  await expect(page.getByText("Neutral sales fixture", { exact: true })).toBeVisible();
  await expect(page.getByText("owner: owner_email", { exact: true })).toBeVisible();
});

async function authenticatedUid(page: Page): Promise<string> {
  return page.evaluate(() => {
    const token = document.cookie
      .split("; ")
      .find((entry) => entry.startsWith("twd_auth="))
      ?.slice("twd_auth=".length);
    if (!token) throw new Error("Missing authenticated session cookie");
    const encodedPayload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = encodedPayload.padEnd(Math.ceil(encodedPayload.length / 4) * 4, "=");
    const payload = JSON.parse(atob(paddedPayload)) as {
      sub?: string;
    };
    if (!payload.sub) throw new Error("Missing uid in authenticated session");
    return payload.sub;
  });
}

async function provisionActiveAppDatabase(dashboardId: string, ownerUid: string) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required for Playwright");
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(
      `INSERT INTO "AppDbInstance"
        ("id", "dashboardId", "ownerUid", "ownerEmail", "userSchema", "tablePrefix", "status", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, 'active', CURRENT_TIMESTAMP)`,
      [
        randomUUID(),
        dashboardId,
        ownerUid,
        "owner@example.com",
        `e2e_user_${ownerUid.slice(0, 8)}`,
        `e2e_dashboard_${dashboardId.slice(0, 8)}`,
      ],
    );
  } finally {
    await client.end();
  }
}

async function transferDashboardOwnership(dashboardId: string) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID is required for Playwright");
  const adminApp = getApps().find((app) => app.name === "playwright-test")
    ?? initializeApp({ projectId }, "playwright-test");
  await getFirestore(adminApp).collection("dashboards").doc(dashboardId).update({
    createdBy: "different-owner-uid",
  });
}

async function expectWriteStatus(frame: FrameLocator, expectedStatus: number) {
  const status = await frame.locator("body").evaluate(async () => {
    const runtime = window as typeof window & {
      __TWD_DATA_API__?: string;
      __TWD_DATA_TOKEN__?: string;
    };
    const response = await fetch(`${runtime.__TWD_DATA_API__}/missing_table`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${runtime.__TWD_DATA_TOKEN__}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ rows: [{ value: "neutral" }] }),
    });
    return response.status;
  });
  expect(status).toBe(expectedStatus);
}

async function signInWithGoogleEmulator(page: Page, email: string, displayName: string) {
  await page.goto("/login");
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Sign in with Google" }).click();
  const popup = await popupPromise;
  const addAccountButton = popup.locator("#add-account-button");
  const addUserForm = popup.locator("#add-user");
  await expect.poll(async () => {
    if (!(await addUserForm.isVisible())) await addAccountButton.click();
    return addUserForm.isVisible();
  }, {
    message: "Firebase Auth emulator account form becomes interactive",
    timeout: 10_000,
  }).toBe(true);
  await addUserForm.locator("#email-input").fill(email);
  await addUserForm.locator("#display-name-input").fill(displayName);
  await popup.getByRole("button", { name: "Sign in with Google" }).click();
  await popup.waitForEvent("close");
  await page.waitForURL(/\/$/);
}

function createLocalFixtureCredential(): string {
  return JSON.stringify({
    type: "service_account",
    project_id: "demo-talkwithdata",
    client_email: "fixture@demo-talkwithdata.invalid",
    private_key: "local-emulator-placeholder",
  });
}

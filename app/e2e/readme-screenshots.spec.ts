import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const SCREENSHOT_DIR = path.join(process.cwd(), "..", "docs", "screenshots");
const SCREENSHOT_NOW = "2026-07-12T15:00:00.000Z";
const DASHBOARD_FIXTURE = path.join(
  process.cwd(),
  "e2e",
  "fixtures",
  "readme-demo-dashboard.html",
);

test.use({
  viewport: { width: 1440, height: 900 },
  colorScheme: "light",
  deviceScaleFactor: 1,
  locale: "en-US",
  timezoneId: "America/Sao_Paulo",
});

test("captures neutral README product screenshots", async ({ page }) => {
  test.setTimeout(120_000);
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  await page.clock.setFixedTime(new Date(SCREENSHOT_NOW));

  await signInWithGoogleEmulator(page, "owner@example.com", "Demo Owner");
  const ownerUid = await authenticatedUid(page);

  const revenueId = await uploadDashboard(page, "Revenue Pulse");
  const customerId = await uploadDashboard(page, "Customer Growth");
  const operationsId = await uploadDashboard(page, "Operations Health");
  await pinDashboardDates([
    { id: revenueId, isoDate: "2026-07-10T15:00:00.000Z" },
    { id: customerId, isoDate: "2026-07-11T15:00:00.000Z" },
    { id: operationsId, isoDate: "2026-07-12T15:00:00.000Z" },
  ]);

  await page.goto("/");
  await expect(page.getByText("Revenue Pulse", { exact: true })).toBeVisible();
  await expect(page.getByText("Customer Growth", { exact: true })).toBeVisible();
  await expect(page.getByText("Operations Health", { exact: true })).toBeVisible();
  await capture(page, "home-dashboards.png", 560);

  await page.goto(`/view/${revenueId}`);
  await expect(page.getByRole("heading", { name: "Revenue Pulse" })).toBeVisible();
  await expect(
    page.frameLocator('iframe[title="Revenue Pulse"]').getByRole("heading", {
      name: "Revenue Pulse",
    }),
  ).toBeVisible();
  await capture(page, "dashboard-view.png", 680);

  const chatSessionId = await seedChatSession(ownerUid);
  await page.goto("/chat");
  await page.getByText("Quarterly growth drivers", { exact: true }).click();
  await expect(page.getByText("Which regions are driving growth this quarter?")).toBeVisible();
  await expect(page.getByText("Growth is broad-based", { exact: false })).toBeVisible();
  await expect(page.getByText("query_dataset", { exact: true })).toBeVisible();
  await capture(page, "ai-data-chat.png");

  await createNeutralDataSource(page);
  await page.getByText("CSV Data Sources", { exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByText("Neutral revenue export", { exact: true })).toBeVisible();
  await capture(page, "data-sources-admin.png", 330);

  const embedUrl = await page.evaluate(async (dashboardId) => {
    const response = await fetch(`/api/dashboards/${dashboardId}/embed-token`, {
      method: "POST",
    });
    if (!response.ok) throw new Error(`embed token failed: ${response.status}`);
    const body = await response.json() as { embedUrl: string };
    return body.embedUrl;
  }, revenueId);

  await page.goto(embedUrl);
  await expect(
    page.frameLocator('iframe[title="Dashboard"]').getByRole("heading", {
      name: "Revenue Pulse",
    }),
  ).toBeVisible();
  await capture(page, "embed-view.png", 650);

  await deleteChatSession(chatSessionId);
});

async function uploadDashboard(page: Page, title: string): Promise<string> {
  await page.goto("/upload");
  await page.locator('input[type="file"]').setInputFiles(DASHBOARD_FIXTURE);
  await page.getByLabel("Title").fill(title);
  const responsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/upload") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Upload Dashboard" }).click();
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  const body = await response.json() as { id: string };
  await page.waitForURL(/\/$/);
  return body.id;
}

async function createNeutralDataSource(page: Page) {
  await page.goto("/admin");
  await page.getByRole("tab", { name: "Data Sources" }).click();
  await page.getByPlaceholder("Sales export").fill("Neutral revenue export");
  await page.getByPlaceholder("my-gcs-bucket").fill("neutral-fixtures");
  await page.getByPlaceholder("exports/").fill("fixtures/");
  await page.getByPlaceholder("credential-a").fill("neutral-readonly-credential");
  await page.getByPlaceholder("Paste the service account JSON").fill(
    JSON.stringify({
      type: "service_account",
      project_id: "demo-talkwithdata",
      client_email: "fixture@demo-talkwithdata.invalid",
      private_key: "local-emulator-placeholder",
    }),
  );
  await page.getByRole("button", { name: "Inspect headers" }).click();
  await expect(page.getByText(/Inspected fixtures\/neutral-sales\.csv/)).toBeVisible();
  await page.getByRole("button", { name: "Create source" }).click();
  await expect(page.getByText("Neutral revenue export", { exact: true })).toBeVisible();
}

async function seedChatSession(ownerUid: string): Promise<string> {
  const now = SCREENSHOT_NOW;
  const ref = screenshotFirestore().collection("chat_sessions").doc();
  await ref.set({
    userId: ownerUid,
    title: "Quarterly growth drivers",
    messages: [
      {
        role: "user",
        content: "Which regions are driving growth this quarter?",
        timestamp: now,
      },
      {
        role: "assistant",
        content:
          "## Growth is broad-based\n\nNorth leads with **$812K** in revenue, while West shows the fastest quarter-over-quarter acceleration at **14.2%**. Retention remains above 94% across every region.\n\nThe pattern supports continued investment in the two leading regions without reducing coverage elsewhere.",
        toolCalls: [{ name: "query_dataset", status: "done" }],
        timestamp: now,
      },
    ],
    mcpServerIds: [],
    selectedMcpIds: [],
    usedTools: [{ tool: "query_dataset", args: { metric: "regional_growth" } }],
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

async function deleteChatSession(id: string) {
  await screenshotFirestore().collection("chat_sessions").doc(id).delete();
}

async function pinDashboardDates(
  dashboards: Array<{ id: string; isoDate: string }>,
) {
  await Promise.all(
    dashboards.map(({ id, isoDate }) => {
      const timestamp = Timestamp.fromDate(new Date(isoDate));
      return screenshotFirestore().collection("dashboards").doc(id).update({
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }),
  );
}

function screenshotFirestore() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID is required for screenshots");
  const app = getApps().find((candidate) => candidate.name === "readme-screenshots")
    ?? initializeApp({ projectId }, "readme-screenshots");
  return getFirestore(app);
}

async function capture(page: Page, fileName: string, height = 900) {
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((portal) => portal.remove());
  });
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, fileName),
    clip: { x: 0, y: 0, width: 1440, height },
    animations: "disabled",
  });
}

async function authenticatedUid(page: Page): Promise<string> {
  return page.evaluate(() => {
    const token = document.cookie
      .split("; ")
      .find((entry) => entry.startsWith("twd_auth="))
      ?.slice("twd_auth=".length);
    if (!token) throw new Error("Missing authenticated session cookie");
    const encodedPayload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = encodedPayload.padEnd(Math.ceil(encodedPayload.length / 4) * 4, "=");
    const payload = JSON.parse(atob(paddedPayload)) as { sub?: string };
    if (!payload.sub) throw new Error("Missing uid in authenticated session");
    return payload.sub;
  });
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

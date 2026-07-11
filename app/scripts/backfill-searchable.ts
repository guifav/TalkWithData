#!/usr/bin/env npx tsx
/**
 * Backfill searchableText + category for existing dashboards.
 *
 * Dashboards created before the searchableText field was introduced
 * don't appear in search results. This script:
 * 1. Lists all dashboard docs in Firestore
 * 2. Finds those missing searchableText or category
 * 3. Downloads HTML from the configured dashboard storage provider
 * 4. Extracts text via the same logic used in the upload route
 * 5. Updates the Firestore doc
 *
 * Usage:
 *   SA_KEY_JSON='...' npx tsx scripts/backfill-searchable.ts
 *   SA_KEY_JSON='...' npx tsx scripts/backfill-searchable.ts --dry-run
 *
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getHtmlFile } from "../src/lib/storage";
import { getStorageProvider } from "../src/lib/storage-provider";

// ── Config ──────────────────────────────────────────────────────────────────

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "";
const MAX_SEARCHABLE_TEXT = 100_000;
const DEFAULT_CATEGORY = "Other";
const DRY_RUN = process.argv.includes("--dry-run");

// ── Firebase init ───────────────────────────────────────────────────────────

function initAdmin() {
  if (getApps().length > 0) return;

  const saJson = process.env.SA_KEY_JSON;
  if (!saJson || !PROJECT_ID) {
    console.error("SA_KEY_JSON and FIREBASE_PROJECT_ID env vars are required");
    process.exit(1);
  }

  initializeApp({
    credential: cert(JSON.parse(saJson)),
    projectId: PROJECT_ID,
  });
}

// ── Text extraction (same as lib/html-text.ts) ─────────────────────────────

function extractTextFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  initAdmin();

  const db = getFirestore();
  getStorageProvider();

  console.log(`Backfill searchableText + category${DRY_RUN ? " (DRY RUN)" : ""}`);
  console.log("─".repeat(60));

  // Fetch all dashboards
  const snap = await db.collection("dashboards").get();
  console.log(`Total dashboards: ${snap.size}`);

  let needsBackfill = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const id = doc.id;
    const title = data.title || "(untitled)";

    const missingText =
      !data.searchableText || data.searchableText.trim() === "";
    const missingCategory = !data.category || data.category.trim() === "";

    if (!missingText && !missingCategory) {
      continue; // already has both fields
    }

    needsBackfill++;
    const storagePath: string | undefined = data.storagePath;
    const updates: Record<string, unknown> = {};

    // Category backfill is independent of HTML download
    if (missingCategory) {
      updates.category = DEFAULT_CATEGORY;
    }

    // Text backfill requires downloading HTML from dashboard storage
    if (missingText) {
      if (!storagePath) {
        console.log(`  WARN ${id} "${title}": no storagePath, skipping text extraction`);
      } else {
        try {
          const contents = await getHtmlFile(storagePath);
          const html = contents.toString("utf-8");
          const searchableText = extractTextFromHtml(html).slice(
            0,
            MAX_SEARCHABLE_TEXT
          );
          updates.searchableText = searchableText;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.warn(`  WARN ${id} "${title}": text extraction failed: ${msg}`);
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      skipped++;
      continue;
    }

    try {
      if (DRY_RUN) {
        const fields = Object.keys(updates).join(", ");
        const textLen = updates.searchableText
          ? ` (${(updates.searchableText as string).length} chars)`
          : "";
        console.log(`  DRY RUN ${id} "${title}": would set: ${fields}${textLen}`);
      } else {
        await doc.ref.update(updates);
        const fields = Object.keys(updates).join(", ");
        const textLen = updates.searchableText
          ? ` (${(updates.searchableText as string).length} chars)`
          : "";
        console.log(`  OK ${id} "${title}": updated: ${fields}${textLen}`);
      }

      updated++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ERROR ${id} "${title}": ${msg}`);
      errors++;
    }
  }

  console.log("─".repeat(60));
  console.log(`Needs backfill: ${needsBackfill}`);
  console.log(`${DRY_RUN ? "Would update" : "Updated"}: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

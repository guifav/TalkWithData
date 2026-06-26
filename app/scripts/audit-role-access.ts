#!/usr/bin/env npx tsx
/**
 * Audit and optionally apply the issue #155 role migration.
 *
 * Usage:
 *   SA_KEY_JSON='...' npm run audit:roles -- --dry-run
 *   SA_KEY_JSON='...' npm run audit:roles -- --apply --confirm-issue-155
 */

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { buildIssue155RolePlan } from "../src/lib/role-access-plan";

const PROJECT_ID = "gri-dashs";
const APPLY = process.argv.includes("--apply");
const CONFIRMED = process.argv.includes("--confirm-issue-155");

function initAdmin() {
  if (getApps().length > 0) return;

  const saJson = process.env.SA_KEY_JSON;
  if (!saJson) {
    console.error("SA_KEY_JSON env var is required");
    process.exit(1);
  }

  initializeApp({
    credential: cert(JSON.parse(saJson)),
    projectId: PROJECT_ID,
  });
}

async function applyChanges(db: Firestore, changes: ReturnType<typeof buildIssue155RolePlan>["changes"]) {
  const batchSize = 450;
  for (let i = 0; i < changes.length; i += batchSize) {
    const batch = db.batch();
    for (const change of changes.slice(i, i + batchSize)) {
      batch.update(db.collection("users").doc(change.uid), {
        role: change.plannedRole,
      });
    }
    await batch.commit();
  }
}

async function main() {
  if (APPLY && !CONFIRMED) {
    console.error("Refusing to apply without --confirm-issue-155");
    process.exit(1);
  }

  initAdmin();
  const db = getFirestore();
  const snap = await db.collection("users").get();
  const users = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      uid: doc.id,
      email: data.email,
      displayName: data.displayName,
      role: data.role,
    };
  });

  const plan = buildIssue155RolePlan(users);
  const mode = APPLY ? "APPLY" : "DRY RUN";

  console.log(`Issue #155 role audit (${mode})`);
  console.log("-".repeat(60));
  console.log(`Policy: ${plan.policy}`);
  console.log(`Total users: ${plan.summary.totalUsers}`);
  console.log(`Before: ${JSON.stringify(plan.summary.before)}`);
  console.log(`After:  ${JSON.stringify(plan.summary.after)}`);
  console.log(`Planned changes: ${plan.summary.changeCount}`);

  for (const change of plan.changes) {
    console.log(
      [
        change.uid,
        change.email,
        `${change.currentRole ?? "(missing)"} -> ${change.plannedRole}`,
        change.reason,
      ].join(" | ")
    );
  }

  if (APPLY) {
    await applyChanges(db, plan.changes);
    console.log(`Applied role updates: ${plan.changes.length}`);
  } else {
    console.log("No writes performed. Re-run with --apply --confirm-issue-155 to update Firestore.");
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

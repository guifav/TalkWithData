import { adminDb } from "@/lib/firebase/admin";
import {
  migrateLegacyUserAiConfig,
  planLegacyAiConfigMigration,
  requireConfiguredAiConfigEncryptionKey,
} from "@/lib/ai-config-secrets";

interface MigrationCounts {
  examined: number;
  migrated: number;
  skippedNoLegacyKey: number;
  skippedInvalidConfig: number;
  scrubbedSecretMaterial: number;
  clearedInvalidConfig: number;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const counts: MigrationCounts = {
    examined: 0,
    migrated: 0,
    skippedNoLegacyKey: 0,
    skippedInvalidConfig: 0,
    scrubbedSecretMaterial: 0,
    clearedInvalidConfig: 0,
  };

  requireConfiguredAiConfigEncryptionKey();

  const snap = await adminDb.collection("users").get();

  for (const doc of snap.docs) {
    counts.examined += 1;
    const status = dryRun
      ? planLegacyAiConfigMigration(doc.data().aiConfig).status
      : await migrateLegacyUserAiConfig(doc.id);

    if (status === "skippedNoLegacyKey") {
      counts.skippedNoLegacyKey += 1;
      continue;
    }

    if (status === "clearedInvalidConfig") {
      counts.clearedInvalidConfig += 1;
      counts.skippedInvalidConfig += 1;
      continue;
    }

    if (status === "migrated") {
      counts.migrated += 1;
    } else {
      counts.scrubbedSecretMaterial += 1;
    }
  }

  console.log(JSON.stringify({ dryRun, ...counts }));
}

main().catch((error) => {
  console.error("AI config secret migration failed:", error instanceof Error ? error.message : "unknown error");
  process.exit(1);
});

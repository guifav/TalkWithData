import { adminDb } from "@/lib/firebase/admin";
import {
  isValidStoredConfig,
  setUserAiConfigApiKey,
  toStoredAiConfig,
  type StoredAiConfig,
} from "@/lib/ai-config-secrets";
import type { AiModelConfig } from "@/lib/ai-model";

interface MigrationCounts {
  examined: number;
  migrated: number;
  skippedNoLegacyKey: number;
  skippedInvalidConfig: number;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const counts: MigrationCounts = {
    examined: 0,
    migrated: 0,
    skippedNoLegacyKey: 0,
    skippedInvalidConfig: 0,
  };

  const snap = await adminDb.collection("users").get();

  for (const doc of snap.docs) {
    counts.examined += 1;
    const aiConfig = doc.data().aiConfig as AiModelConfig | undefined;

    if (!aiConfig?.apiKey?.trim()) {
      counts.skippedNoLegacyKey += 1;
      continue;
    }

    const storedConfig: StoredAiConfig = toStoredAiConfig(aiConfig, true);
    if (!isValidStoredConfig(storedConfig)) {
      counts.skippedInvalidConfig += 1;
      continue;
    }

    if (!dryRun) {
      await setUserAiConfigApiKey(doc.id, aiConfig.apiKey);
      await doc.ref.update({ aiConfig: storedConfig });
    }

    counts.migrated += 1;
  }

  console.log(JSON.stringify({ dryRun, ...counts }));
}

main().catch((error) => {
  console.error("AI config secret migration failed:", error instanceof Error ? error.message : "unknown error");
  process.exit(1);
});

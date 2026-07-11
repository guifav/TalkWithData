import { adminDb } from "@/lib/firebase/admin";
import {
  isValidStoredConfig,
  requireConfiguredAiConfigEncryptionKey,
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
    const aiConfig = doc.data().aiConfig as AiModelConfig | undefined;

    if (!hasLegacySecretMaterial(aiConfig)) {
      counts.skippedNoLegacyKey += 1;
      continue;
    }

    const legacyApiKey = aiConfig?.apiKey?.trim();
    const storedConfig = safeStoredConfig(aiConfig, Boolean(legacyApiKey));
    if (!storedConfig || !isValidStoredConfig(storedConfig)) {
      if (!dryRun) {
        await doc.ref.update({ aiConfig: null });
      }
      counts.clearedInvalidConfig += 1;
      counts.skippedInvalidConfig += 1;
      continue;
    }

    if (!dryRun) {
      if (legacyApiKey) {
        await setUserAiConfigApiKey(doc.id, legacyApiKey);
      }
      await doc.ref.update({ aiConfig: storedConfig });
    }

    if (legacyApiKey) {
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

function hasLegacySecretMaterial(config: unknown): config is AiModelConfig {
  if (!config || typeof config !== "object") return false;
  return (
    "apiKey" in config ||
    "apiKeyEnc" in config ||
    "credentialEnc" in config
  );
}

function safeStoredConfig(
  config: AiModelConfig,
  apiKeyConfigured: boolean,
): StoredAiConfig | null {
  try {
    return toStoredAiConfig(config, apiKeyConfigured);
  } catch {
    return null;
  }
}

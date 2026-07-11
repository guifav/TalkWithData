import { adminDb } from "@/lib/firebase/admin";
import {
  isValidStoredConfig,
  migrateLegacyUserAiConfig,
  requireConfiguredAiConfigEncryptionKey,
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

    const legacyApiKey = legacyApiKeyFrom(aiConfig);
    const legacyCustomApiKey = aiConfig?.provider === "custom" ? legacyApiKey : null;
    const storedConfig = safeStoredConfig(aiConfig, Boolean(legacyCustomApiKey));
    if (!storedConfig || !isValidStoredConfig(storedConfig)) {
      if (!dryRun) {
        await migrateLegacyUserAiConfig(doc.id, null, null);
      }
      counts.clearedInvalidConfig += 1;
      counts.skippedInvalidConfig += 1;
      continue;
    }

    if (!dryRun) {
      await migrateLegacyUserAiConfig(doc.id, storedConfig, legacyCustomApiKey);
    }

    if (legacyCustomApiKey) {
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

function legacyApiKeyFrom(config: AiModelConfig | undefined): string | null {
  if (typeof config?.apiKey !== "string") return null;

  return config.apiKey.trim() || null;
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

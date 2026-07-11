import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { adminDb } from "@/lib/firebase/admin";
import {
  SUPPORTED_MODELS,
  isAiProvider,
  type AiProvider,
} from "@/lib/ai-provider-metadata";
import type { AiModelConfig } from "@/lib/ai-model";

const COLLECTION = "ai_config_secrets";
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const KEY_ENV = "TWD_AI_CONFIG_ENC_KEY";

export const DEV_AI_CONFIG_ENC_KEY = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";

export type StoredAiConfig = Omit<AiModelConfig, "apiKey"> & {
  apiKeyConfigured?: boolean;
};

export type LegacyAiConfigMigrationStatus =
  | "skippedNoLegacyKey"
  | "migrated"
  | "scrubbedSecretMaterial"
  | "clearedInvalidConfig";

export class AiConfigSecretError extends Error {
  constructor(message: string, readonly status = 500) {
    super(message);
    this.name = "AiConfigSecretError";
    Object.setPrototypeOf(this, AiConfigSecretError.prototype);
  }
}

export class AiConfigValidationError extends AiConfigSecretError {
  constructor(message: string) {
    super(message, 400);
    this.name = "AiConfigValidationError";
    Object.setPrototypeOf(this, AiConfigValidationError.prototype);
  }
}

export class AiConfigUserNotFoundError extends AiConfigSecretError {
  constructor() {
    super("User not found", 404);
    this.name = "AiConfigUserNotFoundError";
    Object.setPrototypeOf(this, AiConfigUserNotFoundError.prototype);
  }
}

export function toStoredAiConfig(config: AiModelConfig, apiKeyConfigured = false): StoredAiConfig {
  const model = trimmedRequiredString(config.model, "model");
  const baseUrl = trimmedOptionalString(config.baseUrl, "baseUrl");

  return {
    provider: config.provider,
    model,
    baseUrl,
    ...(apiKeyConfigured ? { apiKeyConfigured: true } : {}),
  };
}

export async function updateUserAiConfig(
  uid: string,
  aiConfig: AiModelConfig | null,
  options: { keepExistingApiKey?: boolean } = {},
): Promise<StoredAiConfig | null> {
  const normalizedUid = uid.trim();
  if (!normalizedUid) {
    throw new AiConfigValidationError("uid is required");
  }

  const userRef = adminDb.collection("users").doc(normalizedUid);
  const secretRef = adminDb.collection(COLLECTION).doc(normalizedUid);

  return adminDb.runTransaction(async (tx) => {
    const userDoc = await tx.get(userRef);
    if (!userDoc.exists) {
      throw new AiConfigUserNotFoundError();
    }

    if (aiConfig === null) {
      tx.update(userRef, { aiConfig: null });
      tx.delete(secretRef);
      return null;
    }

    const existingConfig = userDoc.data()?.aiConfig as AiModelConfig | undefined;
    const incomingApiKey = trimmedOptionalString(aiConfig.apiKey, "apiKey");
    const existingLegacyApiKey = legacyApiKeyFrom(existingConfig);
    const configToStore = toStoredAiConfig(aiConfig);

    if (!isValidStoredConfig(configToStore)) {
      throw new AiConfigValidationError(
        "Invalid AI config. Select a supported provider/model. Custom requires baseUrl and model.",
      );
    }

    if (configToStore.provider === "custom") {
      const secretDoc = await tx.get(secretRef);
      const hasEncryptedKey = secretDoc.exists &&
        typeof secretDoc.data()?.apiKeyEnc === "string" &&
        Boolean(secretDoc.data()?.apiKeyEnc?.trim());

      if (incomingApiKey) {
        tx.set(secretRef, encryptedSecretPayload(incomingApiKey), { merge: true });
      } else if (options.keepExistingApiKey && hasEncryptedKey) {
        // Existing encrypted key stays in place.
      } else if (options.keepExistingApiKey && existingConfig?.provider === "custom" && existingLegacyApiKey) {
        tx.set(secretRef, encryptedSecretPayload(existingLegacyApiKey), { merge: true });
      } else {
        throw new AiConfigValidationError("Custom AI provider requires an apiKey.");
      }

      configToStore.apiKeyConfigured = true;
    } else {
      tx.delete(secretRef);
      delete configToStore.apiKeyConfigured;
      delete configToStore.baseUrl;
    }

    tx.update(userRef, { aiConfig: configToStore });
    return configToStore;
  });
}

export async function migrateLegacyUserAiConfig(
  uid: string,
): Promise<LegacyAiConfigMigrationStatus> {
  const normalizedUid = uid.trim();
  if (!normalizedUid) {
    throw new AiConfigValidationError("uid is required");
  }

  const userRef = adminDb.collection("users").doc(normalizedUid);
  const secretRef = adminDb.collection(COLLECTION).doc(normalizedUid);

  return adminDb.runTransaction(async (tx) => {
    const userDoc = await tx.get(userRef);
    if (!userDoc.exists) {
      throw new AiConfigUserNotFoundError();
    }

    const plan = planLegacyAiConfigMigration(userDoc.data()?.aiConfig);
    if (plan.status === "skippedNoLegacyKey") {
      return plan.status;
    }

    if (plan.status === "clearedInvalidConfig") {
      tx.update(userRef, { aiConfig: null });
      tx.delete(secretRef);
      return plan.status;
    }

    const { storedConfig, legacyCustomApiKey } = plan;
    if (!isValidStoredConfig(storedConfig)) {
      throw new AiConfigValidationError(
        "Invalid AI config. Select a supported provider/model. Custom requires baseUrl and model.",
      );
    }

    const configToStore: StoredAiConfig = { ...storedConfig };
    const apiKey = legacyCustomApiKey?.trim() || null;

    if (configToStore.provider === "custom" && apiKey) {
      tx.set(secretRef, encryptedSecretPayload(apiKey), { merge: true });
      configToStore.apiKeyConfigured = true;
    } else {
      tx.delete(secretRef);
      delete configToStore.apiKeyConfigured;
    }

    if (configToStore.provider !== "custom") {
      delete configToStore.baseUrl;
    }

    tx.update(userRef, { aiConfig: configToStore });
    return plan.status;
  });
}

export async function getUserAiConfigApiKey(uid: string): Promise<string | null> {
  const doc = await adminDb.collection(COLLECTION).doc(uid).get();
  if (!doc.exists) return null;

  const apiKeyEnc = doc.data()?.apiKeyEnc;
  if (typeof apiKeyEnc !== "string" || !apiKeyEnc.trim()) return null;

  return decryptApiKey(apiKeyEnc);
}

export async function hasUserAiConfigApiKey(uid: string): Promise<boolean> {
  const doc = await adminDb.collection(COLLECTION).doc(uid).get();
  return doc.exists && typeof doc.data()?.apiKeyEnc === "string";
}

export async function setUserAiConfigApiKey(uid: string, apiKey: string): Promise<void> {
  await adminDb.collection(COLLECTION).doc(uid).set(encryptedSecretPayload(apiKey), { merge: true });
}

export async function deleteUserAiConfigApiKey(uid: string): Promise<void> {
  await adminDb.collection(COLLECTION).doc(uid).delete();
}

export function encryptApiKey(apiKey: string, encryptionKeyBase64?: string): string {
  const key = getEncryptionKey(encryptionKeyBase64);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(apiKey, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function requireConfiguredAiConfigEncryptionKey(): void {
  getEncryptionKey(process.env[KEY_ENV], { allowDevFallback: false });
}

export function decryptApiKey(apiKeyEnc: string, encryptionKeyBase64?: string): string {
  const blob = Buffer.from(apiKeyEnc, "base64");
  if (blob.length <= IV_BYTES + AUTH_TAG_BYTES) {
    throw new AiConfigSecretError("Invalid AI config secret");
  }

  const key = getEncryptionKey(encryptionKeyBase64);
  const iv = blob.subarray(0, IV_BYTES);
  const authTag = blob.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
  const ciphertext = blob.subarray(IV_BYTES + AUTH_TAG_BYTES);

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new AiConfigSecretError("Failed to decrypt AI config secret");
  }
}

function encryptedSecretPayload(apiKey: string): { apiKeyEnc: string; updatedAt: string } {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    throw new AiConfigValidationError("Custom AI provider requires an apiKey.");
  }

  return {
    apiKeyEnc: encryptApiKey(trimmed),
    updatedAt: new Date().toISOString(),
  };
}

export function planLegacyAiConfigMigration(config: unknown): {
  status: LegacyAiConfigMigrationStatus;
  storedConfig?: StoredAiConfig;
  legacyCustomApiKey?: string | null;
} {
  if (!hasLegacyAiConfigSecretMaterial(config)) {
    return { status: "skippedNoLegacyKey" };
  }

  const aiConfig = config as AiModelConfig;
  const legacyApiKey = legacyApiKeyFrom(aiConfig);
  const legacyCustomApiKey = aiConfig.provider === "custom" ? legacyApiKey : null;
  const storedConfig = safeStoredConfig(aiConfig, Boolean(legacyCustomApiKey));

  if (!storedConfig || !isValidStoredConfig(storedConfig)) {
    return { status: "clearedInvalidConfig" };
  }

  return {
    status: legacyCustomApiKey ? "migrated" : "scrubbedSecretMaterial",
    storedConfig,
    legacyCustomApiKey,
  };
}

function hasLegacyAiConfigSecretMaterial(config: unknown): boolean {
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

function trimmedRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string") {
    throw new AiConfigValidationError(`${fieldName} must be a string`);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new AiConfigValidationError(`${fieldName} is required`);
  }

  return trimmed;
}

function trimmedOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new AiConfigValidationError(`${fieldName} must be a string`);
  }

  return value.trim() || undefined;
}

function getEncryptionKey(
  explicitKeyBase64: string | undefined,
  options: { allowDevFallback?: boolean } = {},
): Buffer {
  const keyBase64 = explicitKeyBase64 ?? process.env[KEY_ENV];

  if (!keyBase64) {
    if (process.env.NODE_ENV === "production" || options.allowDevFallback === false) {
      throw new AiConfigSecretError(`${KEY_ENV} is required in production`);
    }

    return Buffer.from(DEV_AI_CONFIG_ENC_KEY, "base64");
  }

  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) {
    throw new AiConfigSecretError(`${KEY_ENV} must be 32 bytes in base64`);
  }

  return key;
}

export function isValidStoredConfig(config: unknown): config is StoredAiConfig {
  if (!config || typeof config !== "object") return false;
  const c = config as Record<string, unknown>;
  if (!isAiProvider(c.provider)) return false;
  if (typeof c.model !== "string" || !c.model.trim()) return false;

  const provider = c.provider as AiProvider;
  if (provider !== "custom" && !SUPPORTED_MODELS[provider].includes(c.model)) {
    return false;
  }

  if (c.apiKeyConfigured !== undefined && typeof c.apiKeyConfigured !== "boolean") return false;
  if (c.baseUrl !== undefined && typeof c.baseUrl !== "string") return false;
  if (provider === "custom" && !c.baseUrl?.toString().trim()) return false;

  return true;
}

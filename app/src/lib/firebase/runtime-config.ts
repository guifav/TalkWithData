export interface FirebasePublicConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export const FIREBASE_PUBLIC_ENV_KEYS = {
  apiKey: "NEXT_PUBLIC_FIREBASE_API_KEY",
  authDomain: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  projectId: "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  storageBucket: "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId: "NEXT_PUBLIC_FIREBASE_APP_ID",
} as const satisfies Record<keyof FirebasePublicConfig, string>;

declare global {
  interface Window {
    __TWD_FIREBASE_CONFIG__?: unknown;
  }
}

const FIREBASE_PUBLIC_FIELDS = Object.keys(
  FIREBASE_PUBLIC_ENV_KEYS,
) as Array<keyof FirebasePublicConfig>;

export function parseFirebasePublicConfig(input: unknown): FirebasePublicConfig {
  const source = input && typeof input === "object"
    ? input as Record<string, unknown>
    : {};
  const config = {} as FirebasePublicConfig;
  const invalidFields: string[] = [];

  for (const field of FIREBASE_PUBLIC_FIELDS) {
    const value = source[field];
    if (typeof value !== "string" || !value.trim()) {
      invalidFields.push(field);
      continue;
    }
    config[field] = value.trim();
  }

  if (invalidFields.length > 0) {
    throw new Error(
      `Invalid public Firebase configuration: missing or invalid ${invalidFields.join(", ")}`,
    );
  }

  return config;
}

export function getFirebasePublicConfig(): FirebasePublicConfig {
  if (typeof window !== "undefined") {
    if (!window.__TWD_FIREBASE_CONFIG__) {
      throw new Error("Firebase runtime configuration is missing");
    }
    return parseFirebasePublicConfig(window.__TWD_FIREBASE_CONFIG__);
  }

  const serverInput = Object.fromEntries(
    Object.entries(FIREBASE_PUBLIC_ENV_KEYS).map(([field, envName]) => [
      field,
      process.env[envName],
    ]),
  );
  return parseFirebasePublicConfig(serverInput);
}

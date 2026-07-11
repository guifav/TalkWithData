import {
  FIREBASE_PUBLIC_ENV_KEYS,
  type FirebasePublicConfig,
  parseFirebasePublicConfig,
} from "@/lib/firebase/runtime-config";

export function readFirebasePublicConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): FirebasePublicConfig {
  const input = Object.fromEntries(
    Object.entries(FIREBASE_PUBLIC_ENV_KEYS).map(([field, envName]) => [
      field,
      env[envName],
    ]),
  );

  const config = parseFirebasePublicConfig(input);
  const serverDomain = env.ALLOWED_AUTH_DOMAIN?.trim();
  if (!serverDomain) {
    throw new Error(
      "Invalid server authentication configuration: missing ALLOWED_AUTH_DOMAIN",
    );
  }
  if (serverDomain !== config.allowedAuthDomain) {
    throw new Error(
      "ALLOWED_AUTH_DOMAIN and NEXT_PUBLIC_ALLOWED_AUTH_DOMAIN must match",
    );
  }

  return config;
}

export function serializeFirebaseRuntimeConfig(
  config: FirebasePublicConfig,
): string {
  return JSON.stringify(config).replace(
    /[<>&\u2028\u2029]/gu,
    (character) =>
      `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`,
  );
}

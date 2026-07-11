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

  return parseFirebasePublicConfig(input);
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

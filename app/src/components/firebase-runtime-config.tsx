import {
  readFirebasePublicConfig,
  serializeFirebaseRuntimeConfig,
} from "@/lib/firebase/runtime-config.server";

export function FirebaseRuntimeConfig() {
  const config = readFirebasePublicConfig();
  const serializedConfig = serializeFirebaseRuntimeConfig(config);

  return (
    <script
      id="twd-firebase-runtime-config"
      dangerouslySetInnerHTML={{
        __html: `window.__TWD_FIREBASE_CONFIG__ = ${serializedConfig};`,
      }}
    />
  );
}

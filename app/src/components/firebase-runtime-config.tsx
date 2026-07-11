import { connection } from "next/server";

import {
  readFirebasePublicConfig,
  serializeFirebaseRuntimeConfig,
} from "@/lib/firebase/runtime-config.server";

export async function FirebaseRuntimeConfig() {
  await connection();
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

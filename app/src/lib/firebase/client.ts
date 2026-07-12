import { initializeApp, getApps, getApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import {
  getFirebasePublicConfig,
  toFirebaseClientOptions,
} from "@/lib/firebase/runtime-config";
import { parseFirebaseEmulatorConfig } from "@/lib/firebase/emulator-config";

const firebaseConfig = toFirebaseClientOptions(getFirebasePublicConfig());

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const emulatorConfig = parseFirebaseEmulatorConfig({
  authHost: process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST,
  firestoreHost: process.env.NEXT_PUBLIC_FIRESTORE_EMULATOR_HOST,
});

const emulatorState = globalThis as typeof globalThis & {
  __TWD_FIREBASE_EMULATORS_CONNECTED__?: boolean;
};

if (emulatorConfig && !emulatorState.__TWD_FIREBASE_EMULATORS_CONNECTED__) {
  if (emulatorConfig.authUrl) {
    connectAuthEmulator(auth, emulatorConfig.authUrl, { disableWarnings: true });
  }
  if (emulatorConfig.firestore) {
    connectFirestoreEmulator(
      db,
      emulatorConfig.firestore.host,
      emulatorConfig.firestore.port,
    );
  }
  emulatorState.__TWD_FIREBASE_EMULATORS_CONNECTED__ = true;
}
export default app;

import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFirebasePublicConfig } from "@/lib/firebase/runtime-config";

const { allowedAuthDomain: _allowedAuthDomain, ...firebaseConfig } =
  getFirebasePublicConfig();

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;

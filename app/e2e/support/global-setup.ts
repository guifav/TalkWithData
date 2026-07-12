import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export default async function globalSetup() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
  if (!projectId || !firestoreHost) {
    throw new Error("Firebase emulators must be active before Playwright starts");
  }

  const app = initializeApp({ projectId }, "playwright-global-setup");
  await getFirestore(app)
    .collection("pendingRoles")
    .doc("owner_at_example_com")
    .set({ role: "superadmin" });
}

import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";

function initApp(): App {
  if (getApps().length > 0) return getApps()[0];

  const saJson = process.env.SA_KEY_JSON;
  if (saJson) {
    try {
      return initializeApp({
        credential: cert(JSON.parse(saJson)),
        projectId: "gri-dashs",
        storageBucket: "gri-dashs-uploads",
      });
    } catch (e) {
      console.error("Failed to init with SA_KEY_JSON:", e);
    }
  }

  // GCP default credentials (Cloud Run)
  return initializeApp({
    projectId: "gri-dashs",
    storageBucket: "gri-dashs-uploads",
  });
}

const isBuild = process.env.NEXT_PHASE === "phase-production-build";

let _adminDb: ReturnType<typeof getFirestore> | null = null;
let _adminAuth: ReturnType<typeof getAuth> | null = null;
let _adminStorage: ReturnType<typeof getStorage> | null = null;

function getAdminApp(): App {
  return initApp();
}

function createLazyProxy<T extends object>(
  serviceName: string,
  getService: () => T
): T {
  return new Proxy({} as T, {
    get(_, prop, receiver) {
      if (isBuild) throw new Error(`Cannot use ${serviceName} during build`);
      return Reflect.get(getService() as object, prop, receiver);
    },
  });
}

export const adminDb = createLazyProxy("adminDb", () => {
  if (!_adminDb) _adminDb = getFirestore(getAdminApp());
  return _adminDb;
});

export const adminAuth = createLazyProxy("adminAuth", () => {
  if (!_adminAuth) _adminAuth = getAuth(getAdminApp());
  return _adminAuth;
});

export const adminStorage = createLazyProxy("adminStorage", () => {
  if (!_adminStorage) _adminStorage = getStorage(getAdminApp());
  return _adminStorage;
});

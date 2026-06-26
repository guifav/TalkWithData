import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  onIdTokenChanged,
  User as FirebaseUser,
} from "firebase/auth";
import { auth } from "./client";

const ALLOWED_DOMAIN = "example.com";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  hd: ALLOWED_DOMAIN,
});

export async function signInWithGoogle(): Promise<FirebaseUser> {
  const result = await signInWithPopup(auth, googleProvider);
  const email = result.user.email;

  if (!email || !email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    await firebaseSignOut(auth);
    throw new Error(`Access restricted to @${ALLOWED_DOMAIN} accounts.`);
  }

  return result.user;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export function onAuthChange(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export function onIdTokenChange(callback: (user: FirebaseUser | null) => void) {
  return onIdTokenChanged(auth, callback);
}

let _authReady: Promise<FirebaseUser | null> | null = null;
function waitForAuth(): Promise<FirebaseUser | null> {
  if (!_authReady) {
    _authReady = new Promise((resolve) => {
      if (auth.currentUser) {
        resolve(auth.currentUser);
        return;
      }
      const unsub = onAuthStateChanged(auth, (user) => {
        unsub();
        resolve(user);
      });
    });
  }
  return _authReady;
}

export async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser ?? (await waitForAuth());
  if (!user) return null;
  return user.getIdToken();
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getIdToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function authFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const headers = await getAuthHeaders();
  const merged = new Headers(init?.headers);
  for (const [k, v] of Object.entries(headers)) {
    if (!merged.has(k)) merged.set(k, v);
  }
  return fetch(input, { ...init, headers: merged });
}

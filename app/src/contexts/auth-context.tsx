"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { User as FirebaseUser } from "firebase/auth";
import {
  onAuthChange,
  onIdTokenChange,
  authFetch,
} from "@/lib/firebase/auth";
import { createOrUpdateUser } from "@/lib/firestore/users";

interface AuthContextType {
  firebaseUser: FirebaseUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  firebaseUser: null,
  loading: true,
});

const AUTH_COOKIE_NAME = "twd_auth";

function setAuthTokenCookie(token: string | null) {
  if (typeof document === "undefined") return;

  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  if (!token) {
    document.cookie = `${AUTH_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Strict${secure}`;
    return;
  }

  document.cookie = `${AUTH_COOKIE_NAME}=${token}; Path=/; Max-Age=3600; SameSite=Strict${secure}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthChange(async (fbUser) => {
      setFirebaseUser(fbUser);

      if (fbUser) {
        // Create/update user doc (without role — blocked by Firestore rules)
        await createOrUpdateUser(fbUser.uid, {
          email: fbUser.email || "",
          displayName: fbUser.displayName || "",
          avatarUrl: fbUser.photoURL,
        });

        // Assign role server-side via Admin SDK (idempotent — skips if already set)
        authFetch("/api/auth/init", { method: "POST" }).catch(() => {});
      }

      setLoading(false);
    });

    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onIdTokenChange(async (fbUser) => {
      if (!fbUser) {
        setAuthTokenCookie(null);
        return;
      }

      try {
        const token = await fbUser.getIdToken();
        setAuthTokenCookie(token);
      } catch {
        setAuthTokenCookie(null);
      }
    });

    return unsub;
  }, []);

  return (
    <AuthContext.Provider value={{ firebaseUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}

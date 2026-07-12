"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export type UserRole = "user" | "admin" | "superadmin";

export function useRole() {
  const { firebaseUser, isAuthenticated, loading: authLoading } = useAuth();
  const [role, setRole] = useState<UserRole>("user");
  const [department, setDepartment] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !firebaseUser) {
      setRole("user");
      setDepartment(undefined);
      setLoading(false);
      return;
    }

    return onSnapshot(
      doc(db, "users", firebaseUser.uid),
      (userDoc) => {
        const data = userDoc.data();
        const r = data?.role as UserRole | undefined;
        setRole(r || "user");
        setDepartment(data?.department as string | undefined);
        setLoading(false);
      },
      () => {
        setRole("user");
        setDepartment(undefined);
        setLoading(false);
      },
    );
  }, [firebaseUser, isAuthenticated, authLoading]);

  return {
    role,
    department,
    isSuperAdmin: role === "superadmin",
    isAdmin: role === "admin" || role === "superadmin",
    loading: authLoading || loading,
  };
}

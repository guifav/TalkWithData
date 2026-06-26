"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { doc, getDoc } from "firebase/firestore";
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

    async function fetchRole() {
      try {
        const userDoc = await getDoc(doc(db, "users", firebaseUser!.uid));
        const data = userDoc.data();
        const r = data?.role as UserRole | undefined;
        setRole(r || "user");
        setDepartment(data?.department as string | undefined);
      } catch {
        setRole("user");
        setDepartment(undefined);
      } finally {
        setLoading(false);
      }
    }

    fetchRole();
  }, [firebaseUser, isAuthenticated, authLoading]);

  return {
    role,
    department,
    isSuperAdmin: role === "superadmin",
    isAdmin: role === "admin" || role === "superadmin",
    loading: authLoading || loading,
  };
}

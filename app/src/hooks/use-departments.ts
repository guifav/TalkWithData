"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { authFetch } from "@/lib/firebase/auth";

/**
 * Returns the department IDs the current user belongs to.
 * Fetches via server-side API to avoid Firestore client permission issues.
 */
export function useUserDepartmentIds(): {
  departmentIds: string[];
  loading: boolean;
} {
  const { firebaseUser, loading: authLoading } = useAuth();
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!firebaseUser) {
      setDepartmentIds([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchDepartments() {
      try {
        const res = await authFetch("/api/my-departments");
        if (!res.ok) {
          console.warn("[useUserDepartmentIds] fetch failed:", res.status);
          setDepartmentIds([]);
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setDepartmentIds(data.departmentIds || []);
          setLoading(false);
        }
      } catch (error) {
        console.warn("[useUserDepartmentIds] fetch error:", error);
        if (!cancelled) {
          setDepartmentIds([]);
          setLoading(false);
        }
      }
    }

    fetchDepartments();

    return () => {
      cancelled = true;
    };
  }, [firebaseUser, authLoading]);

  return { departmentIds, loading };
}

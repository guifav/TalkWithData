"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { authFetch } from "@/lib/firebase/auth";

const DEFAULT_CATEGORIES = ["Finance", "Commercial", "CS", "Marketing", "Other"];

export function useCategories() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);

  const fetchCategories = async () => {
    try {
      const res = await authFetch("/api/admin/categories");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.categories) && data.categories.length > 0) {
          setCategories(data.categories);
        }
      }
    } catch {
      // Keep defaults on failure
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    fetchCategories();
  }, [isAuthenticated, authLoading]);

  return { categories, loading: authLoading || loading, refetch: fetchCategories };
}

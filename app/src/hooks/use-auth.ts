"use client";

import { useAuthContext } from "@/contexts/auth-context";

export function useAuth() {
  const { firebaseUser, loading } = useAuthContext();

  const isAuthenticated = !!firebaseUser;

  return {
    firebaseUser,
    loading,
    isAuthenticated,
  };
}

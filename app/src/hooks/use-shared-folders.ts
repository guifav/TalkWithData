import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  listSharedFolders,
  type SharedFolder,
} from "@/lib/firestore/shared-folders";

export function useSharedFolders() {
  const { firebaseUser } = useAuth();
  const [folders, setFolders] = useState<SharedFolder[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!firebaseUser) {
      setFolders([]);
      setLoading(false);
      return;
    }
    try {
      const data = await listSharedFolders();
      setFolders(data);
    } catch (err) {
      console.warn("[useSharedFolders] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [firebaseUser]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  return { sharedFolders: folders, loading, refresh };
}

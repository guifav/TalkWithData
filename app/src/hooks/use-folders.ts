import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { subscribeToFolders, type Folder } from "@/lib/firestore/folders";

export function useFolders() {
  const { firebaseUser } = useAuth();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser) {
      setFolders([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = subscribeToFolders(firebaseUser.uid, (f) => {
      setFolders(f);
      setLoading(false);
    });

    return unsub;
  }, [firebaseUser]);

  return { folders, loading };
}

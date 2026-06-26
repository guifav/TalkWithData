import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import type { User } from "@/lib/types";

const COLLECTION = "users";

export async function getUser(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, COLLECTION, uid));
  if (!snap.exists()) return null;
  return { uid: snap.id, ...snap.data() } as User;
}

export async function createOrUpdateUser(
  uid: string,
  data: { email: string; displayName: string; avatarUrl: string | null }
): Promise<void> {
  const ref = doc(db, COLLECTION, uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    await setDoc(
      ref,
      { ...data, lastLoginAt: Timestamp.now() },
      { merge: true }
    );
  } else {
    // Create user doc WITHOUT role — role is assigned server-side
    // via POST /api/auth/init to prevent client-side privilege escalation.
    await setDoc(ref, {
      ...data,
      createdAt: Timestamp.now(),
      lastLoginAt: Timestamp.now(),
    });
  }
}

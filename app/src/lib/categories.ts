import { adminDb } from "@/lib/firebase/admin";

const SETTINGS_DOC = "settings/categories";
const DEFAULT_CATEGORIES = ["Finance", "Commercial", "CS", "Marketing", "Other"];

/**
 * Get categories from Firestore. Seeds defaults if doc doesn't exist.
 */
export async function getCategories(): Promise<string[]> {
  const doc = await adminDb.doc(SETTINGS_DOC).get();
  if (!doc.exists) {
    await adminDb.doc(SETTINGS_DOC).set({ items: DEFAULT_CATEGORIES });
    return DEFAULT_CATEGORIES;
  }
  const items = doc.data()?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return DEFAULT_CATEGORIES;
  }
  return items as string[];
}

/**
 * Check if a category name is valid (exists in Firestore).
 * Falls back to defaults if Firestore is unavailable.
 */
export async function isValidCategory(name: string): Promise<boolean> {
  try {
    const cats = await getCategories();
    return cats.includes(name);
  } catch {
    return DEFAULT_CATEGORIES.includes(name);
  }
}

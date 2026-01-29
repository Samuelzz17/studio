
import {
  Firestore,
  collection,
  doc,
  getDocs,
  query,
  writeBatch,
} from 'firebase/firestore';
import { menuItems, rawMaterials, assets } from '@/lib/data';

const locationNames = ['SR Gadjah Mada', 'SR Jalur 11'];

/**
 * Checks if a user has any locations set up.
 * @param db The Firestore instance.
 * @param userId The user's ID.
 * @returns True if locations exist, false otherwise.
 */
export async function hasLocations(
  db: Firestore,
  userId: string
): Promise<boolean> {
  const locationsColRef = collection(db, `users/${userId}/locations`);
  const q = query(locationsColRef);
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

/**
 * Seeds initial data for a new user, creating two default locations
 * and populating them with menu items, raw materials, and assets.
 * @param db The Firestore instance.
 * @param userId The user's ID.
 */
export async function seedInitialData(db: Firestore, userId: string) {
  const batch = writeBatch(db);

  // Create location documents
  const locationIds = locationNames.map((name) => {
    const locRef = doc(collection(db, `users/${userId}/locations`));
    batch.set(locRef, { name });
    return locRef.id;
  });

  // For each new location, add all default items
  locationIds.forEach((locationId) => {
    // Add Menu Items
    menuItems.forEach((item) => {
      const itemRef = doc(
        collection(db, `users/${userId}/locations/${locationId}/menuItems`)
      );
      batch.set(itemRef, { ...item, id: itemRef.id }); // Use doc id as item id
    });

    // Add Raw Materials
    rawMaterials.forEach((material) => {
      const materialRef = doc(
        collection(db, `users/${userId}/locations/${locationId}/ingredients`)
      );
      batch.set(materialRef, { ...material, id: materialRef.id });
    });

    // Add Assets
    assets.forEach((asset) => {
      const assetRef = doc(
        collection(db, `users/${userId}/locations/${locationId}/assets`)
      );
      batch.set(assetRef, { ...asset, id: assetRef.id });
    });
  });

  // Commit the batch write
  await batch.commit();
}

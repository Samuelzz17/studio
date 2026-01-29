
import {
  Firestore,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { defaultProducts, defaultRawMaterials, defaultAssets } from '@/lib/data';

const outletDefinitions = [
    { id: 'sr_gadjah_mada', name: 'SR Gadjah Mada', code: 'SRGM' },
    { id: 'sr_jalur_11', name: 'SR Jalur 11', code: 'SRJ11' }
];

/**
 * Checks if a user document exists in Firestore.
 * @param db The Firestore instance.
 * @param userId The user's ID.
 * @returns True if the user document exists, false otherwise.
 */
export async function hasUserData(db: Firestore, userId: string): Promise<boolean> {
  const userDocRef = doc(db, `users/${userId}`);
  const docSnap = await getDoc(userDocRef);
  return docSnap.exists();
}

/**
 * Seeds initial data for a new user, creating outlets and a user profile.
 * @param db The Firestore instance.
 * @param userId The user's ID.
 */
export async function seedInitialData(db: Firestore, userId: string) {
  const batch = writeBatch(db);
  const now = serverTimestamp();

  // 1. Create Outlet documents and their inventory
  for (const outletDef of outletDefinitions) {
    const outletId = outletDef.id;

    // Create outlet info document
    const outletDocRef = doc(db, `outlets/${outletId}`);
    batch.set(outletDocRef, {
        name: outletDef.name,
        code: outletDef.code,
        active: true,
        createdAt: now
    });

    // Add Products
    defaultProducts.forEach((product) => {
      const itemRef = doc(collection(db, `outlets/${outletId}/products`));
      batch.set(itemRef, { ...product, createdAt: now });
    });

    // Add Raw Materials
    defaultRawMaterials.forEach((material) => {
      const materialRef = doc(collection(db, `outlets/${outletId}/raw_materials`));
      batch.set(materialRef, { ...material, createdAt: now });
    });

    // Add Assets
    defaultAssets.forEach((asset) => {
      const assetRef = doc(collection(db, `outlets/${outletId}/asset_investments`));
      batch.set(assetRef, { ...asset, purchaseDate: now, createdAt: now });
    });
  }

  // 2. Create the User document
  const userDocRef = doc(db, `users/${userId}`);
  batch.set(userDocRef, {
    name: 'Admin User',
    role: 'owner',
    outletAccess: outletDefinitions.map(o => o.id), // Grant access to all outlets
    createdAt: now,
  });

  // Commit all writes at once
  await batch.commit();
}

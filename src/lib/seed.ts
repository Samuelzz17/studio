
import {
  Firestore,
  collection,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { defaultProducts, defaultRawMaterials, defaultAssets } from '@/lib/data';

// This file is kept for potential future use or for manual seeding scripts
// that might be run from the client side. The primary seeding mechanism
// is now handled by the `scripts/seed-firestore.ts` which uses the Admin SDK.

/**
 * Adds default inventory items to a specific outlet.
 * This can be called after an outlet is created.
 * @param db The Firestore instance.
 * @param outletId The ID of the outlet to seed with inventory.
 */
export async function seedOutletInventory(db: Firestore, outletId: string) {
    const batch = writeBatch(db);
    const now = serverTimestamp();

    // Add Products
    defaultProducts.forEach((product) => {
      const itemRef = doc(collection(db, `outlets/${outletId}/inventory_products`));
      batch.set(itemRef, { ...product, createdAt: now });
    });

    // Add Raw Materials
    defaultRawMaterials.forEach((material) => {
      const materialRef = doc(collection(db, `outlets/${outletId}/inventory_raw_materials`));
      batch.set(materialRef, { ...material, createdAt: now });
    });

    // Add Assets
    defaultAssets.forEach((asset) => {
      const assetRef = doc(collection(db, `outlets/${outletId}/inventory_assets`));
      batch.set(assetRef, { ...asset, purchaseDate: now, createdAt: now });
    });
    
    await batch.commit();
    console.log(`Inventory seeded for outlet ${outletId}`);
}

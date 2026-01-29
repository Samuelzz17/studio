import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
// IMPORTANT: Create a 'serviceAccountKey.json' in the '/scripts' directory.
// This file is git-ignored for security. Get it from your Firebase project settings.
import serviceAccount from "./serviceAccountKey.json" assert { type: "json" };

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function seed() {
  console.log("🌱 Start seeding...");

  // --- 1. SEED A TEST USER ---
  // ⛔️ IMPORTANT: Replace with a real User ID from your Firebase Authentication console.
  const testUserUid = 'REPLACE_WITH_YOUR_FIREBASE_USER_ID'; 
  if (testUserUid === 'REPLACE_WITH_YOUR_FIREBASE_USER_ID') {
    console.warn('⚠️ Skipping user seed. Please edit `scripts/seed-firestore.ts` and replace the placeholder UID.');
  } else {
    const userRef = db.collection('users').doc(testUserUid);
    await userRef.set({
      name: 'Admin User',
      role: 'owner',
      outletAccess: ['sr_gadjah_mada', 'sr_jalur_11'],
      createdAt: new Date(),
    });
    console.log(`👤 Seeded user: ${testUserUid}`);
  }


  // --- 2. SEED OUTLETS ---
  const outlets = [
    {
      id: "sr_gadjah_mada",
      name: "SR Gadjah Mada",
      code: "SRGM",
    },
    {
      id: "sr_jalur_11",
      name: "SR Jalur 11",
      code: "SRJ11",
    },
  ];

  for (const outlet of outlets) {
    const outletRef = db.collection("outlets").doc(outlet.id);

    await outletRef.set({
      name: outlet.name,
      code: outlet.code,
      active: true,
      createdAt: new Date(),
    });

    // create empty subcollections (Firestore style)
    const subCollections = [
      "inventory_products",
      "inventory_raw_materials",
      "inventory_assets",
      "sales",
      "purchases_raw",
      "expenses",
      "purchases_assets",
    ];

    for (const col of subCollections) {
      await outletRef.collection(col).doc("_init").set({
        createdAt: new Date(),
        note: "auto seed",
      });
    }

    console.log(`✅ Seeded outlet: ${outlet.id}`);
  }

  console.log("🎉 SEEDING DONE");
}

seed().catch(console.error);

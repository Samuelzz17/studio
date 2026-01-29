
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
// This script assumes you have a serviceAccountKey.json file in the same directory.
// You can download this from your Firebase project settings.
import serviceAccount from "./serviceAccountKey.json" assert { type: "json" };

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function seed() {
  console.log("🌱 Start seeding...");

  // --- 1. Seed Outlets ---
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
  
  // --- 2. Seed a Test User Document ---
  // IMPORTANT: 
  // 1. Go to your Firebase project's "Authentication" page.
  // 2. Create a user (e.g., admin@sr.com with a password).
  // 3. Copy the UID for that user.
  // 4. Paste the UID below to replace "REPLACE_WITH_YOUR_TEST_USER_UID".
  const testUserUid = "REPLACE_WITH_YOUR_TEST_USER_UID";

  if (testUserUid && testUserUid !== "REPLACE_WITH_YOUR_TEST_USER_UID") {
    await db.collection("users").doc(testUserUid).set({
      name: "Admin User",
      role: "owner",
      outletAccess: ["sr_gadjah_mada", "sr_jalur_11"],
      createdAt: new Date(),
    });
    console.log(`✅ Seeded user document for UID: ${testUserUid}`);
  } else {
    console.warn("⚠️  Skipping user document seeding. Please update 'testUserUid' in scripts/seed-firestore.ts");
  }


  console.log("🎉 SEEDING DONE");
}

seed().catch(console.error);

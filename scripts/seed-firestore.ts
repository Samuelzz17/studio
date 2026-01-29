
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
// @ts-ignore
import serviceAccount from "./serviceAccountKey.json" assert { type: "json" };

/*
================================================================================
IMPORTANT: FIREBASE SERVICE ACCOUNT KEY
================================================================================
This script requires a Firebase service account key to run.

1.  Go to your Firebase project settings > "Service accounts".
2.  Click "Generate new private key" and download the JSON file.
3.  Rename the downloaded file to "serviceAccountKey.json".
4.  Place the "serviceAccountKey.json" file in this "scripts" directory.

NOTE: This file should NOT be committed to your version control (e.g., Git).
It's included in the .gitignore file by default.
================================================================================
*/


initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

async function seed() {
  console.log("🌱 Start seeding...");

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

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
}).then(() => {
    process.exit(0);
});

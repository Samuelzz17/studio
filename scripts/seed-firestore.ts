
import admin from "firebase-admin";
import { readFileSync } from "fs";

// IMPORTANT: Create a service account in your Firebase project and download the JSON key.
// Place the key in the /scripts directory and rename it to 'serviceAccountKey.json'.
// This file should NOT be committed to your repository.
const serviceAccountPath = './scripts/serviceAccountKey.json';

let serviceAccount;
try {
  serviceAccount = JSON.parse(
    readFileSync(serviceAccountPath, "utf8")
  );
} catch (error) {
    console.error("❌ Error reading service account file.");
    console.error(`Please ensure 'serviceAccountKey.json' exists in the 'scripts' directory and you are running the script from the project root.`);
    process.exit(1);
}

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const outlets = [
  { id: "sr_gadjah_mada", name: "SR Gadjah Mada" },
  { id: "sr_jalur_11", name: "SR Jalur 11" }
];

const wrappers = ["inventory", "pos", "financial", "reports"];

async function seedFirestore() {
  console.log("🚀 Start seeding Firestore using Admin SDK...");
  const batch = db.batch();

  for (const outlet of outlets) {
    const outletRef = db.collection("outlets").doc(outlet.id);
    batch.set(outletRef, {
      name: outlet.name,
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`✅ Queued creation for outlet: ${outlet.name}`);

    // Create wrapper documents inside a subcollection.
    // In Firestore, a path must alternate collection/document.
    // This structure `outlets/{outletId}/_wrappers/{wrapperName}` is valid.
    for (const wrapper of wrappers) {
      const wrapperRef = outletRef.collection("_wrappers").doc(wrapper);
      batch.set(wrapperRef, {
         createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`   ↳ Queued wrapper '${wrapper}'`);
    }
  }

  await batch.commit();
  console.log("🎉 Firestore seeding complete!");
}

seedFirestore()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Seeding failed:", err);
    process.exit(1);
  });

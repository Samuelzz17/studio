
import admin from "firebase-admin"
import { readFileSync } from "fs"
import { resolve } from "path"

// Load service account from a path relative to the project root
// IMPORTANT: Make sure the serviceAccountKey.json file is in the /scripts directory
// and that this file is added to .gitignore
const serviceAccountPath = resolve(process.cwd(), 'scripts/serviceAccountKey.json');
const serviceAccount = JSON.parse(
  readFileSync(serviceAccountPath, "utf8")
);


// Init admin
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}


const db = admin.firestore()

const outlets = [
  { id: "sr_gadjah_mada", name: "SR Gadjah Mada", code: "SRGM" },
  { id: "sr_jalur_11", name: "SR Jalur 11", code: "SRJ11" }
]

const wrappers = ["inventory", "pos", "financial", "reports"]

async function seedFirestore() {
  console.log("🚀 Start seeding Firestore (ADMIN)...")
  const batch = db.batch();

  for (const outlet of outlets) {
    // The main document for the outlet in the 'outlets' collection
    const outletDocRef = db.collection("outlets").doc(outlet.id);
    batch.set(outletDocRef, {
      name: outlet.name,
      code: outlet.code,
      active: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    })

    console.log(`✅ Outlet scheduled for creation: ${outlet.name} (${outlet.code})`)

    // Create wrapper documents inside a '_wrappers' subcollection
    // This is a valid Firestore structure: collection/document/collection/document
    for (const wrapper of wrappers) {
      const wrapperDocRef = outletDocRef.collection("_wrappers").doc(wrapper);
      batch.set(wrapperDocRef, { 
        createdAt: admin.firestore.FieldValue.serverTimestamp() 
      });
      console.log(`   ↳ wrapper '${wrapper}' scheduled`);
    }
  }

  await batch.commit();
  console.log("🎉 Firestore seeding DONE!");
}

seedFirestore()
  .then(() => {
    console.log("Exiting script.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Seeding failed:", err)
    process.exit(1)
  })

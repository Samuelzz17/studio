import { initializeApp } from "firebase/app"
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp
} from "firebase/firestore"

// 🔥 This config is auto-populated from your project's firebase/config.ts
const firebaseConfig = {
  "projectId": "studio-2575278413-19a95",
  "appId": "1:213542699769:web:811479893b521409c11828",
  "apiKey": "AIzaSyCK3qr9egXaeHPkPMwyZsu54giyrN8qj10",
  "authDomain": "studio-2575278413-19a95.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "213542699769"
};

// Init Firebase
const app = initializeApp(firebaseConfig)
const db = getFirestore(app)

// Data outlet
const outlets = [
  { id: "sr_gadjah_mada", name: "SR Gadjah Mada" },
  { id: "sr_jalur_11", name: "SR Jalur 11" }
]

// The logical modules for each outlet. These will be created as documents.
const modules = ["inventory", "pos", "financial", "reports"]

async function seedFirestore() {
  console.log("🚀 Start seeding Firestore...")

  for (const outlet of outlets) {
    // 1️⃣ Create the main outlet document
    await setDoc(doc(db, "outlets", outlet.id), {
      name: outlet.name,
      active: true,
      createdAt: serverTimestamp()
    })
    console.log(`✅ Outlet document created: ${outlet.name}`)

    // 2️⃣ Create placeholder documents for each module (inventory, pos, etc.)
    // This creates a valid structure like: outlets/{outletId}/modules/inventory
    for (const moduleName of modules) {
      await setDoc(
        doc(db, "outlets", outlet.id, "modules", moduleName),
        { initializedAt: serverTimestamp() }
      )
      console.log(`   ↳ Module document '${moduleName}' ready`)
    }
  }

  console.log("🎉 Firestore seeding DONE!")
}

// RUN
seedFirestore()
  .then(() => {
    console.log("Script finished successfully.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Seeding failed:", err)
    process.exit(1)
  })

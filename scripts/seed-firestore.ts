
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";
import { defaultProducts, defaultRawMaterials, defaultAssets, RawMaterial, Product, AssetInvestment, Purchase, Expense, Transaction } from '../src/lib/data';
// IMPORTANT: Create a 'serviceAccountKey.json' in the '/scripts' directory.
// This file is git-ignored for security. Get it from your Firebase project settings.
import serviceAccount from "./serviceAccountKey.json" assert { type: "json" };

// Helper to format the private key which often has newline characters escaped
const formatPrivateKey = (key: string) => {
  if (!key) return '';
  return key.replace(/\\n/g, '\n');
}

// Create a version of the service account with the formatted private key
const formattedServiceAccount = {
  ...serviceAccount,
  private_key: formatPrivateKey((serviceAccount as any).private_key)
}

initializeApp({
  credential: cert(formattedServiceAccount),
});

const db = getFirestore();

// --- Static Data ---
// The script will seed data into these existing outlet IDs.
// It will NOT create or modify the outlet documents themselves.
const outletIds = ['sr_gadjah_mada', 'sr_jalur_11'];


/**
 * Seeds inventory (raw materials, products, assets) for a given outlet.
 */
async function seedInventory(outletId: string) {
  const batch = db.batch();
  const now = FieldValue.serverTimestamp();

  // Raw Materials
  defaultRawMaterials.forEach(material => {
    // Use the predefined ID from lib/data.ts for materials
    const ref = db.collection('outlets').doc(outletId).collection('inventory_raw_materials').doc(material.id);
    const { id, ...materialData } = material; // Exclude id from the data itself
    batch.set(ref, { ...materialData, createdAt: now });
  });

  // Products
  defaultProducts.forEach(product => {
     // Use the predefined ID from lib/data.ts for products
    const ref = db.collection('outlets').doc(outletId).collection('inventory_products').doc(product.id);
    const { id, ...productData } = product; // Exclude id from the data itself
    batch.set(ref, { ...productData, createdAt: now });
  });

  // Assets
  defaultAssets.forEach(asset => {
    // Assets don't have predefined IDs, so a new one is generated
    const ref = db.collection('outlets').doc(outletId).collection('inventory_assets').doc();
    batch.set(ref, { ...asset, purchaseDate: Timestamp.now(), createdAt: now });
  });

  await batch.commit();
  console.log(`✅ Seeded inventory for outlet ${outletId}`);
}


/**
 * Seeds sample financial data (sales, purchases, expenses) for a given outlet.
 */
async function seedFinancials(outletId: string) {
  const batch = db.batch();
  const now = new Date();

  // Sales
  for (let i = 0; i < 5; i++) {
    const ref = db.collection('outlets').doc(outletId).collection('sales').doc();
    const product = defaultProducts[i % defaultProducts.length];
    const sale: Omit<Transaction, 'id' | 'createdAt'> & { createdAt: Timestamp } = {
      invoice: `INV-${outletId.slice(0,4).toUpperCase()}-${Date.now() + i}`,
      customerName: 'Anonymous',
      items: [{ productId: product.id, qty: 1, price: product.price, preference: 'normal' }],
      total: product.price * 1.11, // Assuming 11% tax
      paymentMethod: i % 2 === 0 ? 'Cash' : 'Card',
      createdAt: Timestamp.fromDate(new Date(now.getTime() - i * 24 * 60 * 60 * 1000)),
    };
    batch.set(ref, sale);
  }

  // Purchases
  for (let i = 0; i < 3; i++) {
    const ref = db.collection('outlets').doc(outletId).collection('purchases').doc();
    const material = defaultRawMaterials[i % defaultRawMaterials.length];
    const purchase: Omit<Purchase, 'id' | 'createdAt'> & { createdAt: Timestamp } = {
      materialId: material.id,
      materialName: material.name,
      quantity: 500,
      unit: material.unit,
      totalCost: 500 * material.averageCost * 0.95, // Simulate a purchase cost
      supplier: 'Supplier Seeding',
      createdAt: Timestamp.fromDate(new Date(now.getTime() - i * 3 * 24 * 60 * 60 * 1000)),
    };
    batch.set(ref, purchase);
  }

  // Expenses
  const expenses = [
    { name: 'Electricity Bill', category: 'Utilities', amount: 500000 },
    { name: 'Staff Salary', category: 'Wages', amount: 5000000 },
  ];
  expenses.forEach((exp, i) => {
    const ref = db.collection('outlets').doc(outletId).collection('expenses').doc();
    const expense: Omit<Expense, 'id' | 'createdAt'> & { createdAt: any, expenseDate: any } = {
      ...exp,
      expenseDate: Timestamp.fromDate(new Date(now.getTime() - i * 15 * 24 * 60 * 60 * 1000)),
      notes: 'Auto-seeded expense',
      createdAt: Timestamp.fromDate(new Date(now.getTime() - i * 15 * 24 * 60 * 60 * 1000)),
    };
    batch.set(ref, expense);
  });

  await batch.commit();
  console.log(`✅ Seeded financial data for outlet ${outletId}`);
}


/**
 * Clears all subcollections for a given outlet to prevent data duplication on re-seed.
 */
async function clearOutletData(outletId: string) {
    const subCollections = [
      'inventory_products',
      'inventory_raw_materials',
      'inventory_assets',
      'sales',
      'purchases',
      'expenses',
    ];
    console.log(`🧹 Clearing data for outlet ${outletId}...`);
    for (const colName of subCollections) {
        const collectionRef = db.collection('outlets').doc(outletId).collection(colName);
        const snapshot = await collectionRef.get();
        if (snapshot.empty) continue;

        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        console.log(`   - Cleared subcollection: ${colName}`);
    }
}


/**
 * Main seeding function.
 */
async function main() {
  console.log("🌱 Start seeding Firestore data (excluding users and outlets)...");
  
  console.log("\nSeeding inventory and financial data for each outlet...");
  for (const outletId of outletIds) {
    // Check if outlet exists before seeding
    const outletRef = db.collection('outlets').doc(outletId);
    const outletDoc = await outletRef.get();
    if (!outletDoc.exists) {
        console.warn(`⚠️ Outlet with ID '${outletId}' not found. Skipping seeding for this outlet.`);
        continue;
    }

    console.log(`\n--- Processing Outlet: ${outletDoc.data()?.name || outletId} ---`);
    await clearOutletData(outletId);
    await seedInventory(outletId);
    await seedFinancials(outletId);
  }

  console.log("\n🎉 SEEDING COMPLETE!");
}

main().catch(error => {
    console.error("--- ❌ Seeding failed ---");
    console.error(error);
    process.exit(1);
});

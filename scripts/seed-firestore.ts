import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
// IMPORTANT: Create a 'serviceAccountKey.json' in the '/scripts' directory.
// This file is git-ignored for security. Get it from your Firebase project settings.
import serviceAccount from './serviceAccountKey.json' assert { type: 'json' };
import { defaultProducts, defaultRawMaterials, defaultAssets } from '../src/lib/data';
import { subDays, subHours } from 'date-fns';

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

// --- Configuration ---
// These outlets must already exist in your Firestore 'outlets' collection.
const OUTLET_IDS = ['sr_gadjah_mada', 'sr_jalur_11']; 

// --- Helper Functions ---
function getRandomDate(daysAgo: number) {
  return subDays(new Date(), Math.floor(Math.random() * daysAgo));
}

async function seed() {
  console.log('🌱 Start seeding subcollections for specified outlets...');

  for (const outletId of OUTLET_IDS) {
    const outletRef = db.collection('outlets').doc(outletId);
    
    // Verify outlet exists
    const outletSnap = await outletRef.get();
    if (!outletSnap.exists) {
      console.warn(`⚠️ Skipping seed for outlet '${outletId}' because it does not exist.`);
      continue;
    }
    
    console.log(`\n--- Seeding Outlet: ${outletId} ---`);
    const batch = db.batch();

    // 1. Seed Raw Materials
    console.log('  -> Seeding Raw Materials...');
    defaultRawMaterials.forEach(material => {
      const { id, ...data } = material;
      const docRef = outletRef.collection('inventory_raw_materials').doc(id);
      batch.set(docRef, { ...data, createdAt: Timestamp.now() });
    });
    
    // 2. Seed Products
    console.log('  -> Seeding Products...');
    defaultProducts.forEach(product => {
      const { id, ...data } = product;
      const docRef = outletRef.collection('inventory_products').doc(id);
      batch.set(docRef, { ...data, createdAt: Timestamp.now() });
    });

    // 3. Seed Assets
    console.log('  -> Seeding Assets...');
    defaultAssets.forEach(asset => {
        const docRef = outletRef.collection('inventory_assets').doc();
        batch.set(docRef, { ...asset, purchaseDate: getRandomDate(365), createdAt: Timestamp.now() });
    });

    // 4. Seed Expenses
    console.log('  -> Seeding Expenses...');
    const expenseCategories = ['Utilities', 'Rent', 'Marketing', 'Supplies'];
    for (let i = 0; i < 15; i++) {
        const docRef = outletRef.collection('expenses').doc();
        batch.set(docRef, {
            name: `Expense Item ${i + 1}`,
            category: expenseCategories[i % expenseCategories.length],
            amount: Math.floor(Math.random() * 500000) + 50000,
            expenseDate: getRandomDate(90),
            notes: 'Auto-seeded expense',
            createdAt: Timestamp.now(),
        });
    }

    // 5. Seed Purchases
    console.log('  -> Seeding Purchases...');
    for (let i = 0; i < 10; i++) {
        const material = defaultRawMaterials[i % defaultRawMaterials.length];
        const quantity = Math.floor(Math.random() * 10) + 1; // e.g., 1-10 kg or L
        const totalCost = quantity * material.averageCost * 1000 * (Math.random() * 0.2 + 0.9); // price variance
        const docRef = outletRef.collection('purchases').doc();
        batch.set(docRef, {
            materialName: material.name,
            materialId: material.id,
            quantity: quantity,
            unit: material.unit,
            totalCost: totalCost,
            supplier: `Supplier ${String.fromCharCode(65 + (i % 5))}`,
            createdAt: getRandomDate(60),
        });
    }

    // 6. Seed Sales Transactions
    console.log('  -> Seeding Sales Transactions...');
    for (let i = 0; i < 50; i++) {
        const docRef = outletRef.collection('sales').doc();
        const numItems = Math.floor(Math.random() * 3) + 1;
        const items = [];
        let subtotal = 0;
        for (let j = 0; j < numItems; j++) {
            const product = defaultProducts[Math.floor(Math.random() * defaultProducts.length)];
            const qty = Math.floor(Math.random() * 2) + 1;
            items.push({
                productId: product.id,
                qty,
                price: product.price,
                preference: Math.random() > 0.5 ? 'normal' : 'low sugar',
            });
            subtotal += product.price * qty;
        }
        const total = subtotal * 1.11; // Add 11% tax
        
        batch.set(docRef, {
            invoice: `INV-SEED-${Date.now().toString().slice(-6)}-${i}`,
            customerName: `Customer ${i+1}`,
            items: items,
            total: total,
            paymentMethod: Math.random() > 0.5 ? 'Card' : 'Cash',
            createdAt: subHours(getRandomDate(30), Math.floor(Math.random() * 12)),
        });
    }
    
    // Add _init docs to ensure collections exist if they were empty
    const subCollections = [
        'inventory_products', 'inventory_raw_materials', 'inventory_assets',
        'sales', 'purchases', 'expenses'
    ];
    for (const col of subCollections) {
        const initRef = outletRef.collection(col).doc('_init');
        batch.set(initRef, { createdAt: Timestamp.now(), note: "Ensures collection exists" });
    }

    await batch.commit();
    console.log(`✅ Finished seeding for Outlet: ${outletId}`);
  }

  console.log('\n🎉 SEEDING COMPLETE');
}

seed().catch((error) => {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
});

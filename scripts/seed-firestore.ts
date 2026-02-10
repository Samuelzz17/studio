
import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { defaultProducts, defaultRawMaterials, defaultAssets, type Transaction, type Purchase, type Expense } from '../src/lib/data';
import * as serviceAccountJson from './serviceAccountKey.json';
import { subDays, startOfMonth, endOfMonth } from 'date-fns';

// Correctly format the private key from the JSON file
const serviceAccount = serviceAccountJson as ServiceAccount;
const formattedServiceAccount: ServiceAccount = {
  ...serviceAccount,
  private_key: (serviceAccount.private_key || '').replace(/\\n/g, '\n'),
};

// Initialize Firebase Admin SDK
initializeApp({
  credential: cert(formattedServiceAccount),
});

const db = getFirestore();
const auth = getAuth();

// --- Configuration ---
const OUTLET_IDS_TO_SEED = ['sr_gadjah_mada', 'sr_jalur_11']; // IDs of existing outlets

// --- Helper Functions ---

/**
 * Deletes all documents in a specified collection.
 * @param {string} collectionPath - The path to the collection.
 */
async function clearCollection(collectionPath: string) {
  const collectionRef = db.collection(collectionPath);
  const snapshot = await collectionRef.get();

  if (snapshot.empty) {
    console.log(`- Collection ${collectionPath} is already empty.`);
    return;
  }

  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    // Keep the _init document if it exists, delete others
    if (doc.id !== '_init') {
      batch.delete(doc.ref);
    }
  });

  await batch.commit();
  console.log(`- Cleared ${snapshot.size - (snapshot.docs.some(d => d.id === '_init') ? 1 : 0)} documents from ${collectionPath}.`);
}


/**
 * Generates random sales data for a given period.
 * @param products - The list of available products.
 * @param numTransactions - The number of transactions to generate.
 * @param dateRange - The start and end date for the transactions.
 * @returns {Omit<Transaction, 'id' | 'createdAt'>[]} - An array of sales data.
 */
function generateSalesData(
    products: typeof defaultProducts,
    numTransactions: number,
    dateRange: { start: Date; end: Date }
): Omit<Transaction, 'id' | 'createdAt'>[] {
    const sales: Omit<Transaction, 'id' | 'createdAt'>[] = [];
    const productList = products.filter(p => p.recipe.length > 0); // Only use products with recipes for more realistic data

    for (let i = 0; i < numTransactions; i++) {
        const numItems = Math.floor(Math.random() * 3) + 1;
        const items = [];
        let total = 0;

        for (let j = 0; j < numItems; j++) {
            const product = productList[Math.floor(Math.random() * productList.length)];
            const qty = Math.floor(Math.random() * 2) + 1;
            items.push({
                productId: product.id,
                qty: qty,
                price: product.price,
                preference: 'normal',
            });
            total += product.price * qty;
        }

        const randomTimestamp = new Date(
            dateRange.start.getTime() + Math.random() * (dateRange.end.getTime() - dateRange.start.getTime())
        );

        sales.push({
            invoice: `INV-${Date.now()}-${i}`,
            customerName: 'Anonymous',
            items,
            total: total * 1.11, // Add 11% tax
            paymentMethod: Math.random() > 0.5 ? 'Cash' : 'QRIS',
            createdAt: Timestamp.fromDate(randomTimestamp)
        });
    }
    return sales;
}


/**
 * Generates random purchase data for the raw materials.
 * @returns {Omit<Purchase, 'id' | 'createdAt'>[]} - An array of purchase data.
 */
function generatePurchaseData(): Omit<Purchase, 'id' | 'createdAt'>[] {
    const purchases: Omit<Purchase, 'id' | 'createdAt'>[] = [];
    const suppliers = ['Supplier Jaya', 'Bahan Baku Maju', 'Toko Lestari'];

    defaultRawMaterials.forEach(material => {
        for (let i = 0; i < 3; i++) { // Generate 3 purchases per material
            const quantity = Math.floor(Math.random() * 50) + 10; // e.g., 10-60 units
            const totalCost = quantity * material.averageCost * (Math.random() * 0.2 + 0.9); // +/- 10% cost variance
            const randomTimestamp = subDays(new Date(), Math.floor(Math.random() * 30)); // Within the last 30 days

            purchases.push({
                materialId: material.id,
                materialName: material.name,
                quantity,
                unit: material.unit,
                totalCost,
                supplier: suppliers[Math.floor(Math.random() * suppliers.length)],
                createdAt: Timestamp.fromDate(randomTimestamp)
            });
        }
    });
    return purchases;
}

/**
 * Generates random expense data.
 * @returns {Omit<Expense, 'id' | 'createdAt'>[]} - An array of expense data.
 */
function generateExpenseData(): Omit<Expense, 'id' | 'createdAt'>[] {
    const expenses: Omit<Expense, 'id' | 'createdAt'>[] = [];
    const expenseCategories = {
        'Utilities': ['Electricity Bill', 'Water Bill', 'Internet Bill'],
        'Rent': ['Monthly Rent'],
        'Marketing': ['Social Media Ads', 'Flyer Printing'],
        'Operational': ['Cleaning Supplies', 'Packaging']
    };
    const categories = Object.keys(expenseCategories);

    for (let i = 0; i < 15; i++) { // Generate 15 random expenses
        const category = categories[Math.floor(Math.random() * categories.length)];
        const name = expenseCategories[category as keyof typeof expenseCategories][Math.floor(Math.random() * expenseCategories[category as keyof typeof expenseCategories].length)];
        const amount = Math.floor(Math.random() * 1000000) + 50000;
        const randomTimestamp = subDays(new Date(), Math.floor(Math.random() * 30));

        expenses.push({
            name,
            category,
            amount,
            expenseDate: Timestamp.fromDate(randomTimestamp),
            notes: 'Auto-generated expense',
            createdAt: Timestamp.now()
        });
    }

    return expenses;
}

/**
 * Main seeding function.
 */
async function main() {
  console.log('--- Starting Firestore Seeding ---');

  for (const outletId of OUTLET_IDS_TO_SEED) {
    console.log(`\n--- Processing Outlet: ${outletId} ---`);

    const outletRef = db.doc(`outlets/${outletId}`);
    const outletSnap = await outletRef.get();
    if (!outletSnap.exists) {
        console.warn(`! Warning: Outlet with ID '${outletId}' does not exist. Skipping.`);
        continue;
    }

    // 1. Clear existing data to prevent duplication
    console.log('1. Clearing old data...');
    await clearCollection(`outlets/${outletId}/inventory_products`);
    await clearCollection(`outlets/${outletId}/inventory_raw_materials`);
    await clearCollection(`outlets/${outletId}/inventory_assets`);
    await clearCollection(`outlets/${outletId}/sales`);
    await clearCollection(`outlets/${outletId}/purchases`);
    await clearCollection(`outlets/${outletId}/expenses`);

    const batch = db.batch();
    const now = Timestamp.now();
    const today = new Date();
    
    // 2. Seed Inventory
    console.log('2. Seeding inventory data...');
    // Products
    defaultProducts.forEach(product => {
      const {id, ...data} = product;
      const itemRef = db.doc(`outlets/${outletId}/inventory_products/${id}`);
      batch.set(itemRef, { ...data, createdAt: now });
    });
    // Raw Materials
    defaultRawMaterials.forEach(material => {
      const {id, ...data} = material;
      const materialRef = db.doc(`outlets/${outletId}/inventory_raw_materials/${id}`);
      batch.set(materialRef, { ...data, createdAt: now });
    });
    // Assets
    defaultAssets.forEach(asset => {
      const assetRef = db.collection(`outlets/${outletId}/inventory_assets`).doc();
      batch.set(assetRef, { ...asset, purchaseDate: now, createdAt: now });
    });
    
    // 3. Seed Financial Records
    console.log('3. Seeding financial records...');
    // Sales Data (last month)
    const salesData = generateSalesData(defaultProducts, 150, { start: startOfMonth(subDays(today, 30)), end: endOfMonth(subDays(today, 30)) });
    salesData.forEach(sale => {
      const saleRef = db.collection(`outlets/${outletId}/sales`).doc();
      batch.set(saleRef, sale);
    });
    // Purchase Data
    const purchaseData = generatePurchaseData();
    purchaseData.forEach(purchase => {
      const purchaseRef = db.collection(`outlets/${outletId}/purchases`).doc();
      batch.set(purchaseRef, purchase);
    });
    // Expense Data
    const expenseData = generateExpenseData();
    expenseData.forEach(expense => {
        const expenseRef = db.collection(`outlets/${outletId}/expenses`).doc();
        batch.set(expenseRef, expense);
    });

    // 4. Commit all changes for the outlet
    console.log('4. Committing changes...');
    await batch.commit();
    console.log(`--- Finished processing for Outlet: ${outletId} ---`);
  }

  console.log('\n--- Firestore Seeding Complete ---');
}

main().catch(err => {
  console.error('--- ❌ Seeding failed ---');
  console.error(err);
});


import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
// IMPORTANT: Create a 'serviceAccountKey.json' in the '/scripts' directory.
// This file is git-ignored for security. Get it from your Firebase project settings.
import serviceAccount from "./serviceAccountKey.json" assert { type: "json" };
import { defaultProducts, defaultRawMaterials, defaultAssets } from '../src/lib/data';
import type { OutletInfo, Product, RawMaterial, AssetInvestment, Transaction, Purchase, Expense } from "../src/lib/data";

// Type assertion to give a better type to the imported JSON
const typedServiceAccount = serviceAccount as {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
  universe_domain: string;
};

// Fix for private_key format issue.
// The private_key in the JSON file often comes with escaped newlines (\\n).
// The `cert` function expects actual newline characters.
const formattedServiceAccount = {
  ...typedServiceAccount,
  private_key: typedServiceAccount.private_key.replace(/\\n/g, '\n'),
};


initializeApp({
  credential: cert(formattedServiceAccount),
});

const db = getFirestore();
const auth = getAuth();

/**
 * Creates or updates a user in Firebase Authentication.
 * @param uid The UID for the user.
 * @param email The email for the user.
 * @param password The password for the user.
 * @returns The user record.
 */
async function seedAuthUser(uid: string, email: string, password?: string) {
    try {
        const user = await auth.getUser(uid);
        console.log(`👤 Auth user ${email} (${uid}) already exists. Skipping creation.`);
        // If you want to update the password, you can do it here.
        // await auth.updateUser(uid, { password });
        return user;
    } catch (error: any) {
        if (error.code === 'auth/user-not-found') {
            console.log(`Creating auth user: ${email}`);
            const userRecord = await auth.createUser({
                uid,
                email,
                password,
            });
            console.log(`✅ Successfully created new auth user: ${userRecord.uid}`);
            return userRecord;
        }
        // Propagate other errors
        throw error;
    }
}


async function main() {
  console.log("🌱 Start seeding...");

  // --- 1. SEED AUTH & FIRESTORE USER ---
  // This user will own the outlets.
  const ownerUID = 'owner-user-01';
  await seedAuthUser(ownerUID, 'admin@sr.com', 'password');
  
  const userRef = db.collection('users').doc(ownerUID);
  await userRef.set({
    name: 'Admin User',
    role: 'owner',
    outletAccess: ['sr_main_branch', 'sr_downtown_cafe'],
    createdAt: Timestamp.now(),
  });
  console.log(`👤 Seeded user document for 'owner-user-01'`);


  // --- 2. SEED OUTLETS ---
  const outlets = [
    { id: "sr_main_branch", name: "Main Branch", code: "SRMB" },
    { id: "sr_downtown_cafe", name: "Downtown Cafe", code: "SRDC" },
  ];

  for (const outlet of outlets) {
    const outletRef = db.collection("outlets").doc(outlet.id);
    const outletSnap = await outletRef.get();

    if (!outletSnap.exists) {
        await outletRef.set({
            name: outlet.name,
            code: outlet.code,
            active: true,
            createdAt: Timestamp.now(),
        });
        console.log(`✅ Seeded outlet: ${outlet.name}`);
    } else {
        console.log(`➡️ Outlet ${outlet.name} already exists. Skipping creation.`);
    }

    // --- 3. SEED INVENTORY FOR EACH OUTLET ---
    console.log(`  🌱 Seeding inventory for ${outlet.name}...`);
    const batch = db.batch();
    
    // Raw Materials
    defaultRawMaterials.forEach(material => {
        const matRef = outletRef.collection('inventory_raw_materials').doc(material.id);
        batch.set(matRef, { ...(({ id, ...rest }) => rest)(material), createdAt: Timestamp.now() });
    });

    // Products
    defaultProducts.forEach(product => {
        const prodRef = outletRef.collection('inventory_products').doc(product.id);
        batch.set(prodRef, { ...(({ id, ...rest }) => rest)(product), createdAt: Timestamp.now() });
    });

    // Assets
    defaultAssets.forEach(asset => {
        const assetRef = outletRef.collection('inventory_assets').doc();
        batch.set(assetRef, { ...asset, purchaseDate: Timestamp.now(), createdAt: Timestamp.now() });
    });

    // --- 4. SEED SAMPLE TRANSACTIONS FOR EACH OUTLET ---
    console.log(`  🌱 Seeding transactions for ${outlet.name}...`);

    // Sales
    const saleRef = outletRef.collection('sales').doc();
    batch.set(saleRef, {
        invoice: `INV-${Date.now()}`,
        customerName: 'Budi',
        items: [{ productId: 'prod_cappuccino', qty: 2, price: 25000, preference: 'normal' }],
        total: 55500, // 50000 + 11% tax
        paymentMethod: 'Card',
        createdAt: Timestamp.now(),
    });

    // Purchases
    const purchaseRef = outletRef.collection('purchases').doc();
    batch.set(purchaseRef, {
        materialName: 'Coffee Beans',
        materialId: 'coffee_beans',
        quantity: 5000,
        unit: 'g',
        totalCost: 1000000,
        supplier: 'Gayo Beans Co.',
        createdAt: Timestamp.now(),
    });

    // Expenses
    const expenseRef = outletRef.collection('expenses').doc();
    batch.set(expenseRef, {
        name: 'Monthly Electricity Bill',
        category: 'Utilities',
        amount: 750000,
        expenseDate: Timestamp.now(),
        notes: 'Electricity for the month',
        createdAt: Timestamp.now(),
    });

    await batch.commit();
    console.log(`  ✅ Inventory and sample transactions seeded for ${outlet.name}.`);

  }

  console.log("🎉 SEEDING DONE");
}

main().catch(error => {
    console.error('--- ❌ Seeding failed ---');
    console.error(error);
    process.exit(1);
});

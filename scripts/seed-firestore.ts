
import admin from 'firebase-admin';
import { ServiceAccount } from 'firebase-admin';

// NOTE: This script is intended to be run from the command line using tsx

// Ensure you have the service account key JSON file in your project
// and its path is correctly specified in your environment variables.
if (!process.env.SERVICE_ACCOUNT_KEY_JSON) {
  throw new Error('SERVICE_ACCOUNT_KEY_JSON environment variable not set.');
}

// Parse the service account key from the environment variable
const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY_JSON);

// Format the private key to be compatible with Firebase Admin SDK
const formattedServiceAccount: ServiceAccount = {
  ...serviceAccount,
  privateKey: (serviceAccount.private_key || '').replace(/\\n/g, '\n'),
};

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(formattedServiceAccount),
  databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
});

const db = admin.firestore();

/**
 * Seeds the Firestore database with initial data.
 * This function is idempotent, meaning it can be run multiple times without
 * creating duplicate data.
 */
async function seedDatabase() {
  console.log('Seeding database...');

  // Check for a flag document to ensure seeding is only done once
  const seedFlagRef = db.collection('internal').doc('seed_flag');
  const seedFlagDoc = await seedFlagRef.get();

  if (seedFlagDoc.exists) {
    console.log('Database has already been seeded. Skipping.');
    return;
  }

  // Add your seeding logic here. For example, creating initial documents,
  // setting up collections, etc.

  console.log('Your seeding logic goes here.');

  // Once seeding is complete, set the flag
  await seedFlagRef.set({ seeded: true, timestamp: admin.firestore.FieldValue.serverTimestamp() });

  console.log('Database seeded successfully!');
}

seedDatabase().catch(error => {
  console.error('Error seeding database:', error);
  process.exit(1);
});

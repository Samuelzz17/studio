import type { Timestamp } from 'firebase/firestore';

export type User = {
  id: string;
  name: string;
  role: 'owner' | 'operator';
  outletAccess: string[];
  createdAt: Timestamp;
};

export type OutletInfo = {
  id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  active: boolean;
  createdAt: Timestamp;
};

export type RecipeItem = {
    materialId: string;
    quantity: number;
}

export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  active: boolean;
  recipe: RecipeItem[];
  createdAt: Timestamp;
};

export type RawMaterial = {
  id: string;
  name: string;
  unit: 'kg' | 'g' | 'L' | 'mL' | 'pcs';
  stock: number;
  minimumStock: number;
  averageCost: number;
  createdAt: Timestamp;
};

export type AssetInvestment = {
  id: string;
  name: string;
  value: number;
  purchaseDate: Timestamp;
  depreciationYears: number;
  createdAt: Timestamp;
};

export type TransactionItem = {
  productId: string;
  qty: number;
  price: number;
  preference: 'normal' | 'low sugar';
};

export type Transaction = {
  id: string;
  invoice: string;
  customerName: string;
  items: TransactionItem[];
  total: number;
  paymentMethod: 'Cash' | 'QRIS';
  createdAt: Timestamp;
};

export type Purchase = {
  id: string;
  materialName: string;
  materialId: string;
  quantity: number;
  unit: string;
  totalCost: number;
  supplier?: string;
  createdAt: Timestamp;
};

export type Expense = {
  id: string;
  name: string;
  category: string;
  amount: number;
  expenseDate: Timestamp;
  notes?: string;
  createdAt: Timestamp;
};


// Default data for seeding
export const defaultProducts: (Omit<Product, 'createdAt' | 'id'> & { id: string })[] = [
  { id: 'prod_espresso', name: 'Espresso', category: 'Coffee', price: 18000, active: true, recipe: [{ materialId: 'coffee_beans', quantity: 18 }] },
  { id: 'prod_cappuccino', name: 'Cappuccino', category: 'Coffee', price: 25000, active: true, recipe: [{ materialId: 'coffee_beans', quantity: 18 }, { materialId: 'whole_milk', quantity: 150 }] },
  { id: 'prod_americano', name: 'Americano', category: 'Coffee', price: 20000, active: true, recipe: [{ materialId: 'coffee_beans', quantity: 18 }] },
  { id: 'prod_croissant', name: 'Croissant', category: 'Pastries', price: 22000, active: true, recipe: [{ materialId: 'flour', quantity: 100 }, { materialId: 'sugar', quantity: 20 }] },
  { id: 'prod_brownie', name: 'Chocolate Brownie', category: 'Pastries', price: 28000, active: true, recipe: [{ materialId: 'flour', quantity: 50 }, { materialId: 'sugar', quantity: 40 }, { materialId: 'chocolate_chips', quantity: 30 }] },
  { id: 'prod_avocado_toast', name: 'Avocado Toast', category: 'Food', price: 45000, active: true, recipe: [] },
  { id: 'prod_drip_coffee', name: 'Drip Coffee', category: 'Coffee', price: 15000, active: true, recipe: [{ materialId: 'coffee_beans', quantity: 15 }] },
  { id: 'prod_iced_latte', name: 'Iced Latte', category: 'Coffee', price: 28000, active: true, recipe: [{ materialId: 'coffee_beans', quantity: 18 }, { materialId: 'whole_milk', quantity: 200 }] },
  { id: 'prod_cinnamon_roll', name: 'Cinnamon Roll', category: 'Pastries', price: 26000, active: true, recipe: [{ materialId: 'flour', quantity: 120 }, { materialId: 'sugar', quantity: 50 }] },
];

export const defaultRawMaterials: (Omit<RawMaterial, 'createdAt' | 'id'> & { id: string })[] = [
    { id: 'coffee_beans', name: "Coffee Beans", stock: 10000, unit: "g", minimumStock: 2000, averageCost: 200 }, // Rp 200/g
    { id: 'whole_milk', name: "Whole Milk", stock: 20000, unit: "mL", minimumStock: 5000, averageCost: 15 }, // Rp 15/mL
    { id: 'flour', name: "Flour", stock: 50000, unit: "g", minimumStock: 10000, averageCost: 10 }, // Rp 10/g
    { id: 'sugar', name: "Sugar", stock: 30000, unit: "g", minimumStock: 5000, averageCost: 12 }, // Rp 12/g
    { id: 'chocolate_chips', name: "Chocolate Chips", stock: 5000, unit: "g", minimumStock: 1000, averageCost: 50 }, // Rp 50/g
];

export const defaultAssets: Omit<AssetInvestment, 'id' | 'createdAt' | 'purchaseDate'>[] = [
    { name: "Espresso Machine", value: 50000000, depreciationYears: 5 },
    { name: "Coffee Grinder", value: 7500000, depreciationYears: 3 },
    { name: "Tables", value: 1500000, depreciationYears: 10 },
    { name: "Chairs", value: 400000, depreciationYears: 10 },
];

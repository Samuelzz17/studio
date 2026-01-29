
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
  active: boolean;
  createdAt: Timestamp;
};

export type Product = {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  active: boolean;
  createdAt: Timestamp;
};

export type RawMaterial = {
  id: string;
  name: string;
  unit: 'kg' | 'g' | 'L' | 'mL' | 'pcs';
  stock: number;
  minimumStock: number;
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
};

export type Transaction = {
  id: string;
  invoice: string;
  items: TransactionItem[];
  total: number;
  paymentMethod: 'Cash' | 'Card' | 'Bank';
  createdAt: Timestamp;
};

// Default data for seeding
export const defaultProducts: Omit<Product, 'id' | 'createdAt'>[] = [
  { name: 'Espresso', category: 'Coffee', price: 3.0, cost: 0.5, active: true },
  { name: 'Cappuccino', category: 'Coffee', price: 4.5, cost: 0.8, active: true },
  { name: 'Americano', category: 'Coffee', price: 3.5, cost: 0.5, active: true },
  { name: 'Croissant', category: 'Pastries', price: 2.75, cost: 1.0, active: true },
  { name: 'Chocolate Brownie', category: 'Pastries', price: 3.25, cost: 1.2, active: true },
  { name: 'Avocado Toast', category: 'Food', price: 8.5, cost: 3.5, active: true },
  { name: 'Drip Coffee', category: 'Coffee', price: 2.5, cost: 0.4, active: true },
  { name: 'Iced Latte', category: 'Coffee', price: 5.0, cost: 1.0, active: true },
  { name: 'Cinnamon Roll', category: 'Pastries', price: 4.0, cost: 1.5, active: true },
];

export const defaultRawMaterials: Omit<RawMaterial, 'id' | 'createdAt'>[] = [
    { name: "Coffee Beans", stock: 10, unit: "kg", minimumStock: 2 },
    { name: "Whole Milk", stock: 20, unit: "L", minimumStock: 5 },
    { name: "Flour", stock: 50, unit: "kg", minimumStock: 10 },
    { name: "Sugar", stock: 30, unit: "kg", minimumStock: 5 },
    { name: "Chocolate Chips", stock: 5, unit: "kg", minimumStock: 1 },
];

export const defaultAssets: Omit<AssetInvestment, 'id' | 'createdAt' | 'purchaseDate'>[] = [
    { name: "Espresso Machine", value: 5000, depreciationYears: 5 },
    { name: "Coffee Grinder", value: 750, depreciationYears: 3 },
    { name: "Tables", value: 150, depreciationYears: 10 },
    { name: "Chairs", value: 40, depreciationYears: 10 },
];

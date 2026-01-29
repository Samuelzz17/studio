export type Location = {
  id: string;
  name: string;
};

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: 'Coffee' | 'Pastries' | 'Food';
  imageUrl: string;
};

export type RawMaterial = {
  id: string;
  name: string;
  stockLevel: number;
  unitOfMeasurement: string;
  lowStockThreshold: number;
};

export type Asset = {
  id: string;
  name: string;
  quantity: number;
  unitOfMeasurement: string;
};

export type Transaction = {
  id: string;
  timestamp: any; // Firestore Timestamp
  totalCost: number;
  paymentMethod: 'Cash' | 'Card' | 'Bank';
  menuItemIds: string[];
};

export const menuItems: MenuItem[] = [
  {
    id: 'item-1',
    name: 'Espresso',
    description: 'A concentrated coffee beverage brewed by forcing a small amount of nearly boiling water under pressure through finely-ground coffee beans.',
    price: 3.0,
    category: 'Coffee',
    imageUrl: 'https://picsum.photos/seed/1/400/300',
  },
  {
    id: 'item-2',
    name: 'Cappuccino',
    description: 'An espresso-based coffee drink that originated in Italy, and is traditionally prepared with steamed milk foam.',
    price: 4.5,
    category: 'Coffee',
    imageUrl: 'https://picsum.photos/seed/2/400/300',
  },
  {
    id: 'item-3',
    name: 'Americano',
    description: 'A type of coffee drink prepared by diluting an espresso with hot water, giving it a similar strength to, but different flavor from, traditionally brewed coffee.',
    price: 3.5,
    category: 'Coffee',
    imageUrl: 'https://picsum.photos/seed/3/400/300',
  },
  {
    id: 'item-4',
    name: 'Croissant',
    description: 'A buttery, flaky, viennoiserie pastry of Austrian origin, named for its historical crescent shape.',
    price: 2.75,
    category: 'Pastries',
    imageUrl: 'https://picsum.photos/seed/4/400/300',
  },
  {
    id: 'item-5',
    name: 'Chocolate Brownie',
    description: 'A square or rectangular chocolate baked confection. Brownies come in a variety of forms and may be either fudgy or cakey, depending on their density.',
    price: 3.25,
    category: 'Pastries',
    imageUrl: 'https://picsum.photos/seed/5/400/300',
  },
  {
    id: 'item-6',
    name: 'Avocado Toast',
    description: 'Toast topped with mashed avocado, salt, black pepper, and citrus juice.',
    price: 8.5,
    category: 'Food',
    imageUrl: 'https://picsum.photos/seed/6/400/300',
  },
  {
    id: 'item-7',
    name: 'Drip Coffee',
    description: 'Classic brewed coffee, perfect for any time of day.',
    price: 2.5,
    category: 'Coffee',
    imageUrl: 'https://picsum.photos/seed/7/400/300',
  },
  {
    id: 'item-8',
    name: 'Iced Latte',
    description: 'Chilled espresso with milk over ice. A refreshing choice.',
    price: 5.0,
    category: 'Coffee',
    imageUrl: 'https://picsum.photos/seed/8/400/300',
  },
  {
    id: 'item-9',
    name: 'Cinnamon Roll',
    description: 'A sweet roll served commonly in Northern Europe and North America. ',
    price: 4.0,
    category: 'Pastries',
    imageUrl: 'https://picsum.photos/seed/9/400/300',
  },
];

export const rawMaterials: Omit<RawMaterial, 'id'>[] = [
    { name: "Coffee Beans", stockLevel: 10, unitOfMeasurement: "kg", lowStockThreshold: 2 },
    { name: "Whole Milk", stockLevel: 20, unitOfMeasurement: "l", lowStockThreshold: 5 },
    { name: "Flour", stockLevel: 50, unitOfMeasurement: "kg", lowStockThreshold: 10 },
    { name: "Sugar", stockLevel: 30, unitOfMeasurement: "kg", lowStockThreshold: 5 },
    { name: "Chocolate Chips", stockLevel: 5, unitOfMeasurement: "kg", lowStockThreshold: 1 },
];

export const assets: Omit<Asset, 'id'>[] = [
    { name: "Espresso Machine", quantity: 1, unitOfMeasurement: "unit" },
    { name: "Coffee Grinder", quantity: 2, unitOfMeasurement: "unit" },
    { name: "Tables", quantity: 10, unitOfMeasurement: "unit" },
    { name: "Chairs", quantity: 40, unitOfMeasurement: "unit" },
];

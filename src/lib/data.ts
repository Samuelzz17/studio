export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: 'Coffee' | 'Pastries' | 'Food';
  imageUrl: string;
};

export type InventoryItem = {
  id: string;
  name: string;
  stock: number;
  unit: 'kg' | 'liters' | 'units';
  lowStockThreshold: number;
};

export type Sale = {
  id: string;
  customer: string;
  date: string;
  items: { id: string; name: string; quantity: number }[];
  total: number;
  paymentMethod: 'Cash' | 'Card';
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

export const inventory: InventoryItem[] = [
  { id: 'inv-1', name: 'Coffee Beans', stock: 10, unit: 'kg', lowStockThreshold: 5 },
  { id: 'inv-2', name: 'Milk', stock: 5, unit: 'liters', lowStockThreshold: 4 },
  { id: 'inv-3', name: 'Croissants', stock: 20, unit: 'units', lowStockThreshold: 10 },
  { id: 'inv-4', name: 'Chocolate', stock: 8, unit: 'kg', lowStockThreshold: 3 },
  { id: 'inv-5', name: 'Avocado', stock: 15, unit: 'units', lowStockThreshold: 5 },
  { id: 'inv-6', name: 'Bread Loaves', stock: 3, unit: 'units', lowStockThreshold: 2 },
];

export const sales: Sale[] = [
  {
    id: 'sale-1',
    customer: 'John Doe',
    date: '2024-07-28T10:30:00Z',
    items: [
      { id: 'item-1', name: 'Espresso', quantity: 1 },
      { id: 'item-4', name: 'Croissant', quantity: 1 },
    ],
    total: 5.75,
    paymentMethod: 'Card',
  },
  {
    id: 'sale-2',
    customer: 'Jane Smith',
    date: '2024-07-28T10:35:00Z',
    items: [{ id: 'item-2', name: 'Cappuccino', quantity: 2 }],
    total: 9.0,
    paymentMethod: 'Card',
  },
  {
    id: 'sale-3',
    customer: 'Peter Jones',
    date: '2024-07-28T11:05:00Z',
    items: [{ id: 'item-6', name: 'Avocado Toast', quantity: 1 }],
    total: 8.5,
    paymentMethod: 'Cash',
  },
  {
    id: 'sale-4',
    customer: 'Mary Williams',
    date: '2024-07-28T12:15:00Z',
    items: [
      { id: 'item-3', name: 'Americano', quantity: 1 },
      { id: 'item-5', name: 'Chocolate Brownie', quantity: 1 },
    ],
    total: 6.75,
    paymentMethod: 'Card',
  },
  {
    id: 'sale-5',
    customer: 'David Brown',
    date: '2024-07-28T13:00:00Z',
    items: [
      { id: 'item-2', name: 'Cappuccino', quantity: 1 },
      { id: 'item-8', name: 'Iced Latte', quantity: 1 },
    ],
    total: 9.5,
    paymentMethod: 'Card',
  },
  {
    id: 'sale-6',
    customer: 'Olivia Garcia',
    date: '2024-07-28T14:20:00Z',
    items: [{ id: 'item-9', name: 'Cinnamon Roll', quantity: 2 }],
    total: 8.0,
    paymentMethod: 'Cash',
  },
];

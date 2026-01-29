
'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { MoreHorizontal, Plus, ShoppingCart, Loader } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { MenuItem, RawMaterial, Asset } from '@/lib/data';
import { useMemo } from 'react';
import withAuth from '@/components/withAuth';
import { useLocation, LocationSwitcher } from '@/components/LocationContext';

function getStockStatus(stock: number, lowStockThreshold: number) {
  if (stock === 0) return 'outline';
  if (stock <= lowStockThreshold) return 'destructive';
  return 'default';
}

function getStockStatusText(stock: number, lowStockThreshold: number) {
  if (stock === 0) return 'Out of Stock';
  if (stock <= lowStockThreshold) return 'Low Stock';
  return 'In Stock';
}

function InventoryPage() {
  const { firestore, user } = useFirebase();
  const { selectedLocationId } = useLocation();
  const isLocationSelected = selectedLocationId && selectedLocationId !== 'all';

  const productsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !isLocationSelected) return null;
    return collection(firestore, 'users', user.uid, 'locations', selectedLocationId!, 'menuItems');
  }, [firestore, user, selectedLocationId, isLocationSelected]);
  const { data: products, isLoading: isLoadingProducts } = useCollection<MenuItem>(productsQuery);

  const rawMaterialsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !isLocationSelected) return null;
    return collection(firestore, 'users', user.uid, 'locations', selectedLocationId!, 'ingredients');
  }, [firestore, user, selectedLocationId, isLocationSelected]);
  const { data: rawMaterials, isLoading: isLoadingRawMaterials } = useCollection<RawMaterial>(rawMaterialsQuery);

  const assetsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !isLocationSelected) return null;
    return collection(firestore, 'users', user.uid, 'locations', selectedLocationId!, 'assets');
  }, [firestore, user, selectedLocationId, isLocationSelected]);
  const { data: assets, isLoading: isLoadingAssets } = useCollection<Asset>(assetsQuery);

  const allItems = useMemo(() => {
    const combined = [];
    if (products) combined.push(...products.map(p => ({...p, type: 'Product'})));
    if (rawMaterials) combined.push(...rawMaterials.map(r => ({...r, type: 'Raw Material'})));
    if (assets) combined.push(...assets.map(a => ({...a, type: 'Asset'})));
    return combined;
  }, [products, rawMaterials, assets]);

  const isLoading = isLoadingProducts || isLoadingRawMaterials || isLoadingAssets;
  
  const renderContent = () => {
    if (!isLocationSelected) {
      return (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm mt-8">
          <div className="flex flex-col items-center gap-1 text-center">
            <h3 className="text-2xl font-bold tracking-tight">
              Please select a location
            </h3>
            <p className="text-sm text-muted-foreground">
              You need to select a location from the dropdown above to see inventory.
            </p>
          </div>
        </div>
      );
    }
    return (
        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="raw-materials">Raw Materials</TabsTrigger>
            <TabsTrigger value="assets">Assets</TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <Card>
              <CardHeader>
                <CardTitle>All Inventory Items</CardTitle>
                <CardDescription>A complete list of all items across all categories.</CardDescription>
              </CardHeader>
              <CardContent>
                {renderTable(
                  allItems,
                  [
                    { key: 'name', label: 'Name' },
                    { key: 'type', label: 'Type', render: (item) => <Badge variant="secondary">{item.type}</Badge> },
                    { key: 'details', label: 'Details', render: (item) => {
                      switch(item.type) {
                        case 'Product': return `$${item.price.toFixed(2)}`;
                        case 'Raw Material': return `${item.stockLevel} ${item.unitOfMeasurement}`;
                        case 'Asset': return `${item.quantity} ${item.unitOfMeasurement}`;
                        default: return '-';
                      }
                    }},
                  ],
                  'No inventory items found.'
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle>Products</CardTitle>
                <CardDescription>Items that appear on your POS for sale.</CardDescription>
              </CardHeader>
              <CardContent>
                {renderTable(
                  products,
                  [
                    { key: 'name', label: 'Name' },
                    { key: 'category', label: 'Category' },
                    { key: 'price', label: 'Price', render: (item) => `$${item.price.toFixed(2)}` },
                  ],
                  'No products found.'
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="raw-materials">
            <Card>
              <CardHeader>
                <CardTitle>Raw Materials</CardTitle>
                <CardDescription>Ingredients and supplies used to create products.</CardDescription>
              </CardHeader>
              <CardContent>
                {renderTable(
                  rawMaterials,
                  [
                    { key: 'name', label: 'Item' },
                    { key: 'status', label: 'Status', render: (item) => (
                      <Badge variant={getStockStatus(item.stockLevel, item.lowStockThreshold)}>
                        {getStockStatusText(item.stockLevel, item.lowStockThreshold)}
                      </Badge>
                    )},
                    { key: 'stock', label: 'Stock', render: (item) => `${item.stockLevel} ${item.unitOfMeasurement}` },
                  ],
                  'No raw materials found.'
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="assets">
            <Card>
              <CardHeader>
                <CardTitle>Assets</CardTitle>
                <CardDescription>Non-sellable items like equipment and furniture.</CardDescription>
              </CardHeader>
              <CardContent>
                {renderTable(
                  assets,
                  [
                    { key: 'name', label: 'Item' },
                    { key: 'quantity', label: 'Quantity', render: (item) => `${item.quantity} ${item.unitOfMeasurement}` },
                  ],
                  'No assets found.'
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
    );
  };

  const renderTable = (
    data: any[] | null,
    columns: { key: string; label: string; render?: (item: any) => React.ReactNode }[],
    emptyMessage: string
  ) => (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead key={col.key}>{col.label}</TableHead>
          ))}
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow>
            <TableCell colSpan={columns.length + 1} className="text-center">
              <Loader className="h-6 w-6 animate-spin mx-auto" />
            </TableCell>
          </TableRow>
        ) : data && data.length > 0 ? (
          data.map((item) => (
            <TableRow key={item.id}>
              {columns.map((col) => (
                <TableCell key={col.key}>
                  {col.render ? col.render(item) : item[col.key]}
                </TableCell>
              ))}
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button aria-haspopup="true" size="icon" variant="ghost">
                      <MoreHorizontal className="h-4 w-4" />
                      <span className="sr-only">Toggle menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem>Edit</DropdownMenuItem>
                    <DropdownMenuItem>Purchase</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive">
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell colSpan={columns.length + 1} className="text-center">
              {emptyMessage}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
        <div className="md:hidden">
          <SidebarTrigger />
        </div>
        <div className="flex-1">
          <h1 className="font-headline text-xl font-semibold md:text-2xl">
            Inventory
          </h1>
        </div>
        <div className="flex items-center gap-2">
            <LocationSwitcher />
          <Button size="sm" variant="outline" disabled={!isLocationSelected}>
             <ShoppingCart className="h-4 w-4 mr-2" />
            Purchase Item
          </Button>
          <Button size="sm" disabled={!isLocationSelected}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        {renderContent()}
      </main>
    </div>
  );
}

export default withAuth(InventoryPage);

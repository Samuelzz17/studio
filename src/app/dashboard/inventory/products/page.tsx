
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
import type { MenuItem } from '@/lib/data';
import { useLocation, LocationSwitcher } from '@/components/LocationContext';

export default function ProductsPage() {
  const { firestore, user } = useFirebase();
  const { selectedLocationId } = useLocation();
  const isLocationSelected = selectedLocationId && selectedLocationId !== 'all';

  const productsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !isLocationSelected) return null;
    return collection(firestore, 'users', user.uid, 'locations', selectedLocationId!, 'menuItems');
  }, [firestore, user, selectedLocationId, isLocationSelected]);
  const { data: products, isLoading: isLoadingProducts } = useCollection<MenuItem>(productsQuery);
  
  const renderContent = () => {
    if (!isLocationSelected) {
      return (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm mt-8">
          <div className="flex flex-col items-center gap-1 text-center">
            <h3 className="text-2xl font-bold tracking-tight">
              Please select a location
            </h3>
            <p className="text-sm text-muted-foreground">
              You need to select a location to see the products.
            </p>
          </div>
        </div>
      );
    }
    return (
        <Card>
          <CardHeader>
            <CardTitle>Products</CardTitle>
            <CardDescription>Items that appear on your POS for sale.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingProducts ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      <Loader className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : products && products.length > 0 ? (
                  products.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell>${item.price.toFixed(2)}</TableCell>
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
                    <TableCell colSpan={4} className="text-center">
                      No products found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
    );
  };

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
        <div className="md:hidden">
          <SidebarTrigger />
        </div>
        <div className="flex-1">
          <h1 className="font-headline text-xl font-semibold md:text-2xl">
            Inventory: Products
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

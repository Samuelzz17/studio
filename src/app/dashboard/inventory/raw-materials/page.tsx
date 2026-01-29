
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
import type { RawMaterial } from '@/lib/data';
import { useOutlet, OutletSwitcher } from '@/components/OutletContext';

function getStockStatus(stock: number, minimumStock: number) {
  if (stock === 0) return 'outline';
  if (stock <= minimumStock) return 'destructive';
  return 'default';
}

function getStockStatusText(stock: number, minimumStock: number) {
  if (stock === 0) return 'Out of Stock';
  if (stock <= minimumStock) return 'Low Stock';
  return 'In Stock';
}

export default function RawMaterialsPage() {
  const { firestore } = useFirebase();
  const { selectedOutletId } = useOutlet();
  const isOutletSelected = selectedOutletId && selectedOutletId !== 'all';

  const rawMaterialsQuery = useMemoFirebase(() => {
    if (!firestore || !isOutletSelected) return null;
    return collection(firestore, 'outlets', selectedOutletId!, 'raw_materials');
  }, [firestore, selectedOutletId, isOutletSelected]);

  const { data: rawMaterials, isLoading: isLoadingRawMaterials } = useCollection<RawMaterial>(rawMaterialsQuery);

  const renderContent = () => {
    if (!isOutletSelected) {
      return (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm mt-8">
          <div className="flex flex-col items-center gap-1 text-center">
            <h3 className="text-2xl font-bold tracking-tight">
              Please select an outlet
            </h3>
            <p className="text-sm text-muted-foreground">
              You need to select an outlet to see raw materials.
            </p>
          </div>
        </div>
      );
    }
    return (
        <Card>
          <CardHeader>
            <CardTitle>Raw Materials</CardTitle>
            <CardDescription>Ingredients and supplies used to create products.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingRawMaterials ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      <Loader className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : rawMaterials && rawMaterials.length > 0 ? (
                  rawMaterials.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>
                        <Badge variant={getStockStatus(item.stock, item.minimumStock)}>
                          {getStockStatusText(item.stock, item.minimumStock)}
                        </Badge>
                      </TableCell>
                      <TableCell>{`${item.stock} ${item.unit}`}</TableCell>
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
                      No raw materials found.
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
            Inventory: Raw Materials
          </h1>
        </div>
        <div className="flex items-center gap-2">
            <OutletSwitcher />
          <Button size="sm" variant="outline" disabled={!isOutletSelected}>
             <ShoppingCart className="h-4 w-4 mr-2" />
            Purchase Item
          </Button>
          <Button size="sm" disabled={!isOutletSelected}>
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

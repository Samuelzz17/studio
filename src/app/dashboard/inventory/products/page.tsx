
'use client';

import { useState, useMemo, useCallback } from 'react';
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
import { MoreHorizontal, Plus, Loader } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import type { Product, RawMaterial } from '@/lib/data';
import { useOutlet, OutletSwitcher } from '@/components/OutletContext';
import { formatCurrency } from '@/lib/currency';
import { ProductForm, type ProductFormData } from '@/components/forms/ProductForm';
import { useToast } from '@/hooks/use-toast';

export default function ProductsPage() {
  const { firestore } = useFirebase();
  const { activeOutlet, loading: isLoadingOutlets } = useOutlet();
  const { toast } = useToast();
  const isOutletSelected = !!activeOutlet;

  // Form state
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const productsQuery = useMemoFirebase(() => {
    if (!firestore || !activeOutlet) return null;
    return collection(firestore, 'outlets', activeOutlet.id, 'inventory_products');
  }, [firestore, activeOutlet]);

  const rawMaterialsQuery = useMemoFirebase(() => {
    if (!firestore || !activeOutlet) return null;
    return collection(firestore, 'outlets', activeOutlet.id, 'inventory_raw_materials');
  }, [firestore, activeOutlet]);

  const { data: products, isLoading: isLoadingProducts } = useCollection<Product>(productsQuery);
  const { data: rawMaterials, isLoading: isLoadingRawMaterials } = useCollection<RawMaterial>(rawMaterialsQuery);
  
  const rawMaterialsMap = useMemo(() => {
    if (!rawMaterials) return new Map<string, RawMaterial>();
    return new Map(rawMaterials.map(m => [m.id, m]));
  }, [rawMaterials]);
  
  const calculateProductCost = useCallback((product: Product) => {
    if (!product.recipe || product.recipe.length === 0) return 0;
    return product.recipe.reduce((acc, recipeItem) => {
      const material = rawMaterialsMap.get(recipeItem.materialId);
      const materialCost = material ? material.averageCost : 0;
      return acc + (materialCost * recipeItem.quantity);
    }, 0);
  }, [rawMaterialsMap]);
  
  const calculateProducibleQty = useCallback((product: Product) => {
    if (!product.recipe || product.recipe.length === 0) return Infinity; // Can produce if no ingredients needed
    const stockRatios = product.recipe.map(recipeItem => {
      const material = rawMaterialsMap.get(recipeItem.materialId);
      const stock = material ? material.stock : 0;
      if (recipeItem.quantity === 0) return Infinity; // Avoid division by zero
      return Math.floor(stock / recipeItem.quantity);
    });
    return Math.min(...stockRatios);
  }, [rawMaterialsMap]);
  
  const handleSaveProduct = (values: ProductFormData) => {
    if (!productsQuery) return;
    setIsSubmitting(true);
    const collectionRef = productsQuery.withConverter(null);
    
    const newDoc = {
      ...values,
      active: values.active ?? true,
      recipe: values.recipe ?? [],
      createdAt: serverTimestamp(),
    };
    addDocumentNonBlocking(collectionRef, newDoc);
    toast({
      title: 'Success!',
      description: `${values.name} has been added.`
    });
    setIsSheetOpen(false);
    setIsSubmitting(false);
  };
  
  const renderContent = () => {
     if (isLoadingOutlets || isLoadingRawMaterials) {
      return (
        <div className="flex flex-1 items-center justify-center">
            <Loader className="h-8 w-8 animate-spin" />
        </div>
       );
    }
    if (!isOutletSelected) {
      return (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm mt-8">
          <div className="flex flex-col items-center gap-1 text-center">
            <h3 className="text-2xl font-bold tracking-tight">
              Please select an outlet
            </h3>
            <p className="text-sm text-muted-foreground">
              You need to select an outlet to see the products.
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
                  <TableHead>Calculated Cost</TableHead>
                  <TableHead>Producible Qty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingProducts ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
                      <Loader className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : products && products.length > 0 ? (
                  products.filter(item => item.id !== '_init').map((item) => {
                    const producibleQty = calculateProducibleQty(item);
                    const isAvailable = producibleQty > 0 && item.active;
                    return (
                      <TableRow key={item.id}>
                        <TableCell>{item.name}</TableCell>
                        <TableCell>{item.category}</TableCell>
                        <TableCell>{formatCurrency(item.price)}</TableCell>
                        <TableCell>{formatCurrency(calculateProductCost(item))}</TableCell>
                        <TableCell>{isFinite(producibleQty) ? producibleQty : 'N/A'}</TableCell>
                         <TableCell>
                          <Badge variant={isAvailable ? 'default' : 'destructive'}>
                              {isAvailable ? 'Available' : 'Unavailable'}
                          </Badge>
                        </TableCell>
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
                              <DropdownMenuItem className="text-destructive">
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
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
            <OutletSwitcher />
          <Button size="sm" disabled={!isOutletSelected} onClick={() => setIsSheetOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        {renderContent()}
      </main>
      
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-2xl flex flex-col">
            <SheetHeader>
                <SheetTitle>Add New Product</SheetTitle>
                <SheetDescription>
                    Define a new product including its recipe from available raw materials.
                </SheetDescription>
            </SheetHeader>
            <div className="py-4 overflow-y-auto">
                {rawMaterials && (
                    <ProductForm 
                        rawMaterials={rawMaterials} 
                        onSubmit={handleSaveProduct} 
                        isSubmitting={isSubmitting}
                    />
                )}
            </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

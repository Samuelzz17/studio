'use client';

import { useState } from 'react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import {
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
} from '@/firebase/non-blocking-updates';
import type { RawMaterial } from '@/lib/data';
import { useOutlet, OutletSwitcher } from '@/components/OutletContext';
import { RawMaterialForm, type RawMaterialFormData } from '@/components/forms/RawMaterialForm';
import { UpdateStockForm, type UpdateStockFormData } from '@/components/forms/UpdateStockForm';
import { useToast } from '@/hooks/use-toast';


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
  const { activeOutlet, loading: isLoadingOutlets } = useOutlet();
  const { toast } = useToast();
  const isOutletSelected = !!activeOutlet;

  // State for forms/dialogs
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [selectedItemForPurchase, setSelectedItemForPurchase] = useState<RawMaterial | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);


  const rawMaterialsCollectionRef = useMemoFirebase(() => {
    if (!firestore || !activeOutlet) return null;
    return collection(firestore, 'outlets', activeOutlet.id, 'inventory_raw_materials');
  }, [firestore, activeOutlet]);

  const { data: rawMaterials, isLoading: isLoadingRawMaterials } = useCollection<RawMaterial>(rawMaterialsCollectionRef);

  const handleOpenPurchaseDialog = (item: RawMaterial) => {
    setSelectedItemForPurchase(item);
    setIsPurchaseDialogOpen(true);
  }

  const handleAddRawMaterial = (values: RawMaterialFormData) => {
    if (!rawMaterialsCollectionRef) return;
    setIsSubmitting(true);
    
    const newDoc = {
        ...values,
        createdAt: serverTimestamp(),
    };
    addDocumentNonBlocking(rawMaterialsCollectionRef, newDoc);
    toast({
        title: 'Success!',
        description: `${values.name} has been added to your raw materials.`,
    });
    setIsAddSheetOpen(false);
    setIsSubmitting(false);
  };

  const handlePurchaseItem = (values: UpdateStockFormData) => {
    if (!firestore || !activeOutlet || !selectedItemForPurchase) return;
    setIsSubmitting(true);

    const itemRef = doc(firestore, 'outlets', activeOutlet.id, 'inventory_raw_materials', selectedItemForPurchase.id);
    const newStock = selectedItemForPurchase.stock + values.quantity;
    updateDocumentNonBlocking(itemRef, { stock: newStock });
    toast({
        title: 'Stock Updated!',
        description: `Stock for ${selectedItemForPurchase.name} is now ${newStock}.`,
    });
    setIsPurchaseDialogOpen(false);
    setSelectedItemForPurchase(null);
    setIsSubmitting(false);
  };


  const renderContent = () => {
    if (isLoadingOutlets) {
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
                  rawMaterials.filter(item => item.id !== '_init').map((item) => (
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
                            <DropdownMenuItem onClick={() => handleOpenPurchaseDialog(item)}>
                              Purchase
                            </DropdownMenuItem>
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
          <Button size="sm" variant="outline" disabled>
             <ShoppingCart className="h-4 w-4 mr-2" />
            Purchase Item
          </Button>
          <Sheet open={isAddSheetOpen} onOpenChange={setIsAddSheetOpen}>
            <SheetTrigger asChild>
              <Button size="sm" disabled={!isOutletSelected}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </SheetTrigger>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>Add New Raw Material</SheetTitle>
                    <SheetDescription>
                        Fill in the details for the new inventory item.
                    </SheetDescription>
                </SheetHeader>
                <div className="py-4">
                    <RawMaterialForm onSubmit={handleAddRawMaterial} isSubmitting={isSubmitting} />
                </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        {renderContent()}
      </main>

      {/* Purchase Item Dialog */}
      <Dialog open={isPurchaseDialogOpen} onOpenChange={(isOpen) => {
          setIsPurchaseDialogOpen(isOpen);
          if (!isOpen) setSelectedItemForPurchase(null);
      }}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Purchase Raw Material</DialogTitle>
                <DialogDescription>
                    Update the stock for an existing item.
                </DialogDescription>
            </DialogHeader>
            <div className="py-4">
                {selectedItemForPurchase && (
                    <UpdateStockForm 
                        item={selectedItemForPurchase}
                        onSubmit={handlePurchaseItem}
                        isSubmitting={isSubmitting}
                    />
                )}
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

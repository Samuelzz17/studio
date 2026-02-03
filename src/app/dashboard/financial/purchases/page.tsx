'use client';

import { useState } from 'react';
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
import { Loader, Plus } from 'lucide-react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, doc, serverTimestamp, runTransaction, query, orderBy } from 'firebase/firestore';
import type { Purchase, RawMaterial } from '@/lib/data';
import { useOutlet, OutletSwitcher } from '@/components/OutletContext';
import { formatCurrency } from '@/lib/currency';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PurchaseForm, type PurchaseFormData } from '@/components/forms/PurchaseForm';
import { useToast } from '@/hooks/use-toast';


export default function PurchasesPage() {
  const { firestore } = useFirebase();
  const { activeOutlet, loading: isLoadingOutlets } = useOutlet();
  const { toast } = useToast();
  const isOutletSelected = !!activeOutlet;
  
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const purchasesQuery = useMemoFirebase(() => {
    if (!firestore || !activeOutlet) return null;
    return query(collection(firestore, 'outlets', activeOutlet.id, 'purchases'), orderBy('createdAt', 'desc'));
  }, [firestore, activeOutlet]);
  
  const rawMaterialsQuery = useMemoFirebase(() => {
    if (!firestore || !activeOutlet) return null;
    return collection(firestore, 'outlets', activeOutlet.id, 'inventory_raw_materials');
  }, [firestore, activeOutlet]);

  const { data: purchases, isLoading: isLoadingPurchases } = useCollection<Purchase>(purchasesQuery);
  const { data: rawMaterials, isLoading: isLoadingRawMaterials } = useCollection<RawMaterial>(rawMaterialsQuery);

  const handleRecordPurchase = async (values: PurchaseFormData) => {
    if (!firestore || !activeOutlet || !rawMaterials) return;
    
    const selectedMaterial = rawMaterials.find(m => m.id === values.materialId);
    if (!selectedMaterial) {
        toast({
            title: 'Error',
            description: 'Selected material not found.',
            variant: 'destructive',
        });
        return;
    }
    
    setIsSubmitting(true);

    try {
        await runTransaction(firestore, async (transaction) => {
            const materialRef = doc(firestore, 'outlets', activeOutlet.id, 'inventory_raw_materials', values.materialId);
            const purchaseRef = doc(collection(firestore, 'outlets', activeOutlet.id, 'purchases'));

            const materialSnap = await transaction.get(materialRef);
            if (!materialSnap.exists()) {
                throw "Material document does not exist!";
            }
            const currentStock = materialSnap.data().stock;
            const newStock = currentStock + values.quantity;

            transaction.update(materialRef, { stock: newStock });

            const newPurchase: Omit<Purchase, 'id' | 'createdAt'> & { createdAt: any } = {
                materialName: selectedMaterial.name,
                materialId: values.materialId,
                quantity: values.quantity,
                unit: selectedMaterial.unit,
                totalCost: values.totalCost,
                supplier: values.supplier,
                createdAt: serverTimestamp(),
            };
            transaction.set(purchaseRef, newPurchase);
        });

        toast({
            title: 'Success!',
            description: `Purchase for ${selectedMaterial.name} has been recorded.`,
        });
        setIsPurchaseDialogOpen(false);
    } catch (e: any) {
        console.error("Transaction failed: ", e);
        toast({
            title: 'Uh oh! Something went wrong.',
            description: e.message || 'Could not record the purchase.',
            variant: 'destructive',
        });
    } finally {
        setIsSubmitting(false);
    }
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
              You need to select an outlet to see its purchases.
            </p>
          </div>
        </div>
      );
    }
    return (
        <Card>
          <CardHeader>
            <CardTitle>Purchase History</CardTitle>
            <CardDescription>A log of all raw material purchases.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Total Cost</TableHead>
                  <TableHead>Supplier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingPurchases ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      <Loader className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : purchases && purchases.length > 0 ? (
                  purchases.filter(item => item.id !== '_init').map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        {item.createdAt ? format(item.createdAt.toDate(), 'PPP') : 'N/A'}
                      </TableCell>
                      <TableCell>{item.materialName}</TableCell>
                      <TableCell>{item.quantity} {item.unit}</TableCell>
                      <TableCell>{formatCurrency(item.totalCost)}</TableCell>
                      <TableCell>{item.supplier || '-'}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      No purchases found.
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
            Financial: Purchases
          </h1>
        </div>
        <div className="flex items-center gap-2">
            <OutletSwitcher />
            <Dialog open={isPurchaseDialogOpen} onOpenChange={setIsPurchaseDialogOpen}>
                <DialogTrigger asChild>
                    <Button size="sm" disabled={!isOutletSelected || isLoadingRawMaterials}>
                        <Plus className="h-4 w-4 mr-2" />
                        Purchase Item
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[480px]">
                    <DialogHeader>
                        <DialogTitle>Record New Purchase</DialogTitle>
                        <DialogDescription>
                            Select a raw material and enter the purchase details. This will automatically update your stock.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                       {rawMaterials && (
                         <PurchaseForm
                            rawMaterials={rawMaterials}
                            onSubmit={handleRecordPurchase}
                            isSubmitting={isSubmitting}
                         />
                       )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        {renderContent()}
      </main>
    </div>
  );
}

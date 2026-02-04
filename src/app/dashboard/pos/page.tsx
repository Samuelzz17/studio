
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import type { Product, RawMaterial, Transaction } from '@/lib/data';
import { PlusCircle, MinusCircle, X, CircleDollarSign, Loader, Printer, QrCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirebase, useMemoFirebase, useCollection } from '@/firebase';
import { collection, serverTimestamp, runTransaction, doc, increment, Timestamp } from 'firebase/firestore';
import { useOutlet } from '@/components/OutletContext';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/currency';
import { TransactionReceipt } from '@/components/TransactionReceipt';

type OrderItem = Product & { quantity: number };

export default function POSPage() {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [isCheckoutSheetOpen, setIsCheckoutSheetOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // State for receipt
  const [completedTransaction, setCompletedTransaction] = useState<Transaction | null>(null);

  const { toast } = useToast();
  const { firestore, user } = useFirebase();
  const { activeOutlet, loading: isLoadingOutlets } = useOutlet();
  const router = useRouter();

  // Redirect if no outlet is selected
  useEffect(() => {
    if (!isLoadingOutlets && !activeOutlet) {
      toast({
        title: 'No Outlet Selected',
        description: 'Please select an outlet from the dashboard to open POS.',
        variant: 'destructive',
      });
      router.push('/dashboard');
    }
  }, [activeOutlet, isLoadingOutlets, router, toast]);

  const menuItemsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !activeOutlet) return null;
    return collection(firestore, `outlets/${activeOutlet.id}/inventory_products`);
  }, [firestore, user, activeOutlet]);

  const rawMaterialsQuery = useMemoFirebase(() => {
    if (!firestore || !activeOutlet) return null;
    return collection(firestore, 'outlets', activeOutlet.id, 'inventory_raw_materials');
  }, [firestore, activeOutlet]);

  const { data: menuItems, isLoading: isLoadingMenu } = useCollection<Product>(menuItemsQuery);
  const { data: rawMaterials, isLoading: isLoadingRawMaterials } = useCollection<RawMaterial>(rawMaterialsQuery);

  const menuItemsMap = useMemo(() => {
    if (!menuItems) return new Map<string, Product>();
    return new Map(menuItems.map(item => [item.id, item]));
  }, [menuItems]);

  const rawMaterialsMap = useMemo(() => {
    if (!rawMaterials) return new Map<string, RawMaterial>();
    return new Map(rawMaterials.map(m => [m.id, m]));
  }, [rawMaterials]);

  const calculateProducibleQty = useCallback((product: Product) => {
    if (!product.recipe || product.recipe.length === 0) return Infinity;
    const stockRatios = product.recipe.map(recipeItem => {
      const material = rawMaterialsMap.get(recipeItem.materialId);
      const stock = material ? material.stock : 0;
      if (recipeItem.quantity === 0) return Infinity;
      return Math.floor(stock / recipeItem.quantity);
    });
    return Math.min(...stockRatios);
  }, [rawMaterialsMap]);

  const handleAddItem = (productToAdd: Product) => {
    const currentQtyInCart = orderItems
      .filter((item) => item.id === productToAdd.id)
      .reduce((sum, item) => sum + item.quantity, 0);
    
    const producibleQty = calculateProducibleQty(productToAdd);

    if (currentQtyInCart + 1 > producibleQty) {
        toast({
            title: 'Stock Limit Reached',
            description: `Cannot add more ${productToAdd.name}. Only ${producibleQty} can be produced.`,
            variant: 'destructive',
        });
        return;
    }

    setOrderItems((prevItems) => {
      const existingItemIndex = prevItems.findIndex(
        (i) => i.id === productToAdd.id
      );

      if (existingItemIndex > -1) {
        const newItems = [...prevItems];
        const item = newItems[existingItemIndex];
        newItems[existingItemIndex] = { ...item, quantity: item.quantity + 1 };
        return newItems;
      }
      
      return [...prevItems, { ...productToAdd, quantity: 1 }];
    });
    toast({
      title: 'Item Added',
      description: `${productToAdd.name} was added to the order.`,
    });
  };

  const handleUpdateQuantity = (productId: string, amount: number) => {
    if (amount > 0) {
        const product = menuItemsMap.get(productId);
        if (!product) return;

        const currentQtyInCart = orderItems
            .filter(item => item.id === productId)
            .reduce((sum, item) => sum + item.quantity, 0);
        
        const producibleQty = calculateProducibleQty(product);

        if (currentQtyInCart + amount > producibleQty) {
            toast({
                title: 'Stock Limit Reached',
                description: `Cannot add more ${product.name}. Only ${producibleQty} can be produced.`,
                variant: 'destructive',
            });
            return;
        }
    }

    setOrderItems((prevItems) => {
      return prevItems
        .map((item) => {
          if (item.id === productId) {
            return { ...item, quantity: item.quantity + amount };
          }
          return item;
        })
        .filter((item) => item.quantity > 0);
    });
  };

  const { subtotal, tax, total } = useMemo(() => {
    const subtotal = orderItems.reduce(
      (acc, item) => acc + item.price * item.quantity,
      0
    );
    const tax = subtotal * 0.11; // 11% tax
    const total = subtotal + tax;
    return { subtotal, tax, total };
  }, [orderItems]);

  const handleClearOrder = () => {
    setOrderItems([]);
    setCustomerName('');
    toast({
        title: "Order Cleared",
        description: "The current order has been cleared.",
        variant: "destructive"
    })
  }
  
  const handleCheckout = async (paymentMethod: 'Cash' | 'QRIS') => {
    if (!firestore || !activeOutlet || orderItems.length === 0 || !menuItems || isSubmitting) return;
    
    setIsSubmitting(true);
    const newTransactionRef = doc(collection(firestore, `outlets/${activeOutlet.id}/sales`));
    const invoiceId = `INV-${Date.now()}`;

    try {
      const finalTransactionData: Transaction = {
        id: newTransactionRef.id,
        invoice: invoiceId,
        customerName: customerName.trim() === '' ? 'Anonymous' : customerName,
        items: orderItems.map(item => ({
          productId: item.id,
          qty: item.quantity,
          price: item.price,
          preference: 'normal',
        })),
        total: total,
        paymentMethod,
        createdAt: Timestamp.now(), // Use a consistent server-side timestamp
      };

      await runTransaction(firestore, async (transaction) => {
        const stockDeductions = new Map<string, number>();

        // 1. Calculate total stock deductions and check availability
        for (const orderItem of orderItems) {
          const product = menuItemsMap.get(orderItem.id);
          if (product?.recipe) {
            for (const recipeItem of product.recipe) {
              const currentDeduction = stockDeductions.get(recipeItem.materialId) || 0;
              stockDeductions.set(recipeItem.materialId, currentDeduction + (recipeItem.quantity * orderItem.quantity));
            }
          }
        }
        
        for (const [materialId, toDeduct] of stockDeductions.entries()) {
          const materialRef = doc(firestore, `outlets/${activeOutlet.id}/inventory_raw_materials/${materialId}`);
          const materialSnap = await transaction.get(materialRef);
          if (!materialSnap.exists() || materialSnap.data().stock < toDeduct) {
            const material = rawMaterialsMap.get(materialId);
            throw new Error(`Insufficient stock for: ${material?.name || 'Unknown Item'}`);
          }
        }

        // 2. Perform stock updates
        for (const [materialId, decrementAmount] of stockDeductions.entries()) {
          const materialRef = doc(firestore, `outlets/${activeOutlet.id}/inventory_raw_materials/${materialId}`);
          transaction.update(materialRef, { stock: increment(-decrementAmount) });
        }
        
        // 3. Create sales record
        const { id, ...transactionToSave } = finalTransactionData;
        transaction.set(newTransactionRef, transactionToSave);
      });

      const paymentMethodDisplay = { 'Cash': 'Tunai', 'QRIS': 'QRIS' };
      toast({
          title: "Pesanan Berhasil!",
          description: `Total: ${formatCurrency(total)} dibayar dengan ${paymentMethodDisplay[paymentMethod]}.`,
      });
      
      setCompletedTransaction(finalTransactionData);
      setOrderItems([]);
      setCustomerName('');
      setIsCheckoutSheetOpen(false);

    } catch (e: any) {
      console.error("Checkout transaction failed: ", e);
      toast({
        title: 'Checkout Failed',
        description: e.message || 'Could not complete the transaction.',
        variant: 'destructive',
      });
    } finally {
        setIsSubmitting(false);
    }
  }

  const handlePrintReceipt = () => {
    const receiptContent = document.getElementById('receipt-content-wrapper');
    if (receiptContent) {
        const printWindow = window.open('', '', 'height=600,width=800');
        printWindow?.document.write('<html><head><title>Print Receipt</title>');
        // The global styles in `globals.css` will handle the print layout
        // by hiding everything except the receipt content.
         printWindow?.document.write('<link rel="stylesheet" href="/globals.css" media="print" />');
         printWindow?.document.write(`
            <style>
                @media print {
                  body {
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                  }
                }
            </style>
        `);
        printWindow?.document.write('</head><body>');
        printWindow?.document.write(receiptContent.innerHTML);
        printWindow?.document.write('</body></html>');
        printWindow?.document.close();
        printWindow?.focus();
        setTimeout(() => {
             printWindow?.print();
        }, 500); // Allow time for content to render
    }
  };


  const renderContent = () => {
    if (isLoadingOutlets || !activeOutlet || isLoadingRawMaterials) {
       return (
        <div className="flex flex-1 items-center justify-center">
            <Loader className="h-8 w-8 animate-spin" />
            {!isLoadingOutlets && !activeOutlet && <p className="ml-4 text-muted-foreground">Redirecting...</p>}
        </div>
       );
    }

    if (isLoadingMenu) {
        return (
        <div className="flex flex-1 items-center justify-center">
            <Loader className="h-8 w-8 animate-spin" />
        </div>
       );
    }
    
    return (
       <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {menuItems?.filter(item => item.id !== '_init' && item.active).map((item) => {
                const producibleQty = calculateProducibleQty(item);
                const isAvailable = producibleQty > 0;
                return (
                  <Card
                    key={item.id}
                    className="overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-200 data-[disabled=true]:opacity-50 data-[disabled=true]:cursor-not-allowed data-[disabled=true]:ring-2 data-[disabled=true]:ring-destructive/50"
                    onClick={() => isAvailable && handleAddItem(item)}
                    data-disabled={!isAvailable}
                  >
                    <div className="relative">
                      <Image
                        src={`https://picsum.photos/seed/${item.id}/400/300`}
                        alt={item.name}
                        width={400}
                        height={300}
                        className="aspect-video w-full object-cover"
                        data-ai-hint={`${item.category.toLowerCase()} food`}
                      />
                      {!isAvailable && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <p className="text-white font-bold text-lg">Out of Stock</p>
                        </div>
                      )}
                    </div>
                    <CardHeader className="p-4">
                      <CardTitle className="text-lg">{item.name}</CardTitle>
                      <p className="font-semibold text-primary">
                        {formatCurrency(item.price)}
                      </p>
                    </CardHeader>
                  </Card>
                )
              })}
            </div>
          </div>
          <Card className="md:col-span-1 lg:col-span-1 flex flex-col h-fit sticky top-24">
            <CardHeader>
              <CardTitle>Current Order</CardTitle>
              <CardDescription>Items added will appear here</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4">
              {orderItems.length === 0 ? (
                <p className="text-muted-foreground text-center">
                  No items in order
                </p>
              ) : (
                <div className="space-y-4">
                  {orderItems.map((item) => (
                    <div key={item.id} className="flex items-center gap-4">
                      <Image
                        src={`https://picsum.photos/seed/${item.id}/64/64`}
                        alt={item.name}
                        width={64}
                        height={64}
                        className="rounded-md object-cover aspect-square"
                      />
                      <div className="flex-1">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatCurrency(item.price)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleUpdateQuantity(item.id, -1)}
                        >
                          <MinusCircle className="h-4 w-4" />
                        </Button>
                        <span className="font-bold w-4 text-center">{item.quantity}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleUpdateQuantity(item.id, 1)}
                        >
                          <PlusCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
            {orderItems.length > 0 && (
            <CardFooter className="flex flex-col gap-4 p-4 bg-muted/50">
                <div className="w-full space-y-2">
                    <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Taxes (11%)</span>
                        <span>{formatCurrency(tax)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                        <span>Total</span>
                        <span>{formatCurrency(total)}</span>
                    </div>
                </div>
                <div className="w-full grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={handleClearOrder}>
                    <X className="mr-2 h-4 w-4"/> Clear
                  </Button>
                  <Sheet open={isCheckoutSheetOpen} onOpenChange={setIsCheckoutSheetOpen}>
                    <SheetTrigger asChild>
                      <Button>Checkout</Button>
                    </SheetTrigger>
                    <SheetContent>
                      <SheetHeader>
                        <SheetTitle>Complete Payment</SheetTitle>
                        <SheetDescription>Enter customer details and select a payment method to finalize the order.</SheetDescription>
                      </SheetHeader>
                      <div className="py-8">
                         <div className="mb-6 space-y-2">
                            <Label htmlFor="customer-name">Customer Name</Label>
                            <Input
                                id="customer-name"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                placeholder="Anonymous"
                                disabled={isSubmitting}
                            />
                         </div>
                         <div className="flex justify-between font-bold text-xl mb-6">
                            <span>Total</span>
                            <span>{formatCurrency(total)}</span>
                        </div>
                        <div className="space-y-4">
                            <Button className="w-full h-16 text-lg" onClick={() => handleCheckout('Cash')} disabled={isSubmitting}>
                              {isSubmitting ? <Loader className="mr-4 h-6 w-6 animate-spin" /> : <CircleDollarSign className="mr-4 h-6 w-6"/>}
                              {isSubmitting ? 'Processing...' : 'Bayar dengan Tunai'}
                            </Button>
                            <Button className="w-full h-16 text-lg" onClick={() => handleCheckout('QRIS')} disabled={isSubmitting}>
                                {isSubmitting ? <Loader className="mr-4 h-6 w-6 animate-spin" /> : <QrCode className="mr-4 h-6 w-6"/>}
                                {isSubmitting ? 'Processing...' : 'Bayar dengan QRIS'}
                            </Button>
                        </div>
                      </div>
                      <SheetFooter>
                         <SheetClose asChild>
                            <Button variant="outline" disabled={isSubmitting}>Cancel</Button>
                        </SheetClose>
                      </SheetFooter>
                    </SheetContent>
                  </Sheet>
                </div>
            </CardFooter>
            )}
          </Card>
        </div>
    );
  };


  return (
    <div className="flex min-h-screen w-full flex-col">
       <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
        <div className="md:hidden">
          <SidebarTrigger />
        </div>
        <h1 className="font-headline text-xl font-semibold md:text-2xl flex-1">
          Point of Sale
        </h1>
      </header>
      <main className="flex-1 p-4 md:p-6">
        {renderContent()}
      </main>

      {completedTransaction && activeOutlet && (
         <Dialog open={!!completedTransaction} onOpenChange={() => setCompletedTransaction(null)}>
            <DialogContent className="sm:max-w-md" id="receipt-dialog-content">
                <DialogHeader>
                    <DialogTitle>Transaction Successful</DialogTitle>
                    <DialogDescription>Receipt for invoice {completedTransaction.invoice}</DialogDescription>
                </DialogHeader>
                <div id="receipt-content-wrapper">
                    <TransactionReceipt 
                        transaction={completedTransaction} 
                        outlet={activeOutlet} 
                        productsMap={menuItemsMap} 
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setCompletedTransaction(null)}>Close</Button>
                    <Button onClick={handlePrintReceipt}>
                        <Printer className="mr-2 h-4 w-4" /> Print Receipt
                    </Button>
                </DialogFooter>
            </DialogContent>
         </Dialog>
      )}
    </div>
  );
}

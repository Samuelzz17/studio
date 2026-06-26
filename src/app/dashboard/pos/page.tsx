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
import { useOutlet, OutletSwitcher } from '@/components/OutletContext';
import { useRouter } from 'next/navigation';
import { formatCurrency } from '@/lib/currency';
import { TransactionReceipt } from '@/components/TransactionReceipt';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { buildReceiptEscPos, escposBytesToBase64 } from '@/lib/pos/escpos';

type OrderItem = Product & { quantity: number };

export default function POSPage() {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPayment, setCustomerPayment] = useState(0);
  const [taxRate, setTaxRate] = useState(0); // Default tax rate is 0%
  const [discountType, setDiscountType] = useState<'percentage' | 'amount'>('percentage');
  const [discountValue, setDiscountValue] = useState(0);
  const [isCheckoutSheetOpen, setIsCheckoutSheetOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // State for receipt
  const [completedTransaction, setCompletedTransaction] = useState<(Transaction & { id: string }) | null>(null);


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
  };

  const handleUpdateQuantity = (productId: string, amount: number) => {
    const product = menuItemsMap.get(productId);
    if (!product) return;

    if (amount > 0) {
        const currentQtyInCart = orderItems
            .find(item => item.id === productId)?.quantity ?? 0;
        
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

  const { subtotal, discountAmount, tax, total } = useMemo(() => {
    const subtotal = orderItems.reduce(
      (acc, item) => acc + item.price * item.quantity,
      0
    );

    let calculatedDiscount = 0;
    if (discountType === 'percentage') {
      calculatedDiscount = subtotal * (discountValue / 100);
    } else {
      calculatedDiscount = discountValue;
    }
    
    const totalAfterDiscount = subtotal - calculatedDiscount;
    const tax = totalAfterDiscount * taxRate;
    const total = totalAfterDiscount + tax;

    return { subtotal, discountAmount: calculatedDiscount, tax, total };
  }, [orderItems, taxRate, discountType, discountValue]);

  const change = useMemo(() => customerPayment - total, [customerPayment, total]);

  const handleClearOrder = () => {
    setOrderItems([]);
    setCustomerName('');
    setCustomerPayment(0);
    setTaxRate(0);
    setDiscountType('percentage');
    setDiscountValue(0);
    toast({
        title: "Order Cleared",
        description: "The current order has been cleared.",
        variant: "destructive"
    })
  }
  
  const handleCheckout = async (paymentMethod: 'Cash' | 'QRIS') => {
    if (!firestore || !activeOutlet || orderItems.length === 0 || !menuItems) return;
    
    if (paymentMethod === 'Cash' && customerPayment < total) {
      toast({
        title: 'Insufficient Payment',
        description: 'Customer payment is less than the total amount.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    
    const newTransactionRef = doc(collection(firestore, `outlets/${activeOutlet.id}/sales`));
    const invoiceId = `INV-${Date.now()}`;
    
    try {
      const finalTransactionData: Transaction & { id: string } = {
        id: newTransactionRef.id,
        invoice: invoiceId,
        customerName: customerName.trim() === '' ? 'Anonymous' : customerName,
        items: orderItems.map(item => ({
          productId: item.id,
          qty: item.quantity,
          price: item.price,
          preference: 'normal',
        })),
        total,
        taxRate,
        paymentMethod,
        customerPayment: paymentMethod === 'Cash' ? customerPayment : total,
        change: paymentMethod === 'Cash' ? change : 0,
        createdAt: Timestamp.now(),
        ...(discountValue > 0 && {
          discountType,
          discountValue,
          discountAmount,
        }),
      };

      await runTransaction(firestore, async (transaction) => {
        const stockDeductions = new Map<string, number>();

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

        for (const [materialId, decrementAmount] of stockDeductions.entries()) {
          const materialRef = doc(firestore, `outlets/${activeOutlet.id}/inventory_raw_materials/${materialId}`);
          transaction.update(materialRef, { stock: increment(-decrementAmount) });
        }
        
        const { id, ...transactionToSave } = finalTransactionData;
        transaction.set(newTransactionRef, { ...transactionToSave, createdAt: serverTimestamp() });
      });

      setCompletedTransaction(finalTransactionData);
      
      const paymentMethodDisplay = { 'Cash': 'Tunai', 'QRIS': 'QRIS' };
      toast({
          title: "Pesanan Berhasil!",
          description: `Total: ${formatCurrency(total)} dibayar dengan ${paymentMethodDisplay[paymentMethod]}.`,
      });
      
      setOrderItems([]);
      setCustomerName('');
      setCustomerPayment(0);
      setTaxRate(0);
      setDiscountType('percentage');
      setDiscountValue(0);
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
        if (!printWindow) {
            toast({ title: "Popup Blocker?", description: "Please allow popups to print receipts.", variant: "destructive" });
            return;
        }
        
        const stylesheets = Array.from(document.styleSheets)
            .map(s => s.href ? `<link rel="stylesheet" href="${s.href}">` : '')
            .join('\n');

        printWindow.document.write(`
            <html>
                <head>
                    <title>Print Receipt</title>
                    ${stylesheets}
                    <style>
                        @media print {
                          body * { visibility: hidden; }
                          #receipt-print-area, #receipt-print-area * { visibility: visible; }
                          #receipt-print-area { position: absolute; left: 0; top: 0; width: 100%; }
                        }
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    </style>
                </head>
                <body>
                    <div id="receipt-print-area">${receiptContent.innerHTML}</div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
             printWindow.print();
             printWindow.close();
        }, 500);
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
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {menuItems?.filter(item => item.id !== '_init' && item.active).map((item) => {
                const producibleQty = calculateProducibleQty(item);
                const isAvailable = producibleQty > 0;
                return (
                  <Card
                    key={item.id}
                    className="overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-200 data-[disabled=true]:opacity-50 data-[disabled=true]:cursor-not-allowed"
                    onClick={() => {
                        if (isAvailable) {
                            handleAddItem(item);
                        }
                    }}
                    data-disabled={!isAvailable}
                  >
                    <CardHeader className="p-4">
                      <CardTitle className="text-lg">{item.name}</CardTitle>
                      <p className="font-semibold text-primary text-base">
                        {formatCurrency(item.price)}
                      </p>
                      <p className="text-sm text-muted-foreground pt-1">
                        Est. Qty: {producibleQty === Infinity ? 'N/A' : producibleQty}
                      </p>
                    </CardHeader>
                     {!isAvailable && (
                        <CardContent className="p-4 pt-0">
                            <div className="bg-destructive/20 text-destructive text-center p-2 rounded-md">
                            <p className="font-bold text-sm">Out of Stock</p>
                            </div>
                        </CardContent>
                      )}
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

                    <div className="flex justify-between items-center">
                        <Label htmlFor="discount-value">Discount</Label>
                        <div className="flex items-center gap-1">
                            <Input 
                                id="discount-value"
                                type="number"
                                className="w-20 h-8"
                                value={discountValue}
                                onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                            />
                            <ToggleGroup 
                                type="single" 
                                value={discountType} 
                                onValueChange={(value: 'percentage' | 'amount') => value && setDiscountType(value)} 
                                className="h-8"
                            >
                                <ToggleGroupItem value="percentage" className="px-2 h-8 text-xs">%</ToggleGroupItem>
                                <ToggleGroupItem value="amount" className="px-2 h-8 text-xs">Rp</ToggleGroupItem>
                            </ToggleGroup>
                        </div>
                    </div>
                    {discountAmount > 0 &&
                        <div className="flex justify-between text-destructive">
                            <span>Discount Applied</span>
                            <span>- {formatCurrency(discountAmount)}</span>
                        </div>
                    }

                    <div className="flex justify-between items-center">
                        <Label htmlFor="tax-rate">Taxes (%)</Label>
                        <Input 
                            id="tax-rate"
                            type="number"
                            className="w-20 h-8"
                            value={taxRate * 100}
                            onChange={(e) => setTaxRate(parseFloat(e.target.value) / 100 || 0)}
                        />
                    </div>
                     <div className="flex justify-between">
                        <span> </span>
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
                    <SheetClose asChild>
                      <Button>Checkout</Button>
                    </SheetClose>
                    <SheetContent className="flex flex-col">
                      <SheetHeader>
                        <SheetTitle>Complete Payment</SheetTitle>
                        <SheetDescription>Enter customer details and select a payment method to finalize the order.</SheetDescription>
                      </SheetHeader>
                      <div className="flex-1 overflow-y-auto py-8 space-y-4">
                         <div className="space-y-2">
                            <Label htmlFor="customer-name">Customer Name</Label>
                            <Input
                                id="customer-name"
                                value={customerName}
                                onChange={(e) => setCustomerName(e.target.value)}
                                placeholder="Anonymous"
                                disabled={isSubmitting}
                            />
                         </div>
                         <div className="space-y-2">
                            <Label htmlFor="customer-payment">Customer Payment (Cash)</Label>
                            <Input
                                id="customer-payment"
                                type="number"
                                value={customerPayment}
                                onChange={(e) => setCustomerPayment(parseFloat(e.target.value) || 0)}
                                placeholder="Enter amount paid"
                                disabled={isSubmitting}
                            />
                         </div>
                         <div className="grid grid-cols-4 gap-2">
                            {[20000, 25000, 50000, 100000].map((amount) => (
                                <Button key={amount} variant="outline" onClick={() => setCustomerPayment(amount)} disabled={isSubmitting}>
                                    {formatCurrency(amount)}
                                </Button>
                            ))}
                         </div>
                         <Separator className="my-4" />
                         <div className="space-y-2 text-lg">
                            <div className="flex justify-between font-bold">
                                <span>Total</span>
                                <span>{formatCurrency(total)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Payment</span>
                                <span>{formatCurrency(customerPayment)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-primary">
                                <span>Change</span>
                                <span>{formatCurrency(change)}</span>
                            </div>
                         </div>
                         <Separator className="my-4" />
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
        <h1 className="font-headline text-xl font-semibold md:text-2xl flex-1">
          Point of Sale
        </h1>
        <OutletSwitcher />
      </header>
      <main className="flex-1 p-4 md:p-6">
        {renderContent()}
      </main>

      {/* Receipt Dialog */}
      {completedTransaction && activeOutlet && (
         <Dialog open={!!completedTransaction} onOpenChange={(open) => !open && setCompletedTransaction(null)}>
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
                <DialogFooter className="sm:justify-end">
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setCompletedTransaction(null)}>Close</Button>
                        <Button onClick={handlePrintReceipt}>
                            <Printer className="mr-2 h-4 w-4" /> Print
                        </Button>
                    </div>
                </DialogFooter>

            </DialogContent>
         </Dialog>
      )}

    </div>
  );
}

    

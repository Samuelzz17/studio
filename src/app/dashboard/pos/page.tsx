
'use client';

import { useState, useMemo, useEffect } from 'react';
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
import type { Product } from '@/lib/data';
import { PlusCircle, MinusCircle, X, CreditCard, Landmark, CircleDollarSign, Loader } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useFirebase, useMemoFirebase, useCollection } from '@/firebase';
import { collection, serverTimestamp } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useOutlet } from '@/components/OutletContext';
import { useRouter } from 'next/navigation';
import { v4 as uuidv4 } from 'uuid';

type OrderItem = Product & { quantity: number };

export default function POSPage() {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [isCheckoutSheetOpen, setIsCheckoutSheetOpen] = useState(false);
  const { toast } = useToast();
  const { firestore, user } = useFirebase();
  const { selectedOutletId } = useOutlet();
  const router = useRouter();

  // Redirect if no outlet is selected
  useEffect(() => {
    if (!selectedOutletId || selectedOutletId === 'all') {
      toast({
        title: 'No Outlet Selected',
        description: 'Please select an outlet from the dashboard to open POS.',
        variant: 'destructive',
      });
      router.push('/dashboard');
    }
  }, [selectedOutletId, router, toast]);

  const menuItemsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !selectedOutletId || selectedOutletId === 'all') return null;
    return collection(firestore, `outlets/${selectedOutletId}/inventory_products`);
  }, [firestore, user, selectedOutletId]);

  const { data: menuItems, isLoading: isLoadingMenu } = useCollection<Product>(menuItemsQuery);

  const transactionsCollectionRef = useMemoFirebase(() => {
      if (!firestore || !user || !selectedOutletId || selectedOutletId === 'all') return null;
      return collection(firestore, `outlets/${selectedOutletId}/sales`);
  }, [firestore, user, selectedOutletId]);


  const handleAddItem = (item: Product) => {
    setOrderItems((prevItems) => {
      const existingItem = prevItems.find((i) => i.id === item.id);
      if (existingItem) {
        return prevItems.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prevItems, { ...item, quantity: 1 }];
    });
    toast({
      title: 'Item Added',
      description: `${item.name} was added to the order.`,
    });
  };

  const handleUpdateQuantity = (itemId: string, amount: number) => {
    setOrderItems((prevItems) => {
      const updatedItems = prevItems
        .map((item) => {
          if (item.id === itemId) {
            return { ...item, quantity: item.quantity + amount };
          }
          return item;
        })
        .filter((item) => item.quantity > 0);
      return updatedItems;
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
    toast({
        title: "Order Cleared",
        description: "The current order has been cleared.",
        variant: "destructive"
    })
  }
  
  const handleCheckout = (paymentMethod: 'Cash' | 'Card' | 'Bank') => {
    if (!transactionsCollectionRef || orderItems.length === 0) return;

    const newTransaction = {
        invoice: `INV-${Date.now()}`,
        items: orderItems.map(item => ({
            productId: item.id,
            qty: item.quantity,
            price: item.price
        })),
        total: total,
        paymentMethod,
        createdAt: serverTimestamp(),
    };

    addDocumentNonBlocking(transactionsCollectionRef, newTransaction);
    toast({
        title: "Order Placed!",
        description: `Total: $${total.toFixed(2)} paid with ${paymentMethod}.`,
    });
    setOrderItems([]);
    setIsCheckoutSheetOpen(false);
  }

  const renderContent = () => {
    if (!selectedOutletId || selectedOutletId === 'all') {
       return (
        <div className="flex flex-1 items-center justify-center">
            <Loader className="h-8 w-8 animate-spin" />
            <p className="ml-4 text-muted-foreground">Redirecting...</p>
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
              {menuItems?.filter(item => item.id !== '_init' && item.active).map((item) => (
                <Card
                  key={item.id}
                  className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow duration-200"
                  onClick={() => handleAddItem(item)}
                >
                  <Image
                    src={`https://picsum.photos/seed/${item.id}/400/300`}
                    alt={item.name}
                    width={400}
                    height={300}
                    className="aspect-video w-full object-cover"
                    data-ai-hint={`${item.category.toLowerCase()} food`}
                  />
                  <CardHeader className="p-4">
                    <CardTitle className="text-lg">{item.name}</CardTitle>
                    <p className="font-semibold text-primary">
                      ${item.price.toFixed(2)}
                    </p>
                  </CardHeader>
                </Card>
              ))}
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
                          ${item.price.toFixed(2)}
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
                        <span>${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Taxes (11%)</span>
                        <span>${tax.toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-bold text-lg">
                        <span>Total</span>
                        <span>${total.toFixed(2)}</span>
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
                        <SheetDescription>Select a payment method to finalize the order.</SheetDescription>
                      </SheetHeader>
                      <div className="py-8">
                         <div className="flex justify-between font-bold text-xl mb-6">
                            <span>Total</span>
                            <span>${total.toFixed(2)}</span>
                        </div>
                        <div className="space-y-4">
                          <SheetClose asChild>
                            <Button className="w-full h-16 text-lg" onClick={() => handleCheckout('Card')}>
                              <CreditCard className="mr-4 h-6 w-6"/> Pay with Card
                            </Button>
                          </SheetClose>
                          <SheetClose asChild>
                            <Button className="w-full h-16 text-lg" onClick={() => handleCheckout('Cash')}>
                              <CircleDollarSign className="mr-4 h-6 w-6"/> Pay with Cash
                            </Button>
                          </SheetClose>
                          <SheetClose asChild>
                            <Button variant="secondary" className="w-full h-16 text-lg" onClick={() => handleCheckout('Bank')}>
                                <Landmark className="mr-4 h-6 w-6"/> Pay with Bank
                            </Button>
                          </SheetClose>
                        </div>
                      </div>
                      <SheetFooter>
                        <SheetClose asChild>
                            <Button variant="outline">Cancel</Button>
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
    </div>
  );
}

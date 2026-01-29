
'use client';

import Link from 'next/link';
import {
  Activity,
  ArrowUpRight,
  CircleDollarSign,
  Loader,
  Package,
  Users,
  Store,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, collectionGroup, getDocs, query } from 'firebase/firestore';
import type { Transaction, RawMaterial } from '@/lib/data';
import withAuth from '@/components/withAuth';
import { useLocation, LocationSwitcher } from '@/components/LocationContext';
import { useEffect, useState } from 'react';

function Dashboard() {
  const { firestore, user } = useFirebase();
  const { selectedLocationId, locations } = useLocation();

  const [aggregatedData, setAggregatedData] = useState({
    totalRevenue: 0,
    totalSales: 0,
    lowStockItemsCount: 0,
    recentTransactions: [] as Transaction[],
    lowStockItems: [] as RawMaterial[],
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !user) return;

    const fetchData = async () => {
      setIsLoading(true);

      let transactionPaths: string[] = [];
      let ingredientPaths: string[] = [];

      if (selectedLocationId === 'all') {
        if (locations) {
          transactionPaths = locations.map(loc => `users/${user.uid}/locations/${loc.id}/transactions`);
          ingredientPaths = locations.map(loc => `users/${user.uid}/locations/${loc.id}/ingredients`);
        }
      } else if (selectedLocationId) {
        transactionPaths = [`users/${user.uid}/locations/${selectedLocationId}/transactions`];
        ingredientPaths = [`users/${user.uid}/locations/${selectedLocationId}/ingredients`];
      } else {
        setIsLoading(false);
        return
      }

      if (transactionPaths.length === 0) {
        setIsLoading(false);
        setAggregatedData({
          totalRevenue: 0,
          totalSales: 0,
          lowStockItemsCount: 0,
          recentTransactions: [],
          lowStockItems: [],
        });
        return;
      }

      // Fetch transactions
      const transactionPromises = transactionPaths.map(path => getDocs(query(collection(firestore, path))));
      const transactionSnapshots = await Promise.all(transactionPromises);
      const allTransactions = transactionSnapshots.flatMap(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
      allTransactions.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());


      // Fetch ingredients
      const ingredientPromises = ingredientPaths.map(path => getDocs(query(collection(firestore, path))));
      const ingredientSnapshots = await Promise.all(ingredientPromises);
      const allIngredients = ingredientSnapshots.flatMap(snap => snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as RawMaterial)));
      
      const totalRevenue = allTransactions.reduce((acc, sale) => acc + sale.totalCost, 0);
      const totalSales = allTransactions.length;
      const lowStockItems = allIngredients.filter(item => item.stockLevel <= item.lowStockThreshold);

      setAggregatedData({
        totalRevenue,
        totalSales,
        lowStockItemsCount: lowStockItems.length,
        recentTransactions: allTransactions.slice(0, 5),
        lowStockItems: lowStockItems,
      });

      setIsLoading(false);
    };

    fetchData();
  }, [selectedLocationId, firestore, user, locations]);


  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
        <div className="md:hidden">
          <SidebarTrigger />
        </div>
        <h1 className="font-headline text-xl font-semibold md:text-2xl flex-1">
          Dashboard
        </h1>
        <div className="flex items-center gap-2">
          <LocationSwitcher />
          <Button asChild size="sm" disabled={selectedLocationId === 'all'}>
            <Link href="/pos">
              <Store className="mr-2 h-4 w-4" />
              Buka POS
            </Link>
          </Button>
        </div>
      </header>
      <div className="flex flex-col sm:gap-4 sm:py-4 sm:px-6">
        <main className="grid flex-1 items-start gap-4 p-4 sm:p-0 md:gap-8 lg:grid-cols-3 xl:grid-cols-3">
          <div className="grid auto-rows-max items-start gap-4 md:gap-8 lg:col-span-2">
            <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Total Revenue</CardTitle>
                  <CircleDollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {isLoading ? <Loader className="h-6 w-6 animate-spin" /> : <>
                    <div className="text-2xl font-bold">
                      ${aggregatedData.totalRevenue.toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Based on selected location(s)
                    </p>
                  </>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Total Sales</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                 {isLoading ? <Loader className="h-6 w-6 animate-spin" /> : <>
                    <div className="text-2xl font-bold">+{aggregatedData.totalSales}</div>
                    <p className="text-xs text-muted-foreground">
                      Total transactions recorded
                    </p>
                  </>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Low Stock Items</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                 {isLoading ? <Loader className="h-6 w-6 animate-spin" /> : <>
                    <div className="text-2xl font-bold">{aggregatedData.lowStockItemsCount}</div>
                    <p className="text-xs text-muted-foreground">
                      Items needing attention
                    </p>
                  </>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle>Active Now</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">+573</div>
                  <p className="text-xs text-muted-foreground">
                    +201 since last hour (demo)
                  </p>
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader className="flex flex-row items-center">
                <div className="grid gap-2">
                  <CardTitle>Transactions</CardTitle>
                  <CardDescription>
                    Recent transactions from your store.
                  </CardDescription>
                </div>
                <Button asChild size="sm" className="ml-auto gap-1">
                  <Link href="/sales">
                    View All
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead className="hidden xl:table-column">
                        Items
                      </TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center">
                          <Loader className="mx-auto h-6 w-6 animate-spin" />
                        </TableCell>
                      </TableRow>
                    ) : (
                      aggregatedData.recentTransactions.map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell>
                            <div className="font-medium">Anonymous</div>
                            <div className="hidden text-sm text-muted-foreground md:inline">
                              {sale.timestamp?.toDate().toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell className="hidden xl:table-column">
                            {sale.menuItemIds.length} items
                          </TableCell>
  
                          <TableCell className="text-right">
                            ${sale.totalCost.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Low Stock</CardTitle>
              <CardDescription>
                These items are running low and may need reordering soon.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-8">
              {isLoading ? (
                 <Loader className="mx-auto h-6 w-6 animate-spin" />
              ) : aggregatedData.lowStockItems.map((item) => (
                <div key={item.id} className="flex items-center gap-4">
                  <Avatar className="hidden h-9 w-9 sm:flex">
                    <AvatarImage
                      src={`https://picsum.photos/seed/${item.id}/40/40`}
                      alt={item.name}
                    />
                    <AvatarFallback>{item.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="grid gap-1">
                    <p className="text-sm font-medium leading-none">
                      {item.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {item.stockLevel} {item.unitOfMeasurement} remaining
                    </p>
                  </div>
                  <Badge variant="destructive" className="ml-auto">
                    Low
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}

export default withAuth(Dashboard);


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
import { useFirebase, useUser } from '@/firebase';
import { collection, getDocs, query, limit, orderBy } from 'firebase/firestore';
import type { Transaction, RawMaterial } from '@/lib/data';
import { useOutlet, OutletSwitcher } from '@/components/OutletContext';
import { useEffect, useState, useMemo } from 'react';

export default function Dashboard() {
  const { firestore } = useFirebase();
  const { user } = useUser();
  const { activeOutlet, loading: isLoadingOutlets } = useOutlet();

  const [aggregatedData, setAggregatedData] = useState({
    totalRevenue: 0,
    totalSales: 0,
    lowStockItemsCount: 0,
    recentTransactions: [] as (Transaction & { outletName: string })[],
    lowStockItems: [] as (RawMaterial & { outletName: string })[],
  });
  const [isLoadingData, setIsLoadingData] = useState(true);

  const outletsToQuery = useMemo(() => {
    if (!activeOutlet) return [];
    return [activeOutlet];
  }, [activeOutlet]);


  useEffect(() => {
    if (!firestore || !user || outletsToQuery.length === 0) {
      // If outlets are still loading, we wait. If not loading and no active outlet, we stop.
      if (!isLoadingOutlets) {
        setIsLoadingData(false);
        setAggregatedData({
            totalRevenue: 0,
            totalSales: 0,
            lowStockItemsCount: 0,
            recentTransactions: [],
            lowStockItems: [],
        });
      }
      return;
    }

    const fetchData = async () => {
      setIsLoadingData(true);

      const transactionPromises = outletsToQuery.map(outlet => 
        getDocs(query(collection(firestore, `outlets/${outlet.id}/sales`), orderBy('createdAt', 'desc'), limit(10)))
      );
      const ingredientPromises = outletsToQuery.map(outlet => 
        getDocs(collection(firestore, `outlets/${outlet.id}/inventory_raw_materials`))
      );
      
      const [transactionSnapshots, ingredientSnapshots] = await Promise.all([
          Promise.all(transactionPromises),
          Promise.all(ingredientPromises)
      ]);

      const allTransactions: (Transaction & { outletName: string })[] = [];
      transactionSnapshots.forEach((snap, index) => {
          const outletName = outletsToQuery[index].name;
          snap.docs.forEach(doc => {
              if (doc.id === '_init') return;
              allTransactions.push({ id: doc.id, ...(doc.data() as Transaction), outletName });
          })
      });
      allTransactions.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());

      const allIngredients: (RawMaterial & { outletName: string })[] = [];
      ingredientSnapshots.forEach((snap, index) => {
          const outletName = outletsToQuery[index].name;
           snap.docs.forEach(doc => {
              if (doc.id === '_init') return;
              allIngredients.push({ id: doc.id, ...(doc.data() as RawMaterial), outletName });
          })
      });
      
      const totalRevenue = allTransactions.reduce((acc, sale) => acc + sale.total, 0);
      const totalSales = allTransactions.length;
      const lowStockItems = allIngredients.filter(item => item.stock <= item.minimumStock);

      setAggregatedData({
        totalRevenue,
        totalSales,
        lowStockItemsCount: lowStockItems.length,
        recentTransactions: allTransactions.slice(0, 5),
        lowStockItems: lowStockItems,
      });

      setIsLoadingData(false);
    };

    fetchData();
  }, [firestore, user, outletsToQuery, isLoadingOutlets]);

  const isLoading = isLoadingData || isLoadingOutlets;

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
          <OutletSwitcher />
          <Button asChild size="sm" disabled={!activeOutlet}>
            <Link href="/dashboard/pos">
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
                      Based on selected outlet
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
                  <Link href="/dashboard/reports/sales">
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
                        Outlet
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
                              {sale.createdAt?.toDate().toLocaleDateString()}
                            </div>
                          </TableCell>
                          <TableCell className="hidden xl:table-cell">
                            {sale.outletName}
                          </TableCell>
  
                          <TableCell className="text-right">
                            ${sale.total.toFixed(2)}
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
                These items are running low across your outlets.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-8">
              {isLoading ? (
                 <Loader className="mx-auto h-6 w-6 animate-spin" />
              ) : aggregatedData.lowStockItems.length > 0 ? aggregatedData.lowStockItems.map((item) => (
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
                      {item.stock} {item.unit} at {item.outletName}
                    </p>
                  </div>
                  <Badge variant="destructive" className="ml-auto">
                    Low
                  </Badge>
                </div>
              )) : (
                <p className="text-sm text-muted-foreground text-center">No low stock items.</p>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}

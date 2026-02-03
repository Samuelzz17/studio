'use client';

import { useMemo } from 'react';
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
import { MoreHorizontal, Loader } from 'lucide-react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, orderBy, query } from 'firebase/firestore';
import type { Transaction } from '@/lib/data';
import { useOutlet, OutletSwitcher } from '@/components/OutletContext';
import { formatCurrency } from '@/lib/currency';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function SalesPage() {
  const { firestore } = useFirebase();
  const { activeOutlet, loading: isLoadingOutlets } = useOutlet();
  const isOutletSelected = !!activeOutlet;

  const transactionsQuery = useMemoFirebase(() => {
    if (!firestore || !activeOutlet) return null;
    return query(
      collection(firestore, `outlets/${activeOutlet.id}/sales`),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, activeOutlet]);

  const { data: sales, isLoading: isLoadingSales } =
    useCollection<Transaction>(transactionsQuery);

  const dailySummary = useMemo(() => {
    if (!sales) return [];
    const summary: {
      [key: string]: { date: Date; totalTransactions: number; totalRevenue: number };
    } = {};
    const filteredSales = sales.filter((s) => s.id !== '_init');

    filteredSales.forEach((sale) => {
      const date = sale.createdAt.toDate();
      const dateString = format(date, 'yyyy-MM-dd');

      if (!summary[dateString]) {
        summary[dateString] = {
          date: date,
          totalTransactions: 0,
          totalRevenue: 0,
        };
      }
      summary[dateString].totalTransactions += 1;
      summary[dateString].totalRevenue += sale.total;
    });

    return Object.values(summary).sort(
      (a, b) => b.date.getTime() - a.date.getTime()
    );
  }, [sales]);

  const weeklySummary = useMemo(() => {
    if (!sales) return [];
    const summary: {
      [key: string]: { weekStart: Date; totalTransactions: number; totalRevenue: number };
    } = {};
    const filteredSales = sales.filter(s => s.id !== '_init');

    filteredSales.forEach(sale => {
      const saleDate = sale.createdAt.toDate();
      const weekStartObj = startOfWeek(saleDate, { weekStartsOn: 1 }); // Start week on Monday
      const weekStartString = format(weekStartObj, 'yyyy-MM-dd');

      if (!summary[weekStartString]) {
        summary[weekStartString] = {
          weekStart: weekStartObj,
          totalTransactions: 0,
          totalRevenue: 0,
        };
      }
      summary[weekStartString].totalTransactions += 1;
      summary[weekStartString].totalRevenue += sale.total;
    });
    
    return Object.values(summary).sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());
  }, [sales]);

  const monthlySummary = useMemo(() => {
    if (!sales) return [];
    const summary: {
      [key: string]: { month: string; totalTransactions: number; totalRevenue: number };
    } = {};
    const filteredSales = sales.filter((s) => s.id !== '_init');

    filteredSales.forEach((sale) => {
      const date = sale.createdAt.toDate();
      const monthString = format(date, 'yyyy-MM');

      if (!summary[monthString]) {
        summary[monthString] = {
          month: monthString,
          totalTransactions: 0,
          totalRevenue: 0,
        };
      }
      summary[monthString].totalTransactions += 1;
      summary[monthString].totalRevenue += sale.total;
    });

    return Object.values(summary).sort((a, b) => b.month.localeCompare(a.month));
  }, [sales]);
  
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
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm">
          <div className="flex flex-col items-center gap-1 text-center">
            <h3 className="text-2xl font-bold tracking-tight">
              Please select an outlet
            </h3>
            <p className="text-sm text-muted-foreground">
              You need to select an outlet to see its sales history.
            </p>
          </div>
        </div>
      );
    }

    return (
      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
        </TabsList>
        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>All Transactions</CardTitle>
              <CardDescription>
                A real-time list of all individual sales transactions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="hidden md:table-cell">Date</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingSales ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center">
                        <Loader className="mx-auto h-6 w-6 animate-spin" />
                      </TableCell>
                    </TableRow>
                  ) : sales && sales.length > 0 ? (
                    sales
                      .filter((sale) => sale.id !== '_init')
                      .map((sale) => (
                        <TableRow key={sale.id}>
                          <TableCell className="hidden md:table-cell">
                            {sale.createdAt?.toDate().toLocaleString()}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {sale.invoice}
                          </TableCell>
                          <TableCell>
                            {sale.items.reduce((acc, item) => acc + item.qty, 0)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                sale.paymentMethod === 'QRIS'
                                  ? 'default'
                                  : 'secondary'
                              }
                            >
                              {sale.paymentMethod}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(sale.total)}
                          </TableCell>
                        </TableRow>
                      ))
                  ) : (
                    <TableRow>
                       <TableCell colSpan={5} className="text-center">
                        No transactions found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="daily">
          <Card>
             <CardHeader>
              <CardTitle>Daily Sales Summary</CardTitle>
              <CardDescription>
                Aggregated sales data grouped by day.
              </CardDescription>
            </CardHeader>
            <CardContent>
               <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-center">Total Transactions</TableHead>
                    <TableHead className="text-right">Total Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                   {isLoadingSales ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center">
                        <Loader className="mx-auto h-6 w-6 animate-spin" />
                      </TableCell>
                    </TableRow>
                  ) : dailySummary.length > 0 ? (
                    dailySummary.map((summary) => (
                      <TableRow key={summary.date.toISOString()}>
                        <TableCell>{format(summary.date, 'PPP')}</TableCell>
                        <TableCell className="text-center">{summary.totalTransactions}</TableCell>
                        <TableCell className="text-right">{formatCurrency(summary.totalRevenue)}</TableCell>
                      </TableRow>
                    ))
                   ) : (
                    <TableRow>
                       <TableCell colSpan={3} className="text-center">
                        No sales data for this period.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="weekly">
           <Card>
             <CardHeader>
              <CardTitle>Weekly Sales Summary</CardTitle>
              <CardDescription>
                Aggregated sales data grouped by week.
              </CardDescription>
            </CardHeader>
            <CardContent>
               <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Week</TableHead>
                    <TableHead className="text-center">Total Transactions</TableHead>
                    <TableHead className="text-right">Total Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                   {isLoadingSales ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center">
                        <Loader className="mx-auto h-6 w-6 animate-spin" />
                      </TableCell>
                    </TableRow>
                  ) : weeklySummary.length > 0 ? (
                    weeklySummary.map((summary) => (
                      <TableRow key={summary.weekStart.toISOString()}>
                        <TableCell>{format(summary.weekStart, 'MMM d')} - {format(endOfWeek(summary.weekStart, { weekStartsOn: 1 }), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="text-center">{summary.totalTransactions}</TableCell>
                        <TableCell className="text-right">{formatCurrency(summary.totalRevenue)}</TableCell>
                      </TableRow>
                    ))
                   ) : (
                    <TableRow>
                       <TableCell colSpan={3} className="text-center">
                        No sales data for this period.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="monthly">
           <Card>
             <CardHeader>
              <CardTitle>Monthly Sales Summary</CardTitle>
              <CardDescription>
                Aggregated sales data grouped by month.
              </CardDescription>
            </CardHeader>
            <CardContent>
               <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-center">Total Transactions</TableHead>
                    <TableHead className="text-right">Total Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                   {isLoadingSales ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center">
                        <Loader className="mx-auto h-6 w-6 animate-spin" />
                      </TableCell>
                    </TableRow>
                  ) : monthlySummary.length > 0 ? (
                    monthlySummary.map((summary) => (
                      <TableRow key={summary.month}>
                        <TableCell>{format(parseISO(`${summary.month}-01`), 'MMMM yyyy')}</TableCell>
                        <TableCell className="text-center">{summary.totalTransactions}</TableCell>
                        <TableCell className="text-right">{formatCurrency(summary.totalRevenue)}</TableCell>
                      </TableRow>
                    ))
                   ) : (
                    <TableRow>
                       <TableCell colSpan={3} className="text-center">
                        No sales data for this period.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    );
  };

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
        <div className="md:hidden">
          <SidebarTrigger />
        </div>
        <h1 className="font-headline text-xl font-semibold md:text-2xl flex-1">
          Sales Report
        </h1>
        <OutletSwitcher />
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        {renderContent()}
      </main>
    </div>
  );
}

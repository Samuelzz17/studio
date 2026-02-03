'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useMemo, useState } from 'react';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Transaction, Product, RawMaterial, Expense } from '@/lib/data';
import { useOutlet, OutletSwitcher } from '@/components/OutletContext';
import { Loader, TrendingUp, TrendingDown, Scale } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  format,
  isWithinInterval,
  subDays,
  subWeeks,
  subMonths,
  subYears,
  getWeek,
} from 'date-fns';

type ReportPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'all';

type FinancialSummary = {
  periodLabel: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
};

const chartConfig = {
  revenue: { label: 'Revenue', color: 'hsl(var(--chart-2))' },
  netProfit: { label: 'Net Profit', color: 'hsl(var(--chart-1))' },
};

export default function FinanceReportPage() {
  const { firestore } = useFirebase();
  const { activeOutlet, loading: isLoadingOutlets } = useOutlet();
  const [period, setPeriod] = useState<ReportPeriod>('daily');
  const isOutletSelected = !!activeOutlet;

  // Data Fetching
  const salesQuery = useMemoFirebase(() => {
    if (!firestore || !activeOutlet) return null;
    return query(collection(firestore, `outlets/${activeOutlet.id}/sales`), orderBy('createdAt', 'desc'));
  }, [firestore, activeOutlet]);

  const productsQuery = useMemoFirebase(() => {
    if (!firestore || !activeOutlet) return null;
    return query(collection(firestore, `outlets/${activeOutlet.id}/inventory_products`));
  }, [firestore, activeOutlet]);

  const rawMaterialsQuery = useMemoFirebase(() => {
    if (!firestore || !activeOutlet) return null;
    return query(collection(firestore, `outlets/${activeOutlet.id}/inventory_raw_materials`));
  }, [firestore, activeOutlet]);

  const expensesQuery = useMemoFirebase(() => {
    if (!firestore || !activeOutlet) return null;
    return query(collection(firestore, `outlets/${activeOutlet.id}/expenses`), orderBy('expenseDate', 'desc'));
  }, [firestore, activeOutlet]);

  const { data: sales, isLoading: isLoadingSales } = useCollection<Transaction>(salesQuery);
  const { data: products, isLoading: isLoadingProducts } = useCollection<Product>(productsQuery);
  const { data: rawMaterials, isLoading: isLoadingRawMaterials } = useCollection<RawMaterial>(rawMaterialsQuery);
  const { data: expenses, isLoading: isLoadingExpenses } = useCollection<Expense>(expensesQuery);

  const { dataSummary, totals, isLoading } = useMemo(() => {
    const isLoading = isLoadingSales || isLoadingProducts || isLoadingRawMaterials || isLoadingExpenses || isLoadingOutlets;
    if (isLoading || !sales || !products || !rawMaterials || !expenses) {
      return { dataSummary: [], totals: null, isLoading: true };
    }

    const productMap = new Map(products.map(p => [p.id, p]));
    const rawMaterialMap = new Map(rawMaterials.map(m => [m.id, m]));

    const getCogsForSale = (sale: Transaction): number => {
      return sale.items.reduce((totalCost, item) => {
        const product = productMap.get(item.productId);
        if (!product || !product.recipe) return totalCost;

        const productCost = product.recipe.reduce((recipeCost, recipeItem) => {
          const material = rawMaterialMap.get(recipeItem.materialId);
          const materialCost = material ? material.averageCost : 0;
          return recipeCost + (recipeItem.quantity * materialCost);
        }, 0);

        return totalCost + (productCost * item.qty);
      }, 0);
    };

    const now = new Date();
    let interval: { start: Date; end: Date };
    let groupBy: 'day' | 'week' | 'month' | 'year';
    let subPeriods: Date[] = [];

    switch (period) {
        case 'daily':
            interval = { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
            groupBy = 'day';
            break;
        case 'weekly':
            interval = { start: startOfWeek(subWeeks(now, 7)), end: endOfWeek(now) };
            groupBy = 'week';
            break;
        case 'monthly':
            interval = { start: startOfMonth(subMonths(now, 11)), end: endOfMonth(now) };
            groupBy = 'month';
            break;
        case 'yearly':
            interval = { start: startOfYear(subYears(now, 4)), end: endOfYear(now) };
            groupBy = 'year';
            break;
        case 'all':
        default:
            const firstYear = sales.length > 0 ? sales[sales.length - 1].createdAt.toDate().getFullYear() : now.getFullYear();
            interval = { start: startOfYear(new Date(firstYear, 0, 1)), end: endOfYear(now) };
            groupBy = 'year';
            break;
    }
    
    const filteredSales = sales.filter(s => s.id !== '_init' && isWithinInterval(s.createdAt.toDate(), interval));
    const filteredExpenses = expenses.filter(e => e.id !== '_init' && isWithinInterval(e.expenseDate.toDate(), interval));

    const summaryMap = new Map<string, Omit<FinancialSummary, 'periodLabel'>>();

    const getGroupKey = (date: Date): string => {
        switch(groupBy) {
            case 'day': return format(date, 'yyyy-MM-dd');
            case 'week': return `${format(date, 'yyyy')}-W${getWeek(date, { weekStartsOn: 1 })}`;
            case 'month': return format(date, 'yyyy-MM');
            case 'year': return format(date, 'yyyy');
        }
    }

    filteredSales.forEach(sale => {
      const key = getGroupKey(sale.createdAt.toDate());
      const summary = summaryMap.get(key) ?? { revenue: 0, cogs: 0, grossProfit: 0, expenses: 0, netProfit: 0 };
      const saleCogs = getCogsForSale(sale);
      summary.revenue += sale.total;
      summary.cogs += saleCogs;
      summaryMap.set(key, summary);
    });
    
    filteredExpenses.forEach(expense => {
      const key = getGroupKey(expense.expenseDate.toDate());
      const summary = summaryMap.get(key) ?? { revenue: 0, cogs: 0, grossProfit: 0, expenses: 0, netProfit: 0 };
      summary.expenses += expense.amount;
      summaryMap.set(key, summary);
    });

    const dataSummary: FinancialSummary[] = Array.from(summaryMap.entries()).map(([key, value]) => {
      const grossProfit = value.revenue - value.cogs;
      const netProfit = grossProfit - value.expenses;
      let periodLabel = key;
      if (groupBy === 'day') periodLabel = format(new Date(key), 'd MMM');
      if (groupBy === 'week') periodLabel = key.replace('-W', ' W');
      if (groupBy === 'month') periodLabel = format(new Date(key), 'MMM yyyy');

      return {
        periodLabel: periodLabel,
        revenue: value.revenue,
        cogs: value.cogs,
        expenses: value.expenses,
        grossProfit,
        netProfit,
      };
    }).sort((a,b) => a.periodLabel.localeCompare(b.periodLabel));
    
    const totals = dataSummary.reduce((acc, summary) => {
        acc.revenue += summary.revenue;
        acc.cogs += summary.cogs;
        acc.grossProfit += summary.grossProfit;
        acc.expenses += summary.expenses;
        acc.netProfit += summary.netProfit;
        return acc;
    }, { revenue: 0, cogs: 0, grossProfit: 0, expenses: 0, netProfit: 0 });

    return { dataSummary, totals, isLoading: false };
  }, [sales, products, rawMaterials, expenses, period, isLoadingOutlets, isLoadingSales, isLoadingProducts, isLoadingRawMaterials, isLoadingExpenses]);
  
  const compactCurrencyFormatter = (value: number) =>
    new Intl.NumberFormat('id-ID', {
      notation: 'compact',
      compactDisplay: 'short',
    }).format(value);

  const renderContent = () => {
    if (isLoadingOutlets) {
      return <div className="flex flex-1 items-center justify-center"><Loader className="h-8 w-8 animate-spin" /></div>;
    }
    if (!isOutletSelected) {
      return (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm mt-8">
          <div className="flex flex-col items-center gap-1 text-center">
            <h3 className="text-2xl font-bold tracking-tight">Please select an outlet</h3>
            <p className="text-sm text-muted-foreground">You need to select an outlet to see its reports.</p>
          </div>
        </div>
      );
    }
    if (isLoading) {
         return <div className="flex flex-1 items-center justify-center"><Loader className="h-8 w-8 animate-spin" /></div>;
    }
    return (
       <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle>Total Revenue</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totals?.revenue || 0)}</div>
                    <p className="text-xs text-muted-foreground">Total sales generated</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle>Gross Profit</CardTitle>
                    <Scale className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totals?.grossProfit || 0)}</div>
                    <p className="text-xs text-muted-foreground">Revenue minus Cost of Goods Sold</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle>Net Profit</CardTitle>
                    <TrendingDown className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totals?.netProfit || 0)}</div>
                    <p className="text-xs text-muted-foreground">After all expenses</p>
                </CardContent>
            </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Profitability Trend</CardTitle>
            <CardDescription>Revenue and Net Profit over the selected period.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
              <BarChart accessibilityLayer data={dataSummary}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="periodLabel" tickLine={false} tickMargin={10} axisLine={false} />
                <YAxis tickFormatter={(value) => `Rp ${compactCurrencyFormatter(value as number)}`} />
                <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(value as number)} />} />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
                <Bar dataKey="netProfit" fill="var(--color-netProfit)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Financial Summary Breakdown</CardTitle>
            <CardDescription>Detailed financial data for each sub-period.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">COGS</TableHead>
                        <TableHead className="text-right">Gross Profit</TableHead>
                        <TableHead className="text-right">Expenses</TableHead>
                        <TableHead className="text-right">Net Profit</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {dataSummary.length > 0 ? dataSummary.map(d => (
                        <TableRow key={d.periodLabel}>
                            <TableCell>{d.periodLabel}</TableCell>
                            <TableCell className="text-right">{formatCurrency(d.revenue)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(d.cogs)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(d.grossProfit)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(d.expenses)}</TableCell>
                            <TableCell className="text-right font-bold">{formatCurrency(d.netProfit)}</TableCell>
                        </TableRow>
                    )) : (
                        <TableRow>
                            <TableCell colSpan={6} className="text-center">No financial data for this period.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
        <div className="md:hidden">
          <SidebarTrigger />
        </div>
        <h1 className="font-headline text-xl font-semibold md:text-2xl flex-1">
          Financial Reports
        </h1>
        <OutletSwitcher />
      </header>
      <main className="flex-1 p-4 md:p-6">
        <Tabs value={period} onValueChange={(v) => setPeriod(v as ReportPeriod)} className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-4">
                <TabsTrigger value="daily">Daily</TabsTrigger>
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
                <TabsTrigger value="yearly">Yearly</TabsTrigger>
                <TabsTrigger value="all">All Time</TabsTrigger>
            </TabsList>
            <TabsContent value={period}>
                {renderContent()}
            </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

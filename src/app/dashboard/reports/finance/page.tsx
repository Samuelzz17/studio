
'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Pie, PieChart, Cell, Line, LineChart } from 'recharts';
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
  ChartLegend,
  ChartLegendContent,
} from '@/components/ui/chart';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useMemo } from 'react';
import { collection, query } from 'firebase/firestore';
import type { Transaction, Product } from '@/lib/data';
import { useOutlet, OutletSwitcher } from '@/components/OutletContext';
import { Loader } from 'lucide-react';


const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function FinanceReportPage() {
  const { firestore } = useFirebase();
  const { activeOutlet, loading: isLoadingOutlets } = useOutlet();
  const isOutletSelected = !!activeOutlet;

  const transactionsQuery = useMemoFirebase(() => {
    if (!firestore || !activeOutlet) return null;
    return query(collection(firestore, `outlets/${activeOutlet.id}/sales`));
  }, [firestore, activeOutlet]);
  
  const productsQuery = useMemoFirebase(() => {
    if (!firestore || !activeOutlet) return null;
    return query(collection(firestore, `outlets/${activeOutlet.id}/inventory_products`));
  }, [firestore, activeOutlet]);

  const { data: sales } = useCollection<Transaction>(transactionsQuery);
  const { data: products } = useCollection<Product>(productsQuery);

  const productMap = useMemo(() => {
    if (!products) return new Map();
    const filteredProducts = products.filter(p => p.id !== '_init');
    return new Map(filteredProducts.map(p => [p.id, p]));
  }, [products]);

  const salesByCategory = useMemo(() => {
    if (!sales || productMap.size === 0) return [];
    const categoryMap: { [key: string]: number } = {};
    const filteredSales = sales.filter(s => s.id !== '_init');

    filteredSales.forEach(sale => {
      sale.items.forEach(item => {
        const product = productMap.get(item.productId);
        if (product) {
          if (!categoryMap[product.category]) {
            categoryMap[product.category] = 0;
          }
          categoryMap[product.category] += item.qty;
        }
      });
    });
    return Object.entries(categoryMap).map(([name, value]) => ({ name, value }));
  }, [sales, productMap]);
  
  const salesByHour = useMemo(() => {
    if (!sales) return [];
    const hourMap = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}:00`, sales: 0 }));
    const filteredSales = sales.filter(s => s.id !== '_init');
     filteredSales.forEach(sale => {
        const hour = sale.createdAt.toDate().getHours();
        hourMap[hour].sales += sale.total;
     });
     return hourMap.filter(h => h.sales > 0);
  }, [sales]);

  const dailyRevenue = useMemo(() => {
    if (!sales) return [];
    const revenueMap: { [key: string]: number } = {};
    const filteredSales = sales.filter(s => s.id !== '_init');
    filteredSales.forEach(sale => {
      const date = sale.createdAt.toDate().toLocaleDateString('en-CA');
      if (!revenueMap[date]) {
        revenueMap[date] = 0;
      }
      revenueMap[date] += sale.total;
    });
    return Object.entries(revenueMap).map(([date, revenue]) => ({ date: new Date(date).toLocaleDateString('en-US', { weekday: 'short'}), revenue })).slice(-7);
  }, [sales]);

  const chartConfigCategory = {
    value: { label: "Items Sold" },
    ...salesByCategory.reduce((acc, cat) => {
        acc[cat.name] = { label: cat.name, color: COLORS[Object.keys(acc).length % COLORS.length] };
        return acc;
    }, {} as any)
  };
  
  const chartConfigDailyRevenue = {
    revenue: { label: "Revenue", color: "hsl(var(--chart-1))" },
  };
  
  const chartConfigSalesByHour = {
    sales: { label: "Sales", color: "hsl(var(--chart-2))" },
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
              You need to select an outlet to see its reports.
            </p>
          </div>
        </div>
      );
    }
    return (
       <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Daily Revenue (Last 7 Days)</CardTitle>
            <CardDescription>Revenue generated over the last few days.</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfigDailyRevenue} className="min-h-[300px] w-full">
              <BarChart accessibilityLayer data={dailyRevenue}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                />
                <YAxis unit="$" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sales by Category</CardTitle>
            <CardDescription>Breakdown of items sold by category.</CardDescription>
          </CardHeader>
          <CardContent>
             <ChartContainer
              config={chartConfigCategory}
              className="mx-auto aspect-square max-h-[250px]"
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel />}
                />
                <Pie data={salesByCategory} dataKey="value" nameKey="name" innerRadius={60}>
                    {salesByCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                </Pie>
                 <ChartLegend
                  content={<ChartLegendContent nameKey="name" />}
                  className="-translate-y-2 flex-wrap gap-2 [&>*]:basis-1/4 [&>*]:justify-center"
                />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Peak Sales Hours</CardTitle>
            <CardDescription>Shows which hours of the day are most profitable.</CardDescription>
          </CardHeader>
          <CardContent>
             <ChartContainer config={chartConfigSalesByHour} className="min-h-[300px] w-full">
                <LineChart data={salesByHour} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                    <XAxis dataKey="hour"/>
                    <YAxis unit="$"/>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="sales" stroke="var(--color-sales)" strokeWidth={2} />
                </LineChart>
            </ChartContainer>
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
        {renderContent()}
      </main>
    </div>
  );
}


'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Pie, PieChart, Cell, Line, LineChart, ResponsiveContainer } from 'recharts';
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
import { collection } from 'firebase/firestore';
import type { Transaction } from '@/lib/data';
import { menuItems } from '@/lib/data';
import withAuth from '@/components/withAuth';
import { useLocation, LocationSwitcher } from '@/components/LocationContext';


const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

function ReportsPage() {
  const { firestore, user } = useFirebase();
  const { selectedLocationId } = useLocation();
  const isLocationSelected = selectedLocationId && selectedLocationId !== 'all';

  const transactionsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !isLocationSelected) return null;
    return collection(firestore, 'users', user.uid, 'locations', selectedLocationId!, 'transactions');
  }, [firestore, user, selectedLocationId, isLocationSelected]);

  const { data: sales } = useCollection<Transaction>(transactionsQuery);

  const salesByCategory = useMemo(() => {
    if (!sales) return [];
    const categoryMap: { [key: string]: number } = { Coffee: 0, Pastries: 0, Food: 0 };
    sales?.forEach(sale => {
      sale.menuItemIds.forEach(itemId => {
        const menuItem = menuItems.find(mi => mi.id === itemId);
        if (menuItem && menuItem.category in categoryMap) {
            categoryMap[menuItem.category] += 1;
        } 
      });
    });
    return Object.entries(categoryMap).map(([name, value]) => ({ name, value }));
  }, [sales]);
  
  const salesByHour = useMemo(() => {
    if (!sales) return [];
    const hourMap = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}:00`, sales: 0 }));
     sales?.forEach(sale => {
        const hour = sale.timestamp.toDate().getHours();
        hourMap[hour].sales += sale.totalCost;
     });
     return hourMap.filter(h => h.sales > 0);
  }, [sales]);

  const dailyRevenue = useMemo(() => {
    if (!sales) return [];
    const revenueMap: { [key: string]: number } = {};
    sales?.forEach(sale => {
      const date = sale.timestamp.toDate().toLocaleDateString('en-CA');
      if (!revenueMap[date]) {
        revenueMap[date] = 0;
      }
      revenueMap[date] += sale.totalCost;
    });
    return Object.entries(revenueMap).map(([date, revenue]) => ({ date: new Date(date).toLocaleDateString('en-US', { weekday: 'short'}), revenue })).slice(-7); // Last 7 days
  }, [sales]);

  const chartConfigCategory = {
    value: { label: "Items Sold" },
    Coffee: { label: "Coffee", color: "hsl(var(--chart-1))" },
    Pastries: { label: "Pastries", color: "hsl(var(--chart-2))" },
    Food: { label: "Food", color: "hsl(var(--chart-3))" },
  };
  
  const chartConfigDailyRevenue = {
    revenue: { label: "Revenue", color: "hsl(var(--chart-1))" },
  };
  
  const chartConfigSalesByHour = {
    sales: { label: "Sales", color: "hsl(var(--chart-2))" },
  };
  
  const renderContent = () => {
    if (!isLocationSelected) {
      return (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm mt-8">
          <div className="flex flex-col items-center gap-1 text-center">
            <h3 className="text-2xl font-bold tracking-tight">
              Please select a location
            </h3>
            <p className="text-sm text-muted-foreground">
              You need to select a location to see its reports.
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
        <LocationSwitcher />
      </header>
      <main className="flex-1 p-4 md:p-6">
        {renderContent()}
      </main>
    </div>
  );
}

export default withAuth(ReportsPage);

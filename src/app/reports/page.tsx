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
import { sales } from '@/lib/data';
import { useMemo } from 'react';

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function ReportsPage() {
  const salesByCategory = useMemo(() => {
    const categoryMap = { Coffee: 0, Pastries: 0, Food: 0 };
    sales.forEach(sale => {
      sale.items.forEach(item => {
        // This is a simplification. In a real app, you'd look up the item's category.
        if (item.name.includes('Espresso') || item.name.includes('Cappuccino') || item.name.includes('Americano') || item.name.includes('Coffee') || item.name.includes('Latte')) {
            categoryMap.Coffee += item.quantity;
        } else if (item.name.includes('Croissant') || item.name.includes('Brownie') || item.name.includes('Roll')) {
            categoryMap.Pastries += item.quantity;
        } else {
            categoryMap.Food += item.quantity;
        }
      });
    });
    return Object.entries(categoryMap).map(([name, value]) => ({ name, value }));
  }, []);
  
  const salesByHour = useMemo(() => {
    const hourMap = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}:00`, sales: 0 }));
     sales.forEach(sale => {
        const hour = new Date(sale.date).getHours();
        hourMap[hour].sales += sale.total;
     });
     return hourMap.filter(h => h.sales > 0);
  }, []);

  const dailyRevenue = useMemo(() => {
    const revenueMap: { [key: string]: number } = {};
    sales.forEach(sale => {
      const date = new Date(sale.date).toLocaleDateString('en-CA');
      if (!revenueMap[date]) {
        revenueMap[date] = 0;
      }
      revenueMap[date] += sale.total;
    });
    return Object.entries(revenueMap).map(([date, revenue]) => ({ date: new Date(date).toLocaleDateString('en-US', { weekday: 'short'}), revenue }));
  }, []);

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

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
        <div className="md:hidden">
          <SidebarTrigger />
        </div>
        <h1 className="font-headline text-xl font-semibold md:text-2xl">
          Financial Reports
        </h1>
      </header>
      <main className="flex-1 p-4 md:p-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Daily Revenue</CardTitle>
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
                <YAxis />
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
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="sales" stroke="var(--color-sales)" strokeWidth={2} />
                </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

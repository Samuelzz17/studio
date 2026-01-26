
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Coffee,
  LayoutDashboard,
  ShoppingCart,
  BookOpen,
  Boxes,
  DollarSign,
  LineChart,
} from 'lucide-react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from './ui/separator';

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pos', label: 'Point of Sale', icon: ShoppingCart },
  { href: '/menu', label: 'Menu', icon: BookOpen },
  { href: '/inventory', label: 'Inventory', icon: Boxes },
  { href: '/sales', label: 'Sales', icon: DollarSign },
  { href: '/reports', label: 'Reports', icon: LineChart },
];

export function SiteSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-3">
          <div className="bg-primary text-primary-foreground p-2 rounded-lg">
            <Coffee className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-headline">SR</h1>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarMenu>
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                className="justify-start"
                tooltip={{ children: item.label, side: 'right' }}
              >
                <Link href={item.href}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <Separator className="my-2" />
      <SidebarFooter>
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarImage src="https://picsum.photos/seed/user/40/40" alt="@shadcn" />
            <AvatarFallback>AD</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-medium">Admin User</span>
            <span className="text-xs text-muted-foreground">
              admin@sr.com
            </span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

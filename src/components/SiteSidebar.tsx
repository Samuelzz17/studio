'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Coffee,
  LayoutDashboard,
  Boxes,
  DollarSign,
  LineChart,
  ChevronDown,
  ShoppingCart,
  Receipt,
  Building2,
  Package,
  Blend,
  Armchair,
  BarChart2,
  PieChart,
  LogOut,
  Settings,
} from 'lucide-react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  useSidebar,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from './ui/separator';
import React from 'react';
import { useAuth, useUser } from '@/firebase';

const navItems = [
  { 
    href: '/dashboard', 
    label: 'Dashboard', 
    icon: LayoutDashboard 
  },
  {
    label: 'Inventory',
    icon: Boxes,
    subItems: [
      { href: '/dashboard/inventory/products', label: 'Products', icon: Package },
      { href: '/dashboard/inventory/raw-materials', label: 'Raw Materials', icon: Blend },
      { href: '/dashboard/inventory/assets', label: 'Assets', icon: Armchair },
    ]
  },
  {
    label: 'Financial',
    icon: DollarSign,
    subItems: [
      { href: '/dashboard/financial/purchases', label: 'Purchases', icon: ShoppingCart },
      { href: '/dashboard/financial/expenses', label: 'Expenses', icon: Receipt },
      { href: '/dashboard/financial/asset-purchases', label: 'Asset Purchases', icon: Building2 },
    ]
  },
  {
    label: 'Reports',
    icon: BarChart2,
    subItems: [
      { href: '/dashboard/reports/sales', label: 'Sales', icon: LineChart },
      { href: '/dashboard/reports/inventory', label: 'Inventory', icon: Boxes },
      { href: '/dashboard/reports/finance', label: 'Finance', icon: PieChart },
    ]
  },
  {
    href: '/dashboard/settings/outlets',
    label: 'Settings',
    icon: Settings,
  }
];

const NavCollapsible = ({ item, pathname }: { item: any, pathname: string }) => {
    const [isOpen, setIsOpen] = React.useState(
        item.subItems.some((subItem: any) => pathname.startsWith(subItem.href))
    );

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
            <CollapsibleTrigger asChild>
                <SidebarMenuButton className="w-full justify-between" tooltip={{ children: item.label, side: 'right' }}>
                     <div className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                    </div>
                    <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=collapsed]:hidden ${isOpen ? 'rotate-180' : ''}`} />
                </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-4 pt-1 group-data-[state=collapsed]:hidden">
                <SidebarMenu>
                    {item.subItems.map((subItem: any) => (
                        <SidebarMenuItem key={subItem.href}>
                            <SidebarMenuButton
                                asChild
                                isActive={pathname === subItem.href}
                                className="justify-start h-8"
                                tooltip={{ children: subItem.label, side: 'right' }}
                            >
                                <Link href={subItem.href}>
                                    <subItem.icon className="h-4 w-4" />
                                    <span>{subItem.label}</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    ))}
                </SidebarMenu>
            </CollapsibleContent>
        </Collapsible>
    )
}

export function SiteSidebar() {
  const pathname = usePathname();
  const auth = useAuth();
  const { user } = useUser();
  const router = useRouter();

  const handleLogout = async () => {
    await auth.signOut();
    router.push('/login');
  }

  const getInitials = (name: string | null | undefined, fallback: string) => {
    if (!name) return fallback.charAt(0).toUpperCase();
    const parts = name.split(' ');
    if (parts.length > 1) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const displayName = user?.displayName || user?.email || 'User';
  const displayEmail = user?.email || 'No email provided';
  const avatarFallback = getInitials(user?.displayName, user?.email || 'U');
  const avatarSrc = user ? `https://picsum.photos/seed/${user.uid}/40/40` : '';


  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary text-primary-foreground p-2 rounded-lg">
                <Coffee className="h-6 w-6" />
              </div>
              <div className="group-data-[state=collapsed]:hidden">
                <h1 className="text-2xl font-headline">SR</h1>
              </div>
            </div>
            <SidebarTrigger className="hidden md:flex" />
        </div>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarMenu>
          {navItems.map((item) =>
            item.subItems ? (
              <SidebarMenuItem key={item.label}>
                <NavCollapsible item={item} pathname={pathname} />
              </SidebarMenuItem>
            ) : (
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
            )
          )}
        </SidebarMenu>
      </SidebarContent>
      <Separator className="my-2" />
      <SidebarFooter className="p-2">
        <div className="flex items-center gap-3 p-2 rounded-md">
          <Avatar className="h-9 w-9">
            <AvatarImage src={avatarSrc} alt={displayName} />
            <AvatarFallback>{avatarFallback}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col group-data-[state=collapsed]:hidden">
            <span className="text-sm font-medium">{displayName}</span>
            <span className="text-xs text-muted-foreground">
              {displayEmail}
            </span>
          </div>
        </div>
         <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              className="justify-start text-destructive hover:text-destructive"
              tooltip={{ children: 'Log Out', side: 'right' }}
            >
              <LogOut className="h-4 w-4" />
              <span>Log Out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}


'use client';

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
import { MoreHorizontal, Plus, ShoppingCart, Loader } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { AssetInvestment } from '@/lib/data';
import { useOutlet, OutletSwitcher } from '@/components/OutletContext';
import { format } from 'date-fns';

export default function AssetsPage() {
  const { firestore } = useFirebase();
  const { selectedOutletId } = useOutlet();
  const isOutletSelected = selectedOutletId && selectedOutletId !== 'all';

  const assetsQuery = useMemoFirebase(() => {
    if (!firestore || !isOutletSelected) return null;
    return collection(firestore, 'outlets', selectedOutletId!, 'asset_investments');
  }, [firestore, selectedOutletId, isOutletSelected]);
  
  const { data: assets, isLoading: isLoadingAssets } = useCollection<AssetInvestment>(assetsQuery);

  const renderContent = () => {
    if (!isOutletSelected) {
      return (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm mt-8">
          <div className="flex flex-col items-center gap-1 text-center">
            <h3 className="text-2xl font-bold tracking-tight">
              Please select an outlet
            </h3>
            <p className="text-sm text-muted-foreground">
              You need to select an outlet to see the assets.
            </p>
          </div>
        </div>
      );
    }
    return (
        <Card>
          <CardHeader>
            <CardTitle>Asset Investments</CardTitle>
            <CardDescription>Non-sellable items like equipment and furniture.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Purchase Date</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingAssets ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      <Loader className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : assets && assets.length > 0 ? (
                  assets.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>${item.value.toFixed(2)}</TableCell>
                       <TableCell>
                        {item.purchaseDate ? format(item.purchaseDate.toDate(), 'PPP') : 'N/A'}
                       </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Toggle menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem>Edit</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center">
                      No assets found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
    );
  };

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
        <div className="md:hidden">
          <SidebarTrigger />
        </div>
        <div className="flex-1">
          <h1 className="font-headline text-xl font-semibold md:text-2xl">
            Inventory: Assets
          </h1>
        </div>
        <div className="flex items-center gap-2">
            <OutletSwitcher />
          <Button size="sm" variant="outline" disabled={!isOutletSelected}>
             <ShoppingCart className="h-4 w-4 mr-2" />
            Purchase Item
          </Button>
          <Button size="sm" disabled={!isOutletSelected}>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        {renderContent()}
      </main>
    </div>
  );
}

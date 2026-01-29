
'use client';

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import withAuth from '@/components/withAuth';
import { useLocation, LocationSwitcher } from '@/components/LocationContext';


function SalesPage() {  
  const { firestore, user } = useFirebase();
  const { selectedLocationId } = useLocation();
  const isLocationSelected = selectedLocationId && selectedLocationId !== 'all';

  const transactionsQuery = useMemoFirebase(() => {
    if (!firestore || !user || !isLocationSelected) return null;
    return query(
        collection(firestore, 'users', user.uid, 'locations', selectedLocationId!, 'transactions'),
        orderBy('timestamp', 'desc')
    );
  }, [firestore, user, selectedLocationId, isLocationSelected]);

  const { data: sales, isLoading: isLoadingSales } = useCollection<Transaction>(transactionsQuery);

  const renderContent = () => {
    if (!isLocationSelected) {
       return (
        <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm">
          <div className="flex flex-col items-center gap-1 text-center">
            <h3 className="text-2xl font-bold tracking-tight">
              Please select a location
            </h3>
            <p className="text-sm text-muted-foreground">
              You need to select a location from the dropdown above to see its sales history.
            </p>
          </div>
        </div>
      );
    }

    return (
       <>
        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
            <CardDescription>
              A complete list of all sales transactions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="hidden md:table-cell">Items</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingSales ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center">
                      <Loader className="mx-auto h-6 w-6 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : (
                sales?.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-mono text-xs">{sale.id.substring(0, 7)}</TableCell>
                    <TableCell className="font-medium">Anonymous</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {sale.timestamp?.toDate().toLocaleString()}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {sale.menuItemIds.length}
                    </TableCell>
                    <TableCell>
                      <Badge variant={sale.paymentMethod === 'Card' ? 'default' : 'secondary'}>
                        {sale.paymentMethod}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      ${sale.totalCost.toFixed(2)}
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
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuItem>Issue Refund</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#" />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#">1</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#" isActive>
                2
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#">3</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="#" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
        </>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
        <div className="md:hidden">
          <SidebarTrigger />
        </div>
        <h1 className="font-headline text-xl font-semibold md:text-2xl flex-1">
          Sales History
        </h1>
        <LocationSwitcher />
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
       {renderContent()}
      </main>
    </div>
  );
}

export default withAuth(SalesPage);

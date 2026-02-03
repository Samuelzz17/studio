
'use client';

import { useState } from 'react';
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
import { MoreHorizontal, Plus, Loader } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import type { Expense } from '@/lib/data';
import { useOutlet, OutletSwitcher } from '@/components/OutletContext';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/currency';
import { ExpenseForm, type ExpenseFormData } from '@/components/forms/ExpenseForm';
import { useToast } from '@/hooks/use-toast';


export default function ExpensesPage() {
  const { firestore } = useFirebase();
  const { activeOutlet, loading: isLoadingOutlets } = useOutlet();
  const { toast } = useToast();
  const isOutletSelected = !!activeOutlet;

  // State for form/sheet
  const [isAddSheetOpen, setIsAddSheetOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const expensesQuery = useMemoFirebase(() => {
    if (!firestore || !activeOutlet) return null;
    return query(collection(firestore, 'outlets', activeOutlet.id, 'expenses'), orderBy('expenseDate', 'desc'));
  }, [firestore, activeOutlet]);
  
  const { data: expenses, isLoading: isLoadingExpenses } = useCollection<Expense>(expensesQuery);

  const handleSaveExpense = (values: ExpenseFormData) => {
    if (!expensesQuery) return;
    setIsSubmitting(true);
    
    const expensesCollectionRef = expensesQuery.withConverter(null).parent;
    if (!expensesCollectionRef) return;
    
    const newDoc = {
        ...values,
        createdAt: serverTimestamp(),
    };
    addDocumentNonBlocking(expensesCollectionRef, newDoc);
    toast({
        title: 'Success!',
        description: `Expense for ${values.name} has been recorded.`,
    });
    setIsAddSheetOpen(false);
    setIsSubmitting(false);
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
              You need to select an outlet to see its expenses.
            </p>
          </div>
        </div>
      );
    }
    return (
        <Card>
          <CardHeader>
            <CardTitle>Operational Expenses</CardTitle>
            <CardDescription>A log of all operational business expenses.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingExpenses ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      <Loader className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : expenses && expenses.length > 0 ? (
                  expenses.filter(item => item.id !== '_init').map((item) => (
                    <TableRow key={item.id}>
                       <TableCell>
                        {item.expenseDate ? format(item.expenseDate.toDate(), 'PPP') : 'N/A'}
                       </TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.category}</TableCell>
                      <TableCell>{formatCurrency(item.amount)}</TableCell>
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
                    <TableCell colSpan={5} className="text-center">
                      No expenses found.
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
            Financial: Expenses
          </h1>
        </div>
        <div className="flex items-center gap-2">
            <OutletSwitcher />
          <Button size="sm" disabled={!isOutletSelected} onClick={() => setIsAddSheetOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Record Expense
          </Button>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        {renderContent()}
      </main>

      <Sheet open={isAddSheetOpen} onOpenChange={setIsAddSheetOpen}>
        <SheetContent>
            <SheetHeader>
                <SheetTitle>Record New Expense</SheetTitle>
                <SheetDescription>
                    Record a new business operational expense.
                </SheetDescription>
            </SheetHeader>
            <div className="py-4">
                <ExpenseForm onSubmit={handleSaveExpense} isSubmitting={isSubmitting} />
            </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

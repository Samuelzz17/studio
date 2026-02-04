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
import { Badge } from '@/components/ui/badge';
import { useFirebase, useMemoFirebase, useUser, useCollection } from '@/firebase';
import { collection, serverTimestamp, doc, addDoc, updateDoc, getDoc, arrayUnion } from 'firebase/firestore';
import type { OutletInfo } from '@/lib/data';
import { OutletForm, type OutletFormData } from '@/components/forms/OutletForm';
import { useToast } from '@/hooks/use-toast';

export default function OutletsPage() {
  const { firestore, user } = useFirebase();
  const { toast } = useToast();

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedOutlet, setSelectedOutlet] = useState<OutletInfo | null>(null);

  const outletsCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'outlets');
  }, [firestore]);

  const { data: outlets, isLoading: isLoadingOutlets } = useCollection<OutletInfo>(outletsCollectionRef);
  
  const handleOpenSheet = (outlet: OutletInfo | null = null) => {
    setSelectedOutlet(outlet);
    setIsSheetOpen(true);
  };
  
  const handleCloseSheet = () => {
    setIsSheetOpen(false);
    setSelectedOutlet(null);
  };

  const handleSaveOutlet = async (values: OutletFormData) => {
    if (!firestore || !user) return;
    setIsSubmitting(true);
    
    try {
      if (selectedOutlet) {
        // Update existing outlet
        const outletRef = doc(firestore, 'outlets', selectedOutlet.id);
        await updateDoc(outletRef, { ...values });
        toast({
          title: 'Outlet Updated',
          description: `Outlet ${values.name} has been updated.`,
        });
      } else {
        // Add new outlet
        const newDocData = {
          ...values,
          createdAt: serverTimestamp(),
        };
        const docRef = await addDoc(collection(firestore, 'outlets'), newDocData);
        
        // As an owner, automatically add access to this new outlet to myself.
        const userRef = doc(firestore, 'users', user.uid);
        await updateDoc(userRef, {
            outletAccess: arrayUnion(docRef.id)
        });
        
        toast({
          title: 'Outlet Added',
          description: `New outlet ${values.name} has been created.`,
        });
      }
      handleCloseSheet();
    } catch (e: any) {
      console.error('Error saving outlet: ', e);
      toast({
        title: 'An error occurred',
        description: e.message || 'Could not save the outlet.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const sheetTitle = selectedOutlet ? 'Edit Outlet' : 'Add New Outlet';
  const sheetDescription = selectedOutlet
    ? 'Update the details for this outlet.'
    : 'Fill in the information for the new business outlet.';

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur-sm md:px-6">
        <div className="md:hidden">
          <SidebarTrigger />
        </div>
        <div className="flex-1">
          <h1 className="font-headline text-xl font-semibold md:text-2xl">
            Settings: Manage Outlets
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => handleOpenSheet()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Outlet
          </Button>
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>Business Outlets</CardTitle>
            <CardDescription>A list of all business outlets in your organization.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingOutlets ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      <Loader className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : outlets && outlets.length > 0 ? (
                  outlets.filter(item => item.id !== '_init').map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.code}</TableCell>
                      <TableCell>{item.address || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={item.active ? 'default' : 'secondary'}>
                          {item.active ? 'Active' : 'Inactive'}
                        </Badge>
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
                            <DropdownMenuItem onClick={() => handleOpenSheet(item)}>
                              Edit
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      No outlets found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="flex flex-col">
            <SheetHeader>
                <SheetTitle>{sheetTitle}</SheetTitle>
                <SheetDescription>{sheetDescription}</SheetDescription>
            </SheetHeader>
            <div className="py-4 overflow-y-auto flex-1">
                <OutletForm 
                  onSubmit={handleSaveOutlet} 
                  initialData={selectedOutlet ?? undefined}
                  isSubmitting={isSubmitting} 
                />
            </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

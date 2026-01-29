
'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
  useCallback,
} from 'react';
import { useFirebase, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { User, OutletInfo } from '@/lib/data';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader } from 'lucide-react';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection, serverTimestamp } from 'firebase/firestore';

interface OutletContextType {
  outlets: (OutletInfo & { id: string })[] | null;
  selectedOutletId: string | null;
  setSelectedOutletId: (id: string) => void;
  isLoading: boolean;
  addOutlet: (name: string, code: string) => Promise<void>;
}

const OutletContext = createContext<OutletContextType | undefined>(undefined);

export function OutletProvider({ children }: { children: ReactNode }) {
  const { firestore } = useFirebase();
  const { user: authUser, isUserLoading } = useUser();
  const [selectedOutletId, setSelectedOutletId] = useState<string | null>('all');
  const [outlets, setOutlets] = useState<(OutletInfo & { id: string })[] | null>(null);
  const [isLoadingOutlets, setIsLoadingOutlets] = useState(true);

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return doc(firestore, `users/${authUser.uid}`);
  }, [firestore, authUser]);

  const { data: userData, isLoading: isLoadingUserDoc } = useDoc<User>(userDocRef);

  const fetchOutlets = useCallback(async () => {
    if (!firestore || !userData || !userData.outletAccess) {
      if (!isLoadingUserDoc && !isUserLoading) {
        setOutlets([]);
        setIsLoadingOutlets(false);
      }
      return;
    }

    setIsLoadingOutlets(true);
    try {
      const outletPromises = userData.outletAccess.map(outletId =>
        getDoc(doc(firestore, `outlets/${outletId}`))
      );
      const outletSnapshots = await Promise.all(outletPromises);
      const fetchedOutlets = outletSnapshots
        .filter(snap => snap.exists())
        .map(snap => ({ ...snap.data(), id: snap.id } as OutletInfo & { id: string }));
      
      setOutlets(fetchedOutlets);
    } catch (error) {
      console.error("Error fetching outlets:", error);
      setOutlets([]);
    } finally {
      setIsLoadingOutlets(false);
    }
  }, [firestore, userData, isLoadingUserDoc, isUserLoading]);


  useEffect(() => {
    fetchOutlets();
  }, [fetchOutlets]);

  const addOutlet = useCallback(async (name: string, code: string) => {
    if (!firestore || !userDocRef) return;
    
    // Create new outlet document
    const newOutletRef = await addDocumentNonBlocking(collection(firestore, 'outlets'), {
      name,
      code,
      active: true,
      createdAt: serverTimestamp(),
    });

    if (newOutletRef && userData) {
      // TODO: Seed data for the new outlet (products, raw_materials, etc.)
      
      // Update user's outletAccess
      const updatedAccess = [...(userData.outletAccess || []), newOutletRef.id];
      await addDocumentNonBlocking(userDocRef, { outletAccess: updatedAccess });

      // Refetch outlets to update the UI
      await fetchOutlets();
    }
  }, [firestore, userDocRef, userData, fetchOutlets]);


  const value = {
    outlets,
    selectedOutletId,
    setSelectedOutletId,
    isLoading: isLoadingOutlets || isLoadingUserDoc || isUserLoading,
    addOutlet,
  };

  return (
    <OutletContext.Provider value={value}>{children}</OutletContext.Provider>
  );
}

export function useOutlet() {
  const context = useContext(OutletContext);
  if (context === undefined) {
    throw new Error('useOutlet must be used within an OutletProvider');
  }
  return context;
}

export function OutletSwitcher() {
  const {
    outlets,
    selectedOutletId,
    setSelectedOutletId,
    isLoading,
  } = useOutlet();

  if (isLoading) {
    return <Loader className="h-4 w-4 animate-spin" />;
  }

  return (
    <Select
      value={selectedOutletId ?? ''}
      onValueChange={setSelectedOutletId}
      disabled={!outlets || outlets.length === 0}
    >
      <SelectTrigger className="w-[220px] text-sm">
        <SelectValue placeholder="Select Outlet" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Outlets</SelectItem>
        {outlets?.map((outlet) => (
          <SelectItem key={outlet.id} value={outlet.id}>
            {outlet.name} ({outlet.code})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

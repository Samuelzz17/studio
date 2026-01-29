
'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
  useMemo,
} from 'react';
import { useFirebase, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, getDoc, getDocs, query } from 'firebase/firestore';
import type { User, OutletInfo } from '@/lib/data';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader } from 'lucide-react';

interface OutletContextType {
  outlets: OutletInfo[] | null;
  selectedOutletId: string | null;
  setSelectedOutletId: (id: string) => void;
  isLoading: boolean;
}

const OutletContext = createContext<OutletContextType | undefined>(undefined);

export function OutletProvider({ children }: { children: ReactNode }) {
  const { firestore } = useFirebase();
  const { user: authUser, isUserLoading } = useUser();
  const [selectedOutletId, setSelectedOutletId] = useState<string | null>('all');
  const [outlets, setOutlets] = useState<OutletInfo[] | null>(null);
  const [isLoadingOutlets, setIsLoadingOutlets] = useState(true);

  const userDocRef = useMemoFirebase(() => {
     if (!firestore || !authUser) return null;
     return doc(firestore, `users/${authUser.uid}`);
  }, [firestore, authUser]);

  const { data: userData, isLoading: isLoadingUserDoc } = useDoc<User>(userDocRef);

  useEffect(() => {
    const fetchOutlets = async () => {
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
          getDoc(doc(firestore, `outlets/${outletId}/info/details`))
        );
        const outletSnapshots = await Promise.all(outletPromises);
        const fetchedOutlets = outletSnapshots
            .filter(snap => snap.exists())
            .map(snap => ({ id: snap.ref.parent.parent!.id, ...snap.data() } as OutletInfo));
        
        setOutlets(fetchedOutlets);
      } catch (error) {
        console.error("Error fetching outlets:", error);
        setOutlets([]);
      } finally {
        setIsLoadingOutlets(false);
      }
    };

    fetchOutlets();
  }, [firestore, userData, isLoadingUserDoc, isUserLoading]);


  const value = {
    outlets,
    selectedOutletId,
    setSelectedOutletId: (id: string) => setSelectedOutletId(id),
    isLoading: isLoadingOutlets || isLoadingUserDoc || isUserLoading,
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
      <SelectTrigger className="w-[180px] text-sm">
        <SelectValue placeholder="Select Outlet" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Outlets</SelectItem>
        {outlets?.map((outlet) => (
          <SelectItem key={outlet.id} value={outlet.id}>
            {outlet.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

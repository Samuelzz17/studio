
'use client';

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
  useCallback,
} from 'react';
import { useFirebase, useUser, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, where, query, serverTimestamp, writeBatch, documentId } from 'firebase/firestore';
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
  outlets: (OutletInfo & { id: string })[] | null;
  selectedOutletId: string | null;
  setSelectedOutletId: (id: string) => void;
  isLoading: boolean;
  addOutlet: (name: string, code: string) => Promise<void>;
}

const OutletContext = createContext<OutletContextType | undefined>(undefined);

export function OutletProvider({ children }: { children: ReactNode }) {
  const { firestore, auth } = useFirebase();
  const { user: authUser } = useUser();
  const [selectedOutletId, setSelectedOutletId] = useState<string | null>('all');

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !authUser) return null;
    return doc(firestore, `users/${authUser.uid}`);
  }, [firestore, authUser]);
  const { data: userData } = useDoc<User>(userDocRef);

  const outletsQuery = useMemoFirebase(() => {
    if (!firestore || !userData || !Array.isArray(userData.outletAccess) || userData.outletAccess.length === 0) {
      return null;
    }
    
    console.log("outletAccess:", userData.outletAccess)
    console.log("type:", typeof userData.outletAccess)

    // Securely query for outlets the user has access to.
    // An 'in' query with an empty array is invalid, hence the length check.
    return query(
      collection(firestore, 'outlets'),
      where(documentId(), 'in', userData.outletAccess)
    );
  }, [firestore, userData]);

  const { data: outlets, isLoading: isLoadingOutlets } = useCollection<OutletInfo>(outletsQuery);

  const addOutlet = useCallback(async (name: string, code: string) => {
    if (!firestore || !userDocRef) {
      console.error("Firestore or user reference not available.");
      return;
    }
    
    try {
      const newOutletRef = doc(collection(firestore, 'outlets'));
      const batch = writeBatch(firestore);

      // 1. Create the new outlet document
      batch.set(newOutletRef, {
        name,
        code,
        active: true,
        createdAt: serverTimestamp(),
      });

      // 2. Create placeholder documents in subcollections
      const subCollections = [
        "inventory_products", "inventory_raw_materials", "inventory_assets",
        "sales", "purchases_raw", "expenses", "purchases_assets",
      ];
      for (const col of subCollections) {
          const initDocRef = doc(collection(newOutletRef, col), "_init");
          batch.set(initDocRef, {
              createdAt: serverTimestamp(),
              note: "auto created on outlet add",
          });
      }

      // 3. Update user's outletAccess array
      if (userData) {
        const currentAccess = Array.isArray(userData.outletAccess) ? userData.outletAccess : [];
        const updatedAccess = [...currentAccess, newOutletRef.id];
        batch.update(userDocRef, { outletAccess: updatedAccess });
      }

      // 4. Commit all operations
      await batch.commit();
      console.log(`Outlet ${name} created successfully.`);

    } catch (error) {
      console.error("Error adding outlet:", error);
    }
  }, [firestore, userDocRef, userData]);


  const value = {
    outlets,
    selectedOutletId,
    setSelectedOutletId,
    isLoading: isLoadingOutlets,
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

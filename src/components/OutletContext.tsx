'use client';

import {
  collection,
  doc,
  getDocs,
  query,
  where,
  documentId,
  getDoc,
} from 'firebase/firestore';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useFirebase } from '@/firebase/provider';
import type { OutletInfo } from '@/lib/data';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader } from 'lucide-react';

type Outlet = OutletInfo;

type OutletContextType = {
  outlets: Outlet[];
  activeOutlet: Outlet | null;
  setActiveOutlet: (o: Outlet | null) => void;
  loading: boolean;
};

const OutletContext = createContext<OutletContextType | null>(null);

export function OutletProvider({ children }: { children: ReactNode }) {
  const { firestore: db, user } = useFirebase();

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [activeOutlet, setActiveOutlet] = useState<Outlet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If there's no user, we can't fetch anything. Clear state and stop.
    if (!user || !db) {
      setOutlets([]);
      setActiveOutlet(null);
      setLoading(false);
      return;
    }

    const fetchOutlets = async () => {
      setLoading(true);
      try {
        // 1. Get the user's document to find which outlets they can access.
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          console.warn(`User document not found for uid: ${user.uid}. Cannot fetch outlets.`);
          setOutlets([]);
          setActiveOutlet(null);
          return;
        }

        const outletAccess: string[] = userSnap.data().outletAccess || [];

        if (outletAccess.length === 0) {
          console.warn(`User ${user.uid} has an empty 'outletAccess' array. No outlets to fetch.`);
          setOutlets([]);
          setActiveOutlet(null);
          return;
        }

        // 2. Fetch only the outlets the user has access to.
        const q = query(
          collection(db, 'outlets'),
          where(documentId(), 'in', outletAccess)
        );

        const snap = await getDocs(q);

        const data: Outlet[] = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Outlet[];

        setOutlets(data);

        // 3. Set a default active outlet only if one isn't already selected,
        // or if the selected one is no longer valid.
        if (data.length > 0) {
          setActiveOutlet((currentActive) => {
            const isCurrentActiveValid = currentActive && data.some(o => o.id === currentActive.id);
            return isCurrentActiveValid ? currentActive : data[0];
          });
        } else {
          setActiveOutlet(null);
        }
      } catch (err) {
        console.error('❌ Error fetching outlets:', err);
        setOutlets([]);
        setActiveOutlet(null);
      } finally {
        setLoading(false);
      }
    };

    fetchOutlets();
    // This effect should ONLY re-run when the user or db instance changes.
    // The active outlet is UI state managed within the provider, not a trigger for re-fetching.
  }, [user, db]);

  return (
    <OutletContext.Provider
      value={{
        outlets,
        activeOutlet,
        setActiveOutlet,
        loading,
      }}
    >
      {children}
    </OutletContext.Provider>
  );
}

export function useOutlet() {
  const ctx = useContext(OutletContext);
  if (!ctx) {
    throw new Error('useOutlet must be used inside OutletProvider');
  }
  return ctx;
}

export function OutletSwitcher() {
  const { outlets, activeOutlet, setActiveOutlet, loading } = useOutlet();

  const handleValueChange = (outletId: string) => {
    const outlet = outlets.find((o) => o.id === outletId);
    if (outlet) {
      setActiveOutlet(outlet);
    }
  };

  if (loading) {
    return <Loader className="h-4 w-4 animate-spin" />;
  }

  return (
    <Select
      value={activeOutlet?.id ?? ''}
      onValueChange={handleValueChange}
      disabled={!outlets || outlets.length === 0}
    >
      <SelectTrigger className="w-[220px] text-sm">
        <SelectValue placeholder="Select Outlet" />
      </SelectTrigger>
      <SelectContent>
        {outlets?.map((outlet) => (
          <SelectItem key={outlet.id} value={outlet.id}>
            {outlet.name} ({outlet.code})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

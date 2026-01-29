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
    if (!user) {
      setOutlets([]);
      setActiveOutlet(null);
      setLoading(false);
      return;
    }

    const fetchOutlets = async () => {
      try {
        setLoading(true);

        /** 1️⃣ Ambil user doc */
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
          console.warn('User doc not found');
          setLoading(false);
          return;
        }

        const outletAccess: string[] = userSnap.data().outletAccess || [];

        if (outletAccess.length === 0) {
          setOutlets([]);
          setLoading(false);
          return;
        }

        /** 2️⃣ Fetch outlets by ID */
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

        /** 3️⃣ Set default active outlet */
        if (data.length > 0 && (!activeOutlet || !data.some(o => o.id === activeOutlet.id))) {
          setActiveOutlet(data[0]);
        }
      } catch (err) {
        console.error('❌ fetchOutlets error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOutlets();
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

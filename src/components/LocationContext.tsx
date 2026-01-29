
'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Location } from '@/lib/data';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader } from 'lucide-react';

interface LocationContextType {
  locations: Location[] | null;
  selectedLocationId: string | null;
  setSelectedLocationId: (id: string) => void;
  isLoading: boolean;
}

const LocationContext = createContext<LocationContextType | undefined>(
  undefined
);

export function LocationProvider({ children }: { children: ReactNode }) {
  const { firestore, user } = useFirebase();
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    'all'
  );

  const locationsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return collection(firestore, `users/${user.uid}/locations`);
  }, [firestore, user]);

  const { data: locations, isLoading } = useCollection<Location>(locationsQuery);

  useEffect(() => {
    if (
      !isLoading &&
      locations &&
      locations.length > 0 &&
      selectedLocationId === null
    ) {
      setSelectedLocationId('all');
    }
  }, [locations, isLoading, selectedLocationId]);

  const value = {
    locations,
    selectedLocationId,
    setSelectedLocationId: (id: string) => setSelectedLocationId(id),
    isLoading,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
}

export function LocationSwitcher() {
  const {
    locations,
    selectedLocationId,
    setSelectedLocationId,
    isLoading,
  } = useLocation();

  if (isLoading) {
    return <Loader className="h-4 w-4 animate-spin" />;
  }

  return (
    <Select
      value={selectedLocationId ?? ''}
      onValueChange={setSelectedLocationId}
    >
      <SelectTrigger className="w-[180px] text-sm">
        <SelectValue placeholder="Select Location" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Locations</SelectItem>
        {locations?.map((loc) => (
          <SelectItem key={loc.id} value={loc.id}>
            {loc.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

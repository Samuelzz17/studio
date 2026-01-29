
'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { initiateAnonymousSignIn } from '@/firebase/non-blocking-login';
import { Loader } from 'lucide-react';
import { hasLocations, seedInitialData } from '@/lib/seed';

export default function LoginPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  // A memoized function to handle seeding data
  const ensureDataIsSeeded = useCallback(async () => {
    if (firestore && user && !isUserLoading) {
      const userHasLocations = await hasLocations(firestore, user.uid);
      if (!userHasLocations) {
        console.log('New user detected, seeding initial data...');
        await seedInitialData(firestore, user.uid);
        console.log('Data seeding complete.');
      }
      router.push('/');
    }
  }, [firestore, user, isUserLoading, router]);

  useEffect(() => {
    if (!isUserLoading && user) {
      ensureDataIsSeeded();
    }
  }, [user, isUserLoading, ensureDataIsSeeded]);

  const handleAnonymousLogin = () => {
    initiateAnonymousSignIn(auth);
  };

  if (isUserLoading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Login</CardTitle>
          <CardDescription>
            Sign in to access the restaurant dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-muted-foreground">
            For this demo, please proceed with anonymous sign-in.
          </p>
        </CardContent>
        <CardFooter>
          <Button className="w-full" onClick={handleAnonymousLogin}>
            Sign In Anonymously
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

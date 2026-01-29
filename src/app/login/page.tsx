
'use client';

import { useEffect, useCallback, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  useAuth,
  useUser,
  useFirestore,
  initiateAnonymousSignIn,
  initiateEmailSignIn,
} from '@/firebase';
import { Loader } from 'lucide-react';
import { hasUserData, seedInitialData } from '@/lib/seed';

export default function LoginPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const ensureDataIsSeeded = useCallback(async () => {
    if (firestore && user && !isUserLoading) {
      const userHasData = await hasUserData(firestore, user.uid);
      if (!userHasData) {
        console.log('New user detected, seeding initial data...');
        await seedInitialData(firestore, user.uid);
        console.log('Data seeding complete.');
      }
      router.push('/dashboard');
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

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (email && password) {
      // In a real app, you might want to create a user if they don't exist.
      // For now, we'll just attempt to sign in.
      initiateEmailSignIn(auth, email, password);
    }
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
            Enter your email below to login to your account.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleEmailLogin}>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full">
              Sign In
            </Button>
          </CardContent>
        </form>
        <CardFooter className="flex-col gap-4 pt-4">
          <div className="relative w-full">
            <Separator />
            <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-background px-2 text-xs text-muted-foreground">
              OR
            </span>
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleAnonymousLogin}
          >
            Sign In Anonymously (Demo)
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}


import type { Metadata } from 'next';
import './globals.css';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { SiteSidebar } from '@/components/SiteSidebar';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { LocationProvider } from '@/components/LocationContext';

export const metadata: Metadata = {
  title: 'SR',
  description: 'A modern Restaurant Management System',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <SidebarProvider>
          <FirebaseClientProvider>
            <LocationProvider>
              <SiteSidebar />
              <SidebarInset>
                <main>{children}</main>
              </SidebarInset>
            </LocationProvider>
          </FirebaseClientProvider>
        </SidebarProvider>
        <Toaster />
      </body>
    </html>
  );
}

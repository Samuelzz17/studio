
'use client';

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { SiteSidebar } from '@/components/SiteSidebar';
import { LocationProvider } from '@/components/LocationContext';
import withAuth from '@/components/withAuth';

function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <LocationProvider>
        <SiteSidebar />
        <SidebarInset>
          <main>{children}</main>
        </SidebarInset>
      </LocationProvider>
    </SidebarProvider>
  );
}

export default withAuth(DashboardLayout);

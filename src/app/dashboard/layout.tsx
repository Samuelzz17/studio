
'use client';

import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { SiteSidebar } from '@/components/SiteSidebar';
import { OutletProvider } from '@/components/OutletContext';
import withAuth from '@/components/withAuth';

function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <OutletProvider>
        <SiteSidebar />
        <SidebarInset>
          <main>{children}</main>
        </SidebarInset>
      </OutletProvider>
    </SidebarProvider>
  );
}

export default withAuth(DashboardLayout);

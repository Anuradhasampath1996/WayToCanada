import React from "react";
import { cookies } from "next/headers";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar";
import { SiteHeader } from "@/components/layout/header";
import { DashboardClientWrapper } from "@/components/layout/dashboard-client-wrapper";

export default async function UserDashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const defaultOpen =
    cookieStore.get("sidebar_state")?.value === "true" ||
    cookieStore.get("sidebar_state") === undefined;

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={
        {
          "--sidebar-width": "18.5rem",
          "--header-height": "calc(var(--spacing) * 14)",
        } as React.CSSProperties
      }
    >
      <DashboardClientWrapper>
        <AppSidebar variant="sidebar" />
        <SidebarInset className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
          <SiteHeader />
          <div className="flex min-w-0 flex-1 flex-col w-full overflow-x-hidden bg-muted/40">
            <div className="w-full min-w-0 flex-1 overflow-x-hidden px-3 py-4 sm:px-5 md:px-8 md:py-6">
              {children}
            </div>
          </div>
        </SidebarInset>
      </DashboardClientWrapper>
    </SidebarProvider>
  );
}

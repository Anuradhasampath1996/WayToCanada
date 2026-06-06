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
          "--sidebar-width": "calc(var(--spacing) * 56)",
          "--header-height": "calc(var(--spacing) * 14)",
        } as React.CSSProperties
      }
    >
      <DashboardClientWrapper>
        <AppSidebar variant="sidebar" />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <SiteHeader />
          <div className="flex min-w-0 flex-1 flex-col w-full">
            <div className="w-full min-w-0 flex-1 px-4 py-4 md:px-6 md:py-5">
              {children}
            </div>
          </div>
        </SidebarInset>
      </DashboardClientWrapper>
    </SidebarProvider>
  );
}

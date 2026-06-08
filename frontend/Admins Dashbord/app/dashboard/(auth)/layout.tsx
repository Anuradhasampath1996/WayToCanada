import React from "react";
import { cookies } from "next/headers";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar";
import { SiteHeader } from "@/components/layout/header";

export default async function AuthLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const defaultOpen =
    cookieStore.get("sidebar_state")?.value === "true" ||
    cookieStore.get("sidebar_state") === undefined;

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      style={
        {
          "--sidebar-width": "16rem",
          "--header-height": "3.5rem",
          "--content-padding": "1rem",
          "--content-full-height": "calc(100vh - var(--header-height) - (var(--content-padding) * 2))"
        } as React.CSSProperties
      }>
      <AppSidebar variant="sidebar" />
      <SidebarInset className="min-w-0">
        <SiteHeader />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="@container/main w-full max-w-none min-w-0 px-(--content-padding) py-(--content-padding)">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

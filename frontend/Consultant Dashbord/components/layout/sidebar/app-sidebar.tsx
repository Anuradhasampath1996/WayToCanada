"use client";

import * as React from "react";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useIsTablet } from "@/hooks/use-mobile";
import Link from "next/link";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { NavMain } from "@/components/layout/sidebar/nav-main";
import { NavUser } from "@/components/layout/sidebar/nav-user";
import { ScrollArea } from "@/components/ui/scroll-area";
import Logo from "@/components/layout/logo";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { setOpen, setOpenMobile, isMobile } = useSidebar();
  const isTablet = useIsTablet();

  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [pathname]);

  useEffect(() => {
    setOpen(!isTablet);
  }, [isTablet]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="border-b border-sidebar-border/70 bg-gradient-to-br from-primary/5 via-transparent to-transparent p-3">
        <Link
          href="/consultantdashboard"
          className="flex items-center gap-3 rounded-xl border border-sidebar-border/60 bg-background/70 p-2.5 shadow-sm transition-colors hover:border-primary/25 hover:bg-background">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/15">
            <Logo />
          </div>
          <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-bold tracking-tight text-foreground">WayToCanada</p>
            <p className="truncate text-[11px] text-muted-foreground">Consultant Portal</p>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent className="bg-sidebar/50">
        <ScrollArea className="h-full">
          <NavMain />
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/70 bg-muted/20 p-2">
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}

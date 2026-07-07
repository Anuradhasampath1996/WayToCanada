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
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
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
      <SidebarHeader className="border-b border-sidebar-border/40 bg-gradient-to-br from-sidebar-primary/[0.07] via-transparent to-transparent px-3 py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="h-auto justify-center rounded-lg bg-transparent px-1 py-1 shadow-none ring-0 hover:bg-sidebar-accent/30 group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:p-1!"
            >
              <Link href="/consultantdashboard" className="flex w-full items-center justify-center">
                <Logo variant="sidebar" />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="px-1.5">
        <ScrollArea className="h-full [&>[data-radix-scroll-area-viewport]>div]:!block">
          <NavMain />
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/40 bg-sidebar-accent/10 p-2.5">
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}

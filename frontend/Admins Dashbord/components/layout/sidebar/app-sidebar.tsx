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
  SidebarRail,
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
  }, [pathname, isMobile, setOpenMobile]);

  useEffect(() => {
    setOpen(!isTablet);
  }, [isTablet, setOpen]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="border-b border-sidebar-border/40 bg-gradient-to-br from-sidebar-primary/[0.07] via-transparent to-transparent p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              asChild
              className="h-[52px] rounded-xl bg-sidebar/60 px-2.5 shadow-sm ring-1 ring-sidebar-border/50 transition-all hover:bg-sidebar-accent/40 hover:ring-sidebar-primary/20"
            >
              <Link href="/admindashboard">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sidebar-primary to-sidebar-primary/85 text-sidebar-primary-foreground shadow-md [&_img]:size-5 [&_img]:rounded-md">
                  <Logo />
                </div>
                <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold tracking-tight">RCICMASTER</span>
                  <span className="truncate text-xs text-sidebar-foreground/55">Admin Portal</span>
                </div>
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
      <SidebarRail />
    </Sidebar>
  );
}

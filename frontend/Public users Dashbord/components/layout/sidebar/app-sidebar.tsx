"use client";

import * as React from "react";
import { useEffect } from "react";
import { Users2Icon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useIsTablet } from "@/hooks/use-mobile";
import { useClientJourneyOptional } from "@/context/client-journey-context";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { NavMain } from "@/components/layout/sidebar/nav-main";
import { NavUser } from "@/components/layout/sidebar/nav-user";
import { ScrollArea } from "@/components/ui/scroll-area";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { setOpen, setOpenMobile, isMobile } = useSidebar();
  const isTablet = useIsTablet();
  const journey = useClientJourneyOptional();
  const consultant = journey?.consultant;
  const brandLabel = consultant?.company_name || consultant?.name || "RCICMASTER";
  const brandLogo = consultant?.company_logo ?? null;

  useEffect(() => {
    if (isMobile) setOpenMobile(false);
  }, [pathname]);

  useEffect(() => {
    setOpen(!isTablet);
  }, [isTablet]);

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="border-b border-sidebar-border/60 px-3 py-3">
        <div
          className={cn(
            "flex w-full items-center justify-center rounded-xl border border-sidebar-border/50 bg-background shadow-sm",
            "min-h-[4.5rem] px-4 py-3",
            "group-data-[collapsible=icon]:min-h-0 group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:p-1.5",
          )}
        >
          {journey?.loading ? (
            <div
              className={cn(
                "animate-pulse rounded-lg bg-muted",
                "h-10 w-32 max-w-full",
                "group-data-[collapsible=icon]:h-7 group-data-[collapsible=icon]:w-7",
              )}
            />
          ) : brandLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brandLogo}
              alt={brandLabel}
              className={cn(
                "block max-h-12 w-auto max-w-full object-contain object-center",
                "group-data-[collapsible=icon]:max-h-7 group-data-[collapsible=icon]:max-w-7",
              )}
            />
          ) : (
            <div
              className={cn(
                "flex items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/15",
                "size-12 group-data-[collapsible=icon]:size-7",
              )}
            >
              <Users2Icon className="size-5 text-primary group-data-[collapsible=icon]:size-4" />
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <ScrollArea className="h-full">
          <NavMain />
        </ScrollArea>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}

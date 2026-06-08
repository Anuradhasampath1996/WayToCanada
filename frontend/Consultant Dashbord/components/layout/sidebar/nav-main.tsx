"use client";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  HomeIcon,
  ScaleIcon,
  SquareKanbanIcon,
  UserPlusIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavItem = {
  title: string;
  href: string;
  description?: string;
  icon: LucideIcon;
  badge?: string;
  match?: (pathname: string) => boolean;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

export const navItems: NavGroup[] = [
  {
    title: "Overview",
    items: [
      {
        title: "Dashboard",
        href: "/consultantdashboard",
        description: "Home & activity",
        icon: HomeIcon,
        match: (p) => p === "/consultantdashboard" || p === "/dashboard/default",
      },
      {
        title: "Legislations Hub",
        href: "/dashboard/legislations",
        description: "Acts & regulations",
        icon: ScaleIcon,
        badge: "New",
        match: (p) => p.startsWith("/dashboard/legislations"),
      },
    ],
  },
  {
    title: "Client Work",
    items: [
      {
        title: "All Clients",
        href: "/dashboard/clients",
        description: "Profiles & workspaces",
        icon: UsersIcon,
        match: (p) =>
          p.startsWith("/dashboard/clients") && !p.startsWith("/dashboard/clients/new"),
      },
      {
        title: "Add New Client",
        href: "/dashboard/clients/new",
        description: "Invite a new applicant",
        icon: UserPlusIcon,
        match: (p) => p.startsWith("/dashboard/clients/new"),
      },
      {
        title: "Application Progress Board",
        href: "/dashboard/case-pipeline",
        description: "Retainer to submission stages",
        icon: SquareKanbanIcon,
        match: (p) => p.startsWith("/dashboard/case-pipeline"),
      },
    ],
  },
];

function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.match) return item.match(pathname);
  return pathname === item.href;
}

export function NavMain() {
  const pathname = usePathname();

  return (
    <div className="space-y-5 px-2 py-3">
      {navItems.map((group, groupIndex) => (
        <SidebarGroup key={group.title} className="p-0">
          <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
            {group.title}
          </SidebarGroupLabel>
          <SidebarGroupContent className="mt-1.5">
            <SidebarMenu className="gap-1">
              {group.items.map((item) => {
                const active = isItemActive(item, pathname);
                const Icon = item.icon;

                return (
                  <SidebarMenuItem key={item.title}>
                    <Link
                      href={item.href}
                      className={cn(
                        "group/nav-item relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200",
                        "hover:bg-primary/8 hover:shadow-sm",
                        active
                          ? "bg-primary/12 text-foreground shadow-sm ring-1 ring-primary/15"
                          : "text-muted-foreground hover:text-foreground",
                      )}>
                      {active && (
                        <span className="absolute inset-y-2.5 left-0 w-1 rounded-r-full bg-primary" />
                      )}
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
                          active
                            ? "border-primary/20 bg-primary text-primary-foreground shadow-sm"
                            : "border-border/60 bg-background/80 group-hover/nav-item:border-primary/20 group-hover/nav-item:bg-primary/5",
                        )}>
                        <Icon className="size-4" strokeWidth={active ? 2.25 : 2} />
                      </span>
                      <span className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                        <span className="flex items-center gap-2">
                          <span className={cn("truncate text-sm", active ? "font-semibold" : "font-medium")}>
                            {item.title}
                          </span>
                          {item.badge && (
                            <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                              {item.badge}
                            </span>
                          )}
                        </span>
                        {item.description && (
                          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground/90">
                            {item.description}
                          </span>
                        )}
                      </span>
                    </Link>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
          {groupIndex < navItems.length - 1 && (
            <div className="mx-3 mt-4 h-px bg-border/60 group-data-[collapsible=icon]:hidden" />
          )}
        </SidebarGroup>
      ))}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
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
  HardDriveIcon,
  MessagesSquareIcon,
  MegaphoneIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";
const TOKEN_KEY = "wtc_consultant_token";
const COOKIE_NAME = "wtc_consultant_token";

function authHeaders(): Record<string, string> {
  const token =
    (typeof document !== "undefined"
      ? document.cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`))?.[1]
      : undefined) ?? (typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null) ?? "";
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

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
      {
        title: "My Document Storage",
        href: "/dashboard/storage",
        description: "Personal folders & files (3 GB free)",
        icon: HardDriveIcon,
        match: (p) => p.startsWith("/dashboard/storage"),
      },
    ],
  },
  {
    title: "Marketing",
    items: [
      {
        title: "Marketing Services",
        href: "/dashboard/marketing",
        description: "Website, social media & Google Ads",
        icon: MegaphoneIcon,
        match: (p) => p.startsWith("/dashboard/marketing"),
      },
    ],
  },
  {
    title: "Community",
    items: [
      {
        title: "RCIC Community",
        href: "/dashboard/rcic-community",
        description: "Peer forum for consultants",
        icon: MessagesSquareIcon,
        match: (p) => p.startsWith("/dashboard/rcic-community"),
      },
    ],
  },
];

function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.match) return item.match(pathname);
  return pathname === item.href;
}

function NavLink({
  item,
  pathname,
  unreadCount = 0,
}: {
  item: NavItem;
  pathname: string;
  unreadCount?: number;
}) {
  const active = isItemActive(item, pathname);
  const Icon = item.icon;
  const showUnread = unreadCount > 0;

  return (
    <SidebarMenuItem>
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
            "relative flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors",
            active
              ? "border-primary/20 bg-primary text-primary-foreground shadow-sm"
              : "border-border/60 bg-background/80 group-hover/nav-item:border-primary/20 group-hover/nav-item:bg-primary/5",
          )}>
          <Icon className="size-4" strokeWidth={active ? 2.25 : 2} />
          {showUnread && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-0.5 text-[9px] font-bold text-white ring-2 ring-background">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
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
            {showUnread && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
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
}

function NavGroupBlock({
  group,
  pathname,
  showDivider,
  unreadByHref,
}: {
  group: NavGroup;
  pathname: string;
  showDivider?: boolean;
  unreadByHref?: Record<string, number>;
}) {
  return (
    <SidebarGroup className="p-0">
      <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
        {group.title}
      </SidebarGroupLabel>
      <SidebarGroupContent className="mt-1.5">
        <SidebarMenu className="gap-1">
          {group.items.map((item) => (
            <NavLink
              key={item.title}
              item={item}
              pathname={pathname}
              unreadCount={unreadByHref?.[item.href] ?? 0}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
      {showDivider && (
        <div className="mx-3 mt-4 h-px bg-border/60 group-data-[collapsible=icon]:hidden" />
      )}
    </SidebarGroup>
  );
}

export function NavMain() {
  const pathname = usePathname();
  const mainGroups = navItems.slice(0, -1);
  const bottomGroup = navItems[navItems.length - 1];
  const [rcicUnread, setRcicUnread] = useState(0);
  const onCommunityPage = pathname.startsWith("/dashboard/rcic-community");

  const loadRcicUnread = useCallback(async () => {
    if (onCommunityPage) {
      setRcicUnread(0);
      return;
    }
    try {
      const res = await fetch(`${API}/consultant/rcic-community/unread-count`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setRcicUnread(data.count ?? 0);
    } catch {
      /* ignore */
    }
  }, [onCommunityPage]);

  useEffect(() => {
    void loadRcicUnread();
    const id = setInterval(() => void loadRcicUnread(), 30000);
    return () => clearInterval(id);
  }, [loadRcicUnread]);

  useEffect(() => {
    const onSeen = () => setRcicUnread(0);
    window.addEventListener("rcic-community-seen", onSeen);
    return () => window.removeEventListener("rcic-community-seen", onSeen);
  }, []);

  const unreadByHref: Record<string, number> = {
    "/dashboard/rcic-community": rcicUnread,
  };

  return (
    <div className="flex min-h-full flex-col px-2 py-3">
      <div className="space-y-5">
        {mainGroups.map((group, i) => (
          <NavGroupBlock
            key={group.title}
            group={group}
            pathname={pathname}
            showDivider={i < mainGroups.length - 1}
          />
        ))}
      </div>

      <div className="mt-auto border-t border-border/60 pt-4">
        <NavGroupBlock group={bottomGroup} pathname={pathname} unreadByHref={unreadByHref} />
      </div>
    </div>
  );
}

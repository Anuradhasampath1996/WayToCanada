"use client";

import { useCallback, useEffect, useState } from "react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  HomeIcon,
  ScaleIcon,
  MailIcon,
  SquareKanbanIcon,
  UserPlusIcon,
  UsersIcon,
  InboxIcon,
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
      {
        title: "Letters",
        href: "/dashboard/letters",
        description: "AI letter drafting",
        icon: MailIcon,
        badge: "New",
        match: (p) => p.startsWith("/dashboard/letters"),
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
        title: "Client Requests",
        href: "/dashboard/client-requests",
        description: "Applicants who chose you",
        icon: InboxIcon,
        match: (p) => p.startsWith("/dashboard/client-requests"),
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
      <SidebarMenuButton
        asChild
        isActive={active}
        tooltip={item.title}
        className={cn(
          "h-10 gap-3 rounded-xl px-2.5 transition-all duration-200",
          "hover:bg-sidebar-accent/55",
          "data-[active=true]:bg-sidebar-primary/10 data-[active=true]:font-medium data-[active=true]:text-sidebar-foreground data-[active=true]:shadow-sm",
          "data-[active=true]:ring-1 data-[active=true]:ring-sidebar-primary/15",
        )}
      >
        <Link href={item.href} className="min-w-0">
          <span
            className={cn(
              "relative flex size-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                : "bg-sidebar-accent/45 text-sidebar-foreground/65 group-hover/menu-item:bg-sidebar-accent group-hover/menu-item:text-sidebar-foreground",
            )}
          >
            <Icon className="size-4" strokeWidth={active ? 2.25 : 2} />
            {showUnread && (
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-0.5 text-[8px] font-bold text-white ring-2 ring-sidebar">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px]">{item.title}</span>
          {item.badge && (
            <span className="shrink-0 rounded-md bg-emerald-500/12 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              {item.badge}
            </span>
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function NavGroupBlock({
  group,
  pathname,
  unreadByHref,
}: {
  group: NavGroup;
  pathname: string;
  unreadByHref?: Record<string, number>;
}) {
  return (
    <SidebarGroup className="px-1 py-0">
      <div className="mb-1.5 flex items-center gap-2 px-2 group-data-[collapsible=icon]:hidden">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/45">
          {group.title}
        </span>
        <span className="h-px flex-1 bg-gradient-to-r from-sidebar-border/80 to-transparent" />
      </div>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5">
          {group.items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              pathname={pathname}
              unreadCount={unreadByHref?.[item.href] ?? 0}
            />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function NavMain() {
  const pathname = usePathname();
  const mainGroups = navItems.slice(0, -1);
  const bottomGroup = navItems[navItems.length - 1];
  const [rcicUnread, setRcicUnread] = useState(0);
  const [clientRequestCount, setClientRequestCount] = useState(0);
  const onCommunityPage = pathname.startsWith("/dashboard/rcic-community");
  const onClientRequestsPage = pathname.startsWith("/dashboard/client-requests");

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

  const loadClientRequestCount = useCallback(async () => {
    if (onClientRequestsPage) {
      setClientRequestCount(0);
      return;
    }
    try {
      const res = await fetch(`${API}/consultant/client-requests/pending-count`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json();
      setClientRequestCount(data.count ?? 0);
    } catch {
      /* ignore */
    }
  }, [onClientRequestsPage]);

  useEffect(() => {
    void loadRcicUnread();
    void loadClientRequestCount();
    const id = setInterval(() => {
      void loadRcicUnread();
      void loadClientRequestCount();
    }, 30000);
    return () => clearInterval(id);
  }, [loadRcicUnread, loadClientRequestCount]);

  useEffect(() => {
    const onSeen = () => setRcicUnread(0);
    window.addEventListener("rcic-community-seen", onSeen);
    return () => window.removeEventListener("rcic-community-seen", onSeen);
  }, []);

  const unreadByHref: Record<string, number> = {
    "/dashboard/rcic-community": rcicUnread,
    "/dashboard/client-requests": clientRequestCount,
  };

  return (
    <div className="flex min-h-full flex-col gap-2 px-0.5 py-3">
      <div className="space-y-5">
        {mainGroups.map((group) => (
          <NavGroupBlock
            key={group.title}
            group={group}
            pathname={pathname}
            unreadByHref={unreadByHref}
          />
        ))}
      </div>

      <div className="mt-auto rounded-xl border border-sidebar-border/50 bg-sidebar-accent/15 p-1.5 backdrop-blur-[2px]">
        <NavGroupBlock group={bottomGroup} pathname={pathname} unreadByHref={unreadByHref} />
      </div>
    </div>
  );
}

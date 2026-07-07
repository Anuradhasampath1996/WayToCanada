"use client";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  BadgeDollarSignIcon,
  BellIcon,
  Building2Icon,
  CalculatorIcon,
  ChevronRight,
  CreditCardIcon,
  FolderDotIcon,
  GraduationCapIcon,
  HardDriveIcon,
  Headphones,
  KeyRoundIcon,
  LandmarkIcon,
  LayoutDashboardIcon,
  MailIcon,
  MegaphoneIcon,
  MessageCircle,
  MessagesSquareIcon,
  ScaleIcon,
  UsersIcon,
  WalletMinimalIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { usePathname } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  items?: { title: string; href: string }[];
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
        href: "/admindashboard",
        icon: LayoutDashboardIcon,
        match: (p) => p === "/admindashboard",
      },
    ],
  },
  {
    title: "Users & Access",
    items: [
      {
        title: "Users",
        href: "/admindashboard/users/admins",
        icon: UsersIcon,
        match: (p) => p.startsWith("/admindashboard/users"),
        items: [
          { title: "Admin Users", href: "/admindashboard/users/admins" },
          { title: "RCIC Users", href: "/admindashboard/users/rcic" },
          { title: "Public Users", href: "/admindashboard/users/public" },
          { title: "Immigration Consultants", href: "/admindashboard/users/immigration-consult" },
        ],
      },
      {
        title: "Integrations",
        href: "/admindashboard/integrations",
        icon: KeyRoundIcon,
        match: (p) => p.startsWith("/admindashboard/integrations"),
      },
    ],
  },
  {
    title: "Billing & Packages",
    items: [
      {
        title: "Payment Gateway",
        href: "/admindashboard/payment-gateway",
        icon: CreditCardIcon,
        match: (p) => p.startsWith("/admindashboard/payment-gateway"),
      },
      {
        title: "Subscription Packages",
        href: "/admindashboard/subscription-packages",
        icon: BadgeDollarSignIcon,
        match: (p) => p.startsWith("/admindashboard/subscription-packages"),
      },
      {
        title: "Storage Packages",
        href: "/admindashboard/storage-packages",
        icon: HardDriveIcon,
        match: (p) => p.startsWith("/admindashboard/storage-packages"),
      },
      {
        title: "Client Payments",
        href: "/admindashboard/client-payment-requests",
        icon: WalletMinimalIcon,
        match: (p) => p.startsWith("/admindashboard/client-payment-requests"),
      },
      {
        title: "Storage Subscriptions",
        href: "/admindashboard/storage-subscriptions",
        icon: HardDriveIcon,
        match: (p) => p.startsWith("/admindashboard/storage-subscriptions"),
      },
      {
        title: "Subscription Payments",
        href: "/admindashboard/subscription-payments",
        icon: WalletMinimalIcon,
        match: (p) => p.startsWith("/admindashboard/subscription-payments"),
      },
      {
        title: "Company & Invoices",
        href: "/admindashboard/company-invoice-settings",
        icon: Building2Icon,
        match: (p) => p.startsWith("/admindashboard/company-invoice-settings"),
      },
    ],
  },
  {
    title: "Platform",
    items: [
      {
        title: "Application Packages",
        href: "/admindashboard/application-packages",
        icon: FolderDotIcon,
        match: (p) => p.startsWith("/admindashboard/application-packages"),
      },
      {
        title: "LMS Management",
        href: "/admindashboard/lms",
        icon: GraduationCapIcon,
        match: (p) => p.startsWith("/admindashboard/lms"),
      },
      {
        title: "CRS Calculator Sync",
        href: "/admindashboard/crs-calculator-sync",
        icon: CalculatorIcon,
        match: (p) => p.startsWith("/admindashboard/crs-calculator-sync"),
      },
      {
        title: "GST/HST Tax Sync",
        href: "/admindashboard/gst-hst-sync",
        icon: LandmarkIcon,
        match: (p) => p.startsWith("/admindashboard/gst-hst-sync"),
      },
      {
        title: "Legislation Hub",
        href: "/admindashboard/legislations-hub",
        icon: ScaleIcon,
        badge: "New",
        match: (p) => p.startsWith("/admindashboard/legislations-hub"),
      },
    ],
  },
  {
    title: "Marketing",
    items: [
      {
        title: "Marketing Services",
        href: "/admindashboard/marketing-services",
        icon: MegaphoneIcon,
        match: (p) => p.startsWith("/admindashboard/marketing-services"),
      },
      {
        title: "Marketing Orders",
        href: "/admindashboard/marketing-orders",
        icon: MegaphoneIcon,
        match: (p) => p.startsWith("/admindashboard/marketing-orders"),
      },
    ],
  },
  {
    title: "Communications",
    items: [
      {
        title: "Notifications",
        href: "/admindashboard/notifications",
        icon: BellIcon,
        match: (p) => p.startsWith("/admindashboard/notifications"),
      },
      {
        title: "Email Templates",
        href: "/admindashboard/email-templates",
        icon: MailIcon,
        match: (p) => p.startsWith("/admindashboard/email-templates"),
      },
      {
        title: "WhatsApp Inbox",
        href: "/admindashboard/whatsapp-inbox",
        icon: MessageCircle,
        match: (p) => p.startsWith("/admindashboard/whatsapp-inbox"),
      },
      {
        title: "RCIC Community",
        href: "/admindashboard/rcic-community",
        icon: MessagesSquareIcon,
        match: (p) => p.startsWith("/admindashboard/rcic-community"),
      },
      {
        title: "Consultant Support",
        href: "/admindashboard/support-tickets",
        icon: Headphones,
        match: (p) => p.startsWith("/admindashboard/support-tickets"),
      },
    ],
  },
];

function isItemActive(item: NavItem, pathname: string): boolean {
  if (item.match) return item.match(pathname);
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

const navButtonClass = cn(
  "h-10 gap-3 rounded-xl px-2.5 transition-all duration-200",
  "hover:bg-sidebar-accent/55",
  "data-[active=true]:bg-sidebar-primary/10 data-[active=true]:font-medium data-[active=true]:text-sidebar-foreground data-[active=true]:shadow-sm",
  "data-[active=true]:ring-1 data-[active=true]:ring-sidebar-primary/15",
);

function NavIcon({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "relative flex size-8 shrink-0 items-center justify-center rounded-lg transition-all duration-200",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
          : "bg-sidebar-accent/45 text-sidebar-foreground/65 group-hover/menu-item:bg-sidebar-accent group-hover/menu-item:text-sidebar-foreground",
      )}
    >
      {children}
    </span>
  );
}

function NavBadge({ label }: { label: string }) {
  return (
    <span className="shrink-0 rounded-md bg-emerald-500/12 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
      {label}
    </span>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isItemActive(item, pathname);
  const Icon = item.icon;

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={item.title} className={navButtonClass}>
        <Link href={item.href} className="min-w-0">
          <NavIcon active={active}>
            <Icon className="size-4" strokeWidth={active ? 2.25 : 2} />
          </NavIcon>
          <span className="min-w-0 flex-1 truncate text-[13px]">{item.title}</span>
          {item.badge ? <NavBadge label={item.badge} /> : null}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function NavCollapsible({ item, pathname, isMobile }: { item: NavItem; pathname: string; isMobile: boolean }) {
  const active = isItemActive(item, pathname);
  const Icon = item.icon;
  const subItems = item.items ?? [];

  return (
    <SidebarMenuItem>
      <div className="hidden group-data-[collapsible=icon]:block">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton tooltip={item.title} isActive={active} className={navButtonClass}>
              <NavIcon active={active}>
                <Icon className="size-4" strokeWidth={active ? 2.25 : 2} />
              </NavIcon>
              <span className="min-w-0 flex-1 truncate text-[13px]">{item.title}</span>
              <ChevronRight className="ml-auto size-4 opacity-50" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={isMobile ? "bottom" : "right"}
            align={isMobile ? "end" : "start"}
            className="min-w-52 rounded-xl"
          >
            <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
            {subItems.map((sub) => (
              <DropdownMenuItem key={sub.href} asChild>
                <Link href={sub.href} className={cn(pathname === sub.href && "bg-accent font-medium")}>
                  {sub.title}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Collapsible
        className="group/collapsible block group-data-[collapsible=icon]:hidden"
        defaultOpen={active}
      >
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip={item.title} isActive={active} className={navButtonClass}>
            <NavIcon active={active}>
              <Icon className="size-4" strokeWidth={active ? 2.25 : 2} />
            </NavIcon>
            <span className="min-w-0 flex-1 truncate text-[13px]">{item.title}</span>
            <ChevronRight className="ml-auto size-4 opacity-50 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub className="mx-2 border-l border-sidebar-border/60 pl-2">
            {subItems.map((sub) => (
              <SidebarMenuSubItem key={sub.href}>
                <SidebarMenuSubButton
                  asChild
                  isActive={pathname === sub.href}
                  className="rounded-lg text-[13px] hover:bg-sidebar-accent/55 data-[active=true]:bg-sidebar-primary/10 data-[active=true]:font-medium"
                >
                  <Link href={sub.href}>{sub.title}</Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
    </SidebarMenuItem>
  );
}

function NavGroupBlock({ group, pathname, isMobile }: { group: NavGroup; pathname: string; isMobile: boolean }) {
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
          {group.items.map((item) =>
            item.items && item.items.length > 0 ? (
              <NavCollapsible key={item.title} item={item} pathname={pathname} isMobile={isMobile} />
            ) : (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ),
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function NavMain() {
  const pathname = usePathname();
  const { isMobile } = useSidebar();

  return (
    <div className="space-y-3 py-2">
      {navItems.map((group) => (
        <NavGroupBlock key={group.title} group={group} pathname={pathname} isMobile={isMobile} />
      ))}
    </div>
  );
}

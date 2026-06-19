"use client";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar
} from "@/components/ui/sidebar";
import {
  BadgeDollarSignIcon,
  CalculatorIcon,
  ChevronRight,
  CreditCardIcon,
  LandmarkIcon,
  GraduationCapIcon,
  FolderDotIcon,
  HardDriveIcon,
  LayoutDashboardIcon,
  ScaleIcon,
  UsersIcon,
  WalletMinimalIcon,
  MegaphoneIcon,
  KeyRoundIcon,
  MessageCircle,
  Headphones,
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
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

type NavGroup = {
  title: string;
  items: NavItem;
};

type NavItem = {
  title: string;
  href: string;
  icon?: LucideIcon;
  isNew?: boolean;
  newTab?: boolean;
  items?: NavItem;
}[];

export const navItems: NavGroup[] = [
  {
    title: "Administration",
    items: [
      {
        title: "Dashboard",
        href: "/admindashboard",
        icon: LayoutDashboardIcon,
      },
      {
        title: "Users",
        href: "/admindashboard/users/admins",
        icon: UsersIcon,
        items: [
          { title: "Admin Users", href: "/admindashboard/users/admins" },
          { title: "RCIC Users", href: "/admindashboard/users/rcic" },
          { title: "Public Users", href: "/admindashboard/users/public" },
          { title: "Immigration Consultants", href: "/admindashboard/users/immigration-consult" }
        ]
      },
      {
        title: "Payment Gateway",
        href: "/admindashboard/payment-gateway",
        icon: CreditCardIcon
      },
      {
        title: "Integrations",
        href: "/admindashboard/integrations",
        icon: KeyRoundIcon,
      },
      {
        title: "Subscription Packages",
        href: "/admindashboard/subscription-packages",
        icon: BadgeDollarSignIcon
      },
      {
        title: "Storage Packages",
        href: "/admindashboard/storage-packages",
        icon: HardDriveIcon
      },
      {
        title: "Marketing Services",
        href: "/admindashboard/marketing-services",
        icon: MegaphoneIcon,
        isNew: true,
      },
      {
        title: "Subscription Payments",
        href: "/admindashboard/subscription-payments",
        icon: WalletMinimalIcon
      },
      {
        title: "Application Package Manage",
        href: "/admindashboard/application-packages",
        icon: FolderDotIcon
      },
      {
        title: "LMS Management",
        href: "/admindashboard/lms",
        icon: GraduationCapIcon
      },
      {
        title: "CRS Calculator Sync",
        href: "/admindashboard/crs-calculator-sync",
        icon: CalculatorIcon
      },
      {
        title: "GST/HST Tax Sync",
        href: "/admindashboard/gst-hst-sync",
        icon: LandmarkIcon,
      },
      {
        title: "Legislation Hub",
        href: "/admindashboard/legislations-hub",
        icon: ScaleIcon,
        isNew: true
      },
      {
        title: "Notifications",
        href: "/admindashboard/notifications",
        icon: MegaphoneIcon,
      },
      {
        title: "RCIC Community",
        href: "/admindashboard/rcic-community",
        icon: MessageCircle,
        isNew: true,
      },
      {
        title: "Consultant Support",
        href: "/admindashboard/support-tickets",
        icon: Headphones,
        isNew: true,
      }
    ]
  }
];

export function NavMain() {
  const pathname = usePathname();
  const { isMobile } = useSidebar();

  return (
    <>
      {navItems.map((nav) => (
        <SidebarGroup key={nav.title}>
          <SidebarGroupLabel>{nav.title}</SidebarGroupLabel>
          <SidebarGroupContent className="flex flex-col gap-2">
            <SidebarMenu>
              {nav.items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  {Array.isArray(item.items) && item.items.length > 0 ? (
                    <>
                      <div className="hidden group-data-[collapsible=icon]:block">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <SidebarMenuButton tooltip={item.title}>
                              {item.icon && <item.icon />}
                              <span>{item.title}</span>
                              <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                            </SidebarMenuButton>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            side={isMobile ? "bottom" : "right"}
                            align={isMobile ? "end" : "start"}
                            className="min-w-48 rounded-lg">
                            <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
                            {item.items?.map((sub) => (
                              <DropdownMenuItem
                                className="hover:text-foreground active:text-foreground hover:bg-[var(--primary)]/10! active:bg-[var(--primary)]/10!"
                                asChild
                                key={sub.title}>
                                <Link href={sub.href}>{sub.title}</Link>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <Collapsible
                        className="group/collapsible block group-data-[collapsible=icon]:hidden"
                        defaultOpen={!!item.items.find((s) => pathname.startsWith(s.href))}>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton
                            className="hover:text-foreground active:text-foreground hover:bg-[var(--primary)]/10 active:bg-[var(--primary)]/10"
                            tooltip={item.title}>
                            {item.icon && <item.icon />}
                            <span>{item.title}</span>
                            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {item?.items?.map((subItem, key) => (
                              <SidebarMenuSubItem key={key}>
                                <SidebarMenuSubButton
                                  className="hover:text-foreground active:text-foreground hover:bg-[var(--primary)]/10 active:bg-[var(--primary)]/10"
                                  isActive={pathname === subItem.href}
                                  asChild>
                                  <Link href={subItem.href} target={subItem.newTab ? "_blank" : ""}>
                                    <span>{subItem.title}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </Collapsible>
                    </>
                  ) : (
                    <SidebarMenuButton
                      className="hover:text-foreground active:text-foreground hover:bg-[var(--primary)]/10 active:bg-[var(--primary)]/10"
                      isActive={
                        item.href === "/admindashboard"
                          ? pathname === "/admindashboard"
                          : pathname === item.href || pathname.startsWith(`${item.href}/`)
                      }
                      tooltip={item.title}
                      asChild>
                      <Link href={item.href} target={item.newTab ? "_blank" : ""}>
                        {item.icon && <item.icon />}
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  )}
                  {!!item.isNew && (
                    <SidebarMenuBadge className="border border-green-400 text-green-600 peer-hover/menu-button:text-green-600">
                      New
                    </SidebarMenuBadge>
                  )}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}

"use client";

import Link from "next/link";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import {
  HomeIcon,
  ClipboardListIcon,
  ChevronRightIcon,
  FileTextIcon,
  FolderUpIcon,
  FormInputIcon,
  LockIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useIAQNav } from "@/context/questionnaire-nav-context";
import { useClientJourneyOptional } from "@/context/client-journey-context";
import { cn } from "@/lib/utils";

export const navItems = [
  {
    title: "Your Journey",
    items: [
      { title: "Home", href: "/user-dashboard", icon: HomeIcon },
      { title: "Questionnaire", href: "/user-dashboard/questionnaire", icon: ClipboardListIcon },
      { title: "Retainer agreement", href: "/user-dashboard/retainer-agreement", icon: FileTextIcon },
      { title: "Application forms", href: "/user-dashboard/application-forms", icon: FormInputIcon },
      { title: "Case documents", href: "/user-dashboard/case-management", icon: FolderUpIcon },
    ],
  },
];

export function NavMain() {
  const pathname = usePathname();
  const journey = useClientJourneyOptional();
  const { persons } = useIAQNav();
  const [iaqOpen, setIaqOpen] = useState(() =>
    pathname.startsWith("/user-dashboard/questionnaire"),
  );

  const isQuestActive = pathname.startsWith("/user-dashboard/questionnaire");
  const progress = journey?.progressPercent ?? 0;

  const locked = {
    retainer: journey ? !journey.canAccess("retainer") : false,
    forms: journey ? !journey.canAccess("forms") : false,
    documents: journey ? !journey.canAccess("documents") : false,
  };

  const current = journey?.currentStepId;

  return (
    <SidebarGroup>
      <SidebarGroupLabel className="flex items-center justify-between gap-2">
        <span>Your journey</span>
        {!journey?.loading && journey?.consultant && (
          <span className="text-[10px] font-normal text-muted-foreground tabular-nums">{progress}%</span>
        )}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {/* Home */}
          <SidebarMenuItem>
            <SidebarMenuButton
              className="hover:text-foreground active:text-foreground hover:bg-[var(--primary)]/10 active:bg-[var(--primary)]/10"
              isActive={pathname === "/user-dashboard"}
              tooltip="Home"
              asChild
            >
              <Link href="/user-dashboard">
                <HomeIcon />
                <span>Home</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* Questionnaire */}
          <SidebarMenuItem>
            <SidebarMenuButton
              className={cn(
                "hover:text-foreground active:text-foreground hover:bg-[var(--primary)]/10 active:bg-[var(--primary)]/10",
                iaqOpen && "text-foreground",
              )}
              isActive={isQuestActive}
              tooltip="Questionnaire"
              onClick={() => setIaqOpen((o) => !o)}
            >
              <ClipboardListIcon />
              <span className="flex-1 truncate">Questionnaire</span>
              {current === "questionnaire" && (
                <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
              )}
              <ChevronRightIcon
                className={cn(
                  "ml-auto h-4 w-4 shrink-0 transition-transform duration-200",
                  iaqOpen && "rotate-90",
                )}
              />
            </SidebarMenuButton>
            {iaqOpen && (
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton asChild isActive={pathname === "/user-dashboard/questionnaire"}>
                    <Link href="/user-dashboard/questionnaire">Overview</Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                {persons.map((person) => (
                  <SidebarMenuSubItem key={person.id}>
                    <SidebarMenuSubButton asChild>
                      <Link href={`/user-dashboard/questionnaire?tab=${person.tabIndex}`}>
                        {person.label}
                      </Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            )}
          </SidebarMenuItem>

          {/* Retainer */}
          <SidebarMenuItem>
            {locked.retainer ? (
              <SidebarMenuButton
                className="opacity-60 cursor-not-allowed"
                isActive={false}
                tooltip="Complete questionnaire and wait for pathway confirmation"
                onClick={(e) => e.preventDefault()}
              >
                <FileTextIcon />
                <span className="flex-1 truncate">Retainer agreement</span>
                <LockIcon className="h-3.5 w-3.5 shrink-0 opacity-60" />
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                className="hover:text-foreground active:text-foreground hover:bg-[var(--primary)]/10 active:bg-[var(--primary)]/10"
                isActive={pathname === "/user-dashboard/retainer-agreement"}
                tooltip="Retainer agreement"
                asChild
              >
                <Link href="/user-dashboard/retainer-agreement">
                  <FileTextIcon />
                  <span className="flex-1 truncate">Retainer agreement</span>
                  {current === "retainer" && (
                    <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                  )}
                </Link>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>

          {/* Application forms */}
          <SidebarMenuItem>
            {locked.forms ? (
              <SidebarMenuButton
                className="opacity-60 cursor-not-allowed"
                isActive={false}
                tooltip="Sign your retainer agreement first"
                onClick={(e) => e.preventDefault()}
              >
                <FormInputIcon />
                <span className="flex-1 truncate">Application forms</span>
                <LockIcon className="h-3.5 w-3.5 shrink-0 opacity-60" />
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                className="hover:text-foreground active:text-foreground hover:bg-[var(--primary)]/10 active:bg-[var(--primary)]/10"
                isActive={pathname === "/user-dashboard/application-forms"}
                tooltip="Application forms"
                asChild
              >
                <Link href="/user-dashboard/application-forms">
                  <FormInputIcon />
                  <span className="flex-1 truncate">Application forms</span>
                  {current === "forms" && (
                    <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                  )}
                </Link>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>

          {/* Case documents */}
          <SidebarMenuItem>
            {locked.documents ? (
              <SidebarMenuButton
                className="opacity-60 cursor-not-allowed"
                isActive={false}
                tooltip="Unlocks after forms are verified by your consultant"
                onClick={(e) => e.preventDefault()}
              >
                <FolderUpIcon />
                <span className="flex-1 truncate">Case documents</span>
                <LockIcon className="h-3.5 w-3.5 shrink-0 opacity-60" />
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton
                className="hover:text-foreground active:text-foreground hover:bg-[var(--primary)]/10 active:bg-[var(--primary)]/10"
                isActive={pathname === "/user-dashboard/case-management"}
                tooltip="Case documents"
                asChild
              >
                <Link href="/user-dashboard/case-management">
                  <FolderUpIcon />
                  <span className="flex-1 truncate">Case documents</span>
                  {current === "documents" && (
                    <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                  )}
                </Link>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

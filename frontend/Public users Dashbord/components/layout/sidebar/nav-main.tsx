"use client";

import * as React from "react";
import Link from "next/link";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  LayoutDashboardIcon,
  ClipboardListIcon,
  FileTextIcon,
  FolderUpIcon,
  BookOpenIcon,
  CheckCircle2Icon,
  LockIcon,
  MailIcon,
  UserCircle2Icon,
  CreditCardIcon,
  UserSearchIcon,
  MessageSquareIcon,
  RouteIcon,
  PhoneIcon,
  SearchIcon,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useClientJourneyOptional } from "@/context/client-journey-context";
import { useClientUnreadMessages } from "@/hooks/use-client-unread-messages";
import {
  journeyStepBadge,
  LEARNING_LOCKED_REASON,
  canAccessClientMessages,
  type JourneyStep,
  type JourneyStepId,
} from "@/lib/client-journey";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** Static list for header command search (Ctrl+K). */
export const navItems = [
  {
    title: "Your journey",
    items: [
      { title: "Overview", href: "/user-dashboard", icon: LayoutDashboardIcon },
      { title: "Your profile", href: "/user-dashboard/questionnaire", icon: ClipboardListIcon },
      { title: "Sign agreement", href: "/user-dashboard/retainer-agreement", icon: FileTextIcon },
      { title: "Documents & messages", href: "/user-dashboard/application-forms", icon: FolderUpIcon },
      { title: "Case review & next steps", href: "/user-dashboard/case-management", icon: SearchIcon },
      { title: "Learning courses", href: "/user-dashboard/learning", icon: BookOpenIcon },
      { title: "Find a consultant", href: "/user-dashboard/choose-consultant", icon: UserSearchIcon },
      { title: "My pathway", href: "/user-dashboard/my-pathway", icon: RouteIcon },
      { title: "Messages", href: "/user-dashboard/messages", icon: MessageSquareIcon },
      { title: "Account", href: "/user-dashboard/account", icon: UserCircle2Icon },
      { title: "Billing", href: "/user-dashboard/billing", icon: CreditCardIcon },
    ],
  },
];

const STEP_ICONS: Record<JourneyStepId, React.ComponentType<{ className?: string }>> = {
  questionnaire: ClipboardListIcon,
  retainer: FileTextIcon,
  forms: FolderUpIcon,
  documents: SearchIcon,
};

/** Light hover/active — avoids dark sidebar-accent hiding nested status colors. */
const JOURNEY_NAV_BUTTON =
  "group/step h-auto min-h-11 items-start gap-3 px-3 py-2.5 transition-colors " +
  "hover:!bg-primary/10 hover:!text-foreground active:!bg-primary/10 active:!text-foreground " +
  "data-[active=true]:!bg-primary/15 data-[active=true]:!text-foreground " +
  "hover:[&_svg]:!text-foreground data-[active=true]:[&_svg]:!text-foreground " +
  "hover:[&_.journey-step-label]:!text-foreground data-[active=true]:[&_.journey-step-label]:!text-foreground " +
  "hover:[&_.journey-step-badge]:!border-border hover:[&_.journey-step-badge]:!bg-background " +
  "data-[active=true]:[&_.journey-step-badge]:!border-border data-[active=true]:[&_.journey-step-badge]:!bg-background " +
  "hover:[&_.journey-step-badge]:!text-foreground data-[active=true]:[&_.journey-step-badge]:!text-foreground";

function JourneyStepNavItem({
  step,
  canAccess,
  isActive,
  badgeCount,
}: {
  step: JourneyStep;
  canAccess: boolean;
  isActive: boolean;
  badgeCount?: number;
}) {
  const Icon = STEP_ICONS[step.id];
  const badge = journeyStepBadge(step.status);
  const locked = !canAccess || step.status === "locked";

  const content = (
    <>
      <div
        className={cn(
          "journey-step-num flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold tabular-nums transition-colors",
          step.status === "done" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
          step.status === "active" && "border-primary/40 bg-primary/10 text-primary",
          step.status === "waiting" && "border-amber-400/50 bg-amber-500/10 text-amber-800",
          step.status === "locked" && "border-muted-foreground/15 bg-muted text-muted-foreground/50",
        )}
      >
        {step.status === "done" ? (
          <CheckCircle2Icon className="size-3.5 text-emerald-600" />
        ) : step.status === "locked" ? (
          <LockIcon className="size-3 text-muted-foreground/45" />
        ) : (
          <Icon className="size-3.5" />
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1 group-data-[collapsible=icon]:hidden">
        <span
          className={cn(
            "journey-step-label block text-sm font-medium leading-snug text-foreground transition-colors",
            locked && "text-muted-foreground/70",
          )}
        >
          {step.navLabel}
          {badgeCount != null && badgeCount > 0 && (
            <span className="ml-1.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-primary px-1.5 py-px text-[10px] font-bold text-primary-foreground">
              {badgeCount > 9 ? "9+" : badgeCount}
            </span>
          )}
        </span>
        <span
          className={cn(
            "journey-step-badge inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-tight transition-colors",
            badge.className,
          )}
        >
          {badge.label}
        </span>
        {locked && step.lockedReason && (
          <p className="line-clamp-2 text-[10px] leading-snug text-muted-foreground/70">
            {step.lockedReason}
          </p>
        )}
      </div>
    </>
  );

  if (locked) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          className="h-auto min-h-11 cursor-not-allowed items-start gap-3 px-3 py-2.5 opacity-80 hover:!bg-transparent active:!bg-transparent hover:!text-inherit"
          isActive={false}
          tooltip={`${step.navLabel} — ${step.lockedReason ?? "Not available yet"}`}
          onClick={(e) => e.preventDefault()}
        >
          {content}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        className={cn(
          JOURNEY_NAV_BUTTON,
          step.status === "active" && !isActive && "ring-1 ring-primary/15",
        )}
        isActive={isActive}
        tooltip={step.navLabel}
        asChild
      >
        <Link href={step.href}>{content}</Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function NavMain() {
  const pathname = usePathname();
  const journey = useClientJourneyOptional();

  const steps = journey?.steps ?? [];
  const consultant = journey?.consultant;
  const showJourneyNav = Boolean(consultant);
  const canAccess = journey?.canAccess ?? (() => false);
  const learningUnlocked = journey?.canAccessLearning ?? false;
  const messagesUnlocked = canAccessClientMessages(journey?.caseFile ?? null);
  const pathwayAssigned = Boolean(journey?.meta.pathwayAssigned);
  const { count: unreadMessages } = useClientUnreadMessages(messagesUnlocked);

  const isOverviewActive = pathname === "/user-dashboard";

  return (
    <SidebarGroup className="px-2">
      <SidebarGroupLabel className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider">
        {showJourneyNav ? "Your journey" : "Get started"}
      </SidebarGroupLabel>

      <SidebarGroupContent>
        <SidebarMenu className="gap-1.5">
          {/* Overview */}
          <SidebarMenuItem>
            <SidebarMenuButton
              className="h-10 gap-3 px-3 hover:!bg-primary/10 hover:!text-foreground active:!bg-primary/10 active:!text-foreground data-[active=true]:!bg-primary/15 data-[active=true]:!text-foreground hover:[&_svg]:!text-foreground data-[active=true]:[&_svg]:!text-foreground"
              isActive={isOverviewActive}
              tooltip="Overview"
              asChild
            >
              <Link href="/user-dashboard">
                <LayoutDashboardIcon className="size-4 shrink-0" />
                <span>Overview</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          {/* 4 journey steps — only after a consultant is linked */}
          {showJourneyNav && steps.map((step) => (
            <JourneyStepNavItem
              key={step.id}
              step={step}
              canAccess={canAccess(step.id)}
              isActive={pathname.startsWith(step.href)}
              badgeCount={step.id === "documents" ? unreadMessages : undefined}
            />
          ))}

          {showJourneyNav && messagesUnlocked && (
            <SidebarMenuItem>
              <SidebarMenuButton
                className="hover:!bg-primary/10 hover:!text-foreground active:!bg-primary/10 active:!text-foreground data-[active=true]:!bg-primary/15 data-[active=true]:!text-foreground hover:[&_svg]:!text-foreground data-[active=true]:[&_svg]:!text-foreground"
                isActive={pathname.startsWith("/user-dashboard/messages")}
                tooltip="Messages"
                asChild
              >
                <Link href="/user-dashboard/messages">
                  <MessageSquareIcon className="size-4 shrink-0" />
                  <span>
                    Messages
                    {unreadMessages > 0 && (
                      <span className="ml-1.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-primary px-1.5 py-px text-[10px] font-bold text-primary-foreground">
                        {unreadMessages > 9 ? "9+" : unreadMessages}
                      </span>
                    )}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}

          {showJourneyNav && pathwayAssigned && (
            <SidebarMenuItem>
              <SidebarMenuButton
                className="hover:!bg-primary/10 hover:!text-foreground active:!bg-primary/10 active:!text-foreground data-[active=true]:!bg-primary/15 data-[active=true]:!text-foreground hover:[&_svg]:!text-foreground data-[active=true]:[&_svg]:!text-foreground"
                isActive={pathname.startsWith("/user-dashboard/my-pathway")}
                tooltip="My pathway"
                asChild
              >
                <Link href="/user-dashboard/my-pathway">
                  <RouteIcon className="size-4 shrink-0" />
                  <span>My pathway</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}

          {!showJourneyNav && (
            <SidebarMenuItem>
              <SidebarMenuButton
                className="hover:!bg-primary/10 hover:!text-foreground active:!bg-primary/10 active:!text-foreground data-[active=true]:!bg-primary/15 data-[active=true]:!text-foreground hover:[&_svg]:!text-foreground data-[active=true]:[&_svg]:!text-foreground"
                isActive={pathname.startsWith("/user-dashboard/choose-consultant")}
                tooltip="Find a consultant"
                asChild
              >
                <Link href="/user-dashboard/choose-consultant">
                  <UserSearchIcon className="size-4 shrink-0" />
                  <span>Find a consultant</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}

          {showJourneyNav && (
            <SidebarMenuItem>
              {learningUnlocked ? (
                <SidebarMenuButton
                  className="hover:!bg-primary/10 hover:!text-foreground active:!bg-primary/10 active:!text-foreground data-[active=true]:!bg-primary/15 data-[active=true]:!text-foreground hover:[&_svg]:!text-foreground data-[active=true]:[&_svg]:!text-foreground"
                  isActive={pathname.startsWith("/user-dashboard/learning")}
                  tooltip="Learning courses"
                  asChild
                >
                  <Link href="/user-dashboard/learning">
                    <BookOpenIcon className="size-4 shrink-0" />
                    <span>Learning courses</span>
                  </Link>
                </SidebarMenuButton>
              ) : (
                <SidebarMenuButton
                  className="h-auto min-h-10 cursor-not-allowed items-start py-2 opacity-80 hover:!bg-transparent active:!bg-transparent hover:!text-inherit"
                  isActive={false}
                  tooltip={`Learning courses — ${LEARNING_LOCKED_REASON}`}
                  onClick={(e) => e.preventDefault()}
                >
                  <BookOpenIcon className="size-4 shrink-0 text-muted-foreground opacity-40" />
                  <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                    <span className="block truncate text-sm font-medium text-muted-foreground/70">
                      Learning courses
                    </span>
                    <span className="mt-0.5 inline-flex rounded-md border border-muted-foreground/20 bg-muted px-1.5 py-px text-[10px] font-semibold leading-tight text-muted-foreground">
                      Locked
                    </span>
                    <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-muted-foreground/70">
                      {LEARNING_LOCKED_REASON}
                    </p>
                  </div>
                </SidebarMenuButton>
              )}
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarGroupContent>

      {/* Consultant quick contact */}
      {consultant && !journey?.loading && (
        <div className="mt-4 space-y-3.5 rounded-xl border border-sidebar-border/60 bg-background p-4 shadow-sm group-data-[collapsible=icon]:hidden">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Your consultant
          </p>

          <div className="flex items-center gap-3">
            {consultant.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={consultant.avatar}
                alt={consultant.name}
                className="size-11 shrink-0 rounded-full object-cover ring-2 ring-primary/15"
              />
            ) : (
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary ring-2 ring-primary/15">
                {consultant.name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("")}
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="truncate text-sm font-semibold leading-snug text-foreground capitalize">
                {consultant.name}
              </p>
              {consultant.rcic_number && (
                <p className="truncate text-[11px] leading-snug text-muted-foreground">
                  RCIC — {consultant.rcic_number}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2 border-t border-sidebar-border/50 pt-3">
            <a
              href={`mailto:${consultant.email}`}
              className="grid grid-cols-[1rem_1fr] items-start gap-x-2.5 gap-y-0 text-[11px] leading-snug text-muted-foreground hover:text-foreground"
            >
              <MailIcon className="mt-0.5 size-3.5 shrink-0" />
              <span className="break-all">{consultant.email}</span>
            </a>
            {consultant.phone && (
              <a
                href={`tel:${consultant.phone}`}
                className="grid grid-cols-[1rem_1fr] items-center gap-x-2.5 text-[11px] leading-snug text-muted-foreground hover:text-foreground"
              >
                <PhoneIcon className="size-3.5 shrink-0" />
                <span className="truncate">{consultant.phone}</span>
              </a>
            )}
          </div>

          <Button
            size="sm"
            variant="outline"
            className="h-9 w-full gap-2 rounded-lg border-primary/30 text-xs font-semibold text-primary hover:bg-primary/5 hover:text-primary"
            asChild
          >
            <Link href="/user-dashboard/messages">
              <MessageSquareIcon className="size-3.5 shrink-0" />
              Send message
            </Link>
          </Button>
        </div>
      )}
    </SidebarGroup>
  );
}

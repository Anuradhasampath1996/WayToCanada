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
  FormInputIcon,
  CheckCircle2Icon,
  LockIcon,
  MailIcon,
  Loader2,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useClientJourneyOptional } from "@/context/client-journey-context";
import {
  journeyCurrentStepNumber,
  journeyStepBadge,
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
      { title: "Government forms", href: "/user-dashboard/application-forms", icon: FormInputIcon },
      { title: "Documents & messages", href: "/user-dashboard/case-management", icon: FolderUpIcon },
      { title: "Learning courses", href: "/user-dashboard/learning", icon: BookOpenIcon },
    ],
  },
];

const STEP_ICONS: Record<JourneyStepId, React.ComponentType<{ className?: string }>> = {
  questionnaire: ClipboardListIcon,
  retainer: FileTextIcon,
  forms: FormInputIcon,
  documents: FolderUpIcon,
};

/** Light hover/active — avoids dark sidebar-accent hiding nested status colors. */
const JOURNEY_NAV_BUTTON =
  "group/step h-auto min-h-10 items-start py-2 transition-colors " +
  "hover:!bg-primary/10 hover:!text-foreground active:!bg-primary/10 active:!text-foreground " +
  "data-[active=true]:!bg-primary/15 data-[active=true]:!text-foreground " +
  "hover:[&_svg]:!text-foreground data-[active=true]:[&_svg]:!text-foreground " +
  "hover:[&_.journey-step-label]:!text-foreground data-[active=true]:[&_.journey-step-label]:!text-foreground " +
  "hover:[&_.journey-step-badge]:!border-border hover:[&_.journey-step-badge]:!bg-background " +
  "data-[active=true]:[&_.journey-step-badge]:!border-border data-[active=true]:[&_.journey-step-badge]:!bg-background " +
  "hover:[&_.journey-step-badge]:!text-foreground data-[active=true]:[&_.journey-step-badge]:!text-foreground " +
  "hover:[&_.journey-step-num]:!border-border/60 hover:[&_.journey-step-num]:!bg-background hover:[&_.journey-step-num]:!text-foreground " +
  "data-[active=true]:[&_.journey-step-num]:!border-border/60 data-[active=true]:[&_.journey-step-num]:!bg-background data-[active=true]:[&_.journey-step-num]:!text-foreground " +
  "hover:[&_.journey-step-num_svg]:!text-foreground data-[active=true]:[&_.journey-step-num_svg]:!text-foreground";

function JourneyStepNavItem({
  step,
  canAccess,
  isActive,
}: {
  step: JourneyStep;
  canAccess: boolean;
  isActive: boolean;
}) {
  const Icon = STEP_ICONS[step.id];
  const badge = journeyStepBadge(step.status);
  const locked = !canAccess || step.status === "locked";

  const content = (
    <>
      <Icon
        className={cn(
          "size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:block",
          locked && "opacity-40",
        )}
      />
      <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
        <div className="flex items-start gap-2">
          <div
            className={cn(
              "journey-step-num flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold tabular-nums transition-colors",
              step.status === "done" && "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
              step.status === "active" && "border-primary/40 bg-primary/10 text-primary",
              step.status === "waiting" && "border-amber-400/50 bg-amber-500/10 text-amber-800",
              step.status === "locked" && "border-muted-foreground/15 bg-muted text-muted-foreground/50",
            )}
          >
            {step.status === "done" ? (
              <CheckCircle2Icon className="size-3 text-emerald-600" />
            ) : step.status === "locked" ? (
              <LockIcon className="size-2.5 text-muted-foreground/45" />
            ) : (
              step.number
            )}
          </div>
          <div className="min-w-0 flex-1">
            <span
              className={cn(
                "journey-step-label block truncate text-sm font-medium text-foreground transition-colors",
                locked && "text-muted-foreground/70",
              )}
            >
              {step.navLabel}
            </span>
            <span
              className={cn(
                "journey-step-badge mt-0.5 inline-flex rounded-md border px-1.5 py-px text-[10px] font-semibold leading-tight transition-colors",
                badge.className,
              )}
            >
              {badge.label}
            </span>
            {locked && step.lockedReason && (
              <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-muted-foreground/70">
                {step.lockedReason}
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );

  if (locked) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          className="h-auto min-h-10 cursor-not-allowed items-start py-2 opacity-80 hover:!bg-transparent active:!bg-transparent hover:!text-inherit"
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
  const progress = journey?.progressPercent ?? 0;
  const currentStepId = journey?.currentStepId ?? "questionnaire";
  const currentStepNum = journeyCurrentStepNumber(steps, currentStepId);
  const nextAction = journey?.nextAction;
  const consultant = journey?.consultant;
  const canAccess = journey?.canAccess ?? (() => false);

  const isOverviewActive = pathname === "/user-dashboard";

  return (
    <SidebarGroup className="px-1">
      {/* Zone 1 — status card */}
      <div className="mb-3 space-y-2.5 rounded-xl border border-sidebar-border/60 bg-background/80 p-3 shadow-sm group-data-[collapsible=icon]:hidden">
        {journey?.loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Your status
              </p>
              <p className="text-sm font-semibold leading-snug text-foreground">
                {nextAction?.title ?? "Getting started"}
              </p>
              <p className="text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                {nextAction?.description}
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-medium text-muted-foreground">
                <span>Step {currentStepNum} of 4</span>
                <span className="tabular-nums">{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
            {nextAction?.href && nextAction.buttonLabel && (
              <Button size="sm" className="h-8 w-full rounded-lg text-xs" asChild>
                <Link href={nextAction.href}>{nextAction.buttonLabel}</Link>
              </Button>
            )}
          </>
        )}
      </div>

      <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-wider">
        Your journey
      </SidebarGroupLabel>

      <SidebarGroupContent>
        <SidebarMenu>
          {/* Overview */}
          <SidebarMenuItem>
            <SidebarMenuButton
              className="hover:!bg-primary/10 hover:!text-foreground active:!bg-primary/10 active:!text-foreground data-[active=true]:!bg-primary/15 data-[active=true]:!text-foreground hover:[&_svg]:!text-foreground data-[active=true]:[&_svg]:!text-foreground"
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

          {/* 4 journey steps */}
          {steps.map((step) => (
            <JourneyStepNavItem
              key={step.id}
              step={step}
              canAccess={canAccess(step.id)}
              isActive={pathname.startsWith(step.href)}
            />
          ))}

          <SidebarMenuItem>
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
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>

      {/* Consultant quick contact */}
      {consultant && !journey?.loading && (
        <div className="mt-3 rounded-lg border border-sidebar-border/50 bg-muted/30 px-3 py-2.5 group-data-[collapsible=icon]:hidden">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Your consultant
          </p>
          <p className="mt-0.5 truncate text-xs font-medium text-foreground">{consultant.name}</p>
          <a
            href={`mailto:${consultant.email}`}
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
          >
            <MailIcon className="size-3 shrink-0" />
            Send email
          </a>
        </div>
      )}
    </SidebarGroup>
  );
}

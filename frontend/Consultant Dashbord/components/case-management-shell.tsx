"use client";

import * as React from "react";
import {
  Briefcase,
  FileCheck,
  FileText,
  FormInput,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type CaseHubTab = "overview" | "documents" | "forms" | "government-forms" | "messages";

const JOURNEY_PHASES = [
  { id: "documents", label: "Documents", step: 1 },
  { id: "forms", label: "Application Forms", step: 2 },
  { id: "government-forms", label: "Government Forms", step: 3 },
  { id: "messages", label: "Client Comms", step: 4 },
] as const;

export function CaseHubJourneyStrip({
  activeTab,
  onTabChange,
  documentsComplete,
  formsComplete,
  govFormsPercent,
  hasInteractiveForms = true,
}: {
  activeTab: CaseHubTab;
  onTabChange: (tab: CaseHubTab) => void;
  documentsComplete: boolean;
  formsComplete: boolean;
  govFormsPercent: number | null;
  hasInteractiveForms?: boolean;
}) {
  const phaseStatus = (id: string) => {
    if (id === "documents") return documentsComplete ? "complete" : "active";
    if (id === "forms") {
      if (!hasInteractiveForms) return "complete";
      return formsComplete ? "complete" : documentsComplete ? "active" : "pending";
    }
    if (id === "government-forms") {
      if (govFormsPercent === 100) return "complete";
      if (formsComplete) return "active";
      return "pending";
    }
    return "pending";
  };

  return (
    <div className="mb-6 rounded-2xl border bg-gradient-to-r from-slate-50 via-white to-violet-50/40 p-4 dark:from-slate-900/50 dark:via-card dark:to-violet-950/20">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground mb-3">
        Case submission journey
      </p>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {JOURNEY_PHASES.map((phase, index) => {
          const status = phaseStatus(phase.id);
          const isActive = activeTab === phase.id || (activeTab === "overview" && index === 0);
          return (
            <React.Fragment key={phase.id}>
              <button
                type="button"
                onClick={() => onTabChange(phase.id as CaseHubTab)}
                className={cn(
                  "group flex flex-1 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all",
                  isActive && "border-primary/40 bg-primary/5 shadow-sm",
                  status === "complete" && !isActive && "border-green-200/80 bg-green-50/30",
                  status === "pending" && !isActive && "opacity-70 hover:opacity-100",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    status === "complete" && "bg-green-600 text-white",
                    status === "active" && "bg-primary text-primary-foreground",
                    status === "pending" && "bg-muted text-muted-foreground",
                  )}
                >
                  {phase.step}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-tight">{phase.label}</span>
                  <span className="block text-[10px] text-muted-foreground mt-0.5">
                    {phase.id === "government-forms" && govFormsPercent !== null
                      ? `${govFormsPercent}% auto-fill ready`
                      : phase.id === "forms" && !hasInteractiveForms
                        ? "PDF package — skip to Gov Forms"
                        : status === "complete"
                          ? "Complete"
                          : status === "active"
                            ? "In progress"
                            : "Up next"}
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
              </button>
              {index < JOURNEY_PHASES.length - 1 && (
                <div className="hidden sm:block h-px w-4 bg-border shrink-0" aria-hidden />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

export function CaseHubNav({
  activeTab,
  onTabChange,
  badges,
}: {
  activeTab: CaseHubTab;
  onTabChange: (tab: CaseHubTab) => void;
  badges?: Partial<Record<CaseHubTab, number>>;
}) {
  const items: {
    id: CaseHubTab;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    accent?: boolean;
  }[] = [
    { id: "overview", label: "Overview", description: "Summary & next steps", icon: Briefcase },
    { id: "documents", label: "Documents", description: "Uploads & review", icon: FileText },
    { id: "forms", label: "Application Forms", description: "Interactive IRCC forms", icon: FormInput },
    { id: "government-forms", label: "Government Forms", description: "IMM 5476 · IMM 5406 auto-fill", icon: FileCheck, accent: true },
    { id: "messages", label: "Messages", description: "Client communication", icon: MessageSquare },
  ];

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden lg:block w-56 shrink-0 space-y-1" aria-label="Case hub sections">
        {items.map((item) => {
          const Icon = item.icon;
          const badge = badges?.[item.id];
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={cn(
                "w-full rounded-xl border px-3 py-3 text-left transition-all",
                active
                  ? "border-primary/40 bg-primary/5 shadow-sm"
                  : "border-transparent hover:border-border hover:bg-muted/40",
                item.accent && !active && "border-violet-200/60 bg-violet-50/30 dark:bg-violet-950/20",
              )}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                <span className="text-sm font-semibold flex-1">{item.label}</span>
                {badge !== undefined && badge > 0 && (
                  <Badge className="h-5 min-w-5 px-1.5 text-[10px]">{badge}</Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 pl-6">{item.description}</p>
            </button>
          );
        })}
      </nav>

      {/* Mobile horizontal pills */}
      <div className="lg:hidden flex gap-2 overflow-x-auto pb-1 mb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const Icon = item.icon;
          const badge = badges?.[item.id];
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={cn(
                "shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition-colors",
                active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted/50",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
              {badge !== undefined && badge > 0 && (
                <span className="ml-0.5 rounded-full bg-white/20 px-1.5 text-[10px]">{badge}</span>
              )}
            </button>
          );
        })}
      </div>
    </>
  );
}

export function CaseHubTabHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5 pb-4 border-b">
      <h2 className="text-lg font-bold">{title}</h2>
      {description && (
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{description}</p>
      )}
    </div>
  );
}

export type CaseHubJourneyProps = Omit<
  React.ComponentProps<typeof CaseHubJourneyStrip>,
  "activeTab" | "onTabChange"
>;

export function CaseHubLayout({
  activeTab,
  onTabChange,
  journeyProps,
  badges,
  children,
}: {
  activeTab: CaseHubTab;
  onTabChange: (tab: CaseHubTab) => void;
  journeyProps: CaseHubJourneyProps;
  badges?: Partial<Record<CaseHubTab, number>>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-0">
      <CaseHubJourneyStrip
        activeTab={activeTab}
        onTabChange={onTabChange}
        {...journeyProps}
      />
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">
        <CaseHubNav activeTab={activeTab} onTabChange={onTabChange} badges={badges} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

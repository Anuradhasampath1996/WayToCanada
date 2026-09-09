"use client";

import { useState } from "react";
import { Video, DollarSign, ChevronRight } from "lucide-react";
import { MAPLE_ASSISTANT } from "@/lib/workspace-ai-character";
import { MapleAvatar } from "@/components/workspace/maple-avatar";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ClientMeetingsPanel } from "./client-meetings-panel";
import { ClientPaymentRequestsPanel } from "./client-payment-requests-panel";
import { WorkspaceAiAdvisorPanel } from "./workspace-ai-advisor-panel";

type QuickTool = "meetings" | "payments" | "ai-advisor";

const TOOLS: Array<{
  id: QuickTool;
  label: string;
  shortLabel: string;
  icon?: typeof Video;
  maple?: boolean;
}> = [
  { id: "meetings", label: "Video meetings", shortLabel: "Meet", icon: Video },
  { id: "payments", label: "Payment requests", shortLabel: "Pay", icon: DollarSign },
  {
    id: "ai-advisor",
    label: `${MAPLE_ASSISTANT.name} — ${MAPLE_ASSISTANT.role}`,
    shortLabel: MAPLE_ASSISTANT.name,
    maple: true,
  },
];

function ToolSheet({
  activeTool,
  clientId,
  onClose,
}: {
  activeTool: QuickTool | null;
  clientId: number;
  onClose: () => void;
}) {
  return (
    <Sheet open={activeTool !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <SheetHeader
          className={cn(
            "shrink-0 border-b px-4 py-3.5 pr-12 text-left sm:px-5",
            activeTool === "ai-advisor" && "border-red-100 bg-gradient-to-r from-red-50/90 to-white",
          )}
        >
          <SheetTitle className="flex items-center gap-2.5 text-base">
            {activeTool === "meetings" && (
              <>
                <span className="flex size-7 items-center justify-center rounded-full bg-primary/10">
                  <Video className="size-3.5 text-primary" />
                </span>
                Video meetings
              </>
            )}
            {activeTool === "payments" && (
              <>
                <span className="flex size-7 items-center justify-center rounded-full bg-primary/10">
                  <DollarSign className="size-3.5 text-primary" />
                </span>
                Payment requests
              </>
            )}
            {activeTool === "ai-advisor" && (
              <>
                <MapleAvatar size="sm" variant="soft" className="h-9 w-9 ring-1 ring-red-100" />
                <span className="leading-tight">
                  Maple
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    Case co-pilot
                  </span>
                </span>
              </>
            )}
          </SheetTitle>
          {activeTool !== "ai-advisor" && (
            <SheetDescription className="text-left text-xs">
              {activeTool === "meetings"
                ? "Schedule Google Meet, Zoom, or Teams with your client."
                : "Send secure payment links at any stage of the case."}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4">
          {activeTool === "meetings" && <ClientMeetingsPanel clientId={clientId} embedded />}
          {activeTool === "payments" && <ClientPaymentRequestsPanel clientId={clientId} embedded />}
          {activeTool === "ai-advisor" && <WorkspaceAiAdvisorPanel clientId={clientId} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RailIconPlate({
  children,
  active,
  maple,
}: {
  children: React.ReactNode;
  active?: boolean;
  maple?: boolean;
}) {
  return (
    <span
      className={cn(
        "relative flex size-8 items-center justify-center rounded-full transition-transform duration-200",
        maple
          ? "bg-white shadow-md shadow-black/15"
          : "bg-white text-[var(--primary)] shadow-sm shadow-black/10",
        active && !maple && "scale-105 ring-2 ring-white/70",
        active && maple && "scale-105",
      )}
    >
      {children}
    </span>
  );
}

function QuickToolButton({
  tool,
  isActive,
  onClick,
  variant,
}: {
  tool: (typeof TOOLS)[number];
  isActive: boolean;
  onClick: () => void;
  variant: "rail" | "dock";
}) {
  const Icon = tool.icon;

  if (variant === "dock") {
    return (
      <button
        type="button"
        onClick={onClick}
        title={tool.label}
        className={cn(
          "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2.5 transition-colors",
          isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/60",
        )}
      >
        {tool.maple ? (
          <MapleAvatar
            size="sm"
            variant="soft"
            highlight
            className="h-7 w-7 shadow-sm ring-1 ring-primary/20"
          />
        ) : Icon ? (
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-full",
              isActive ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" strokeWidth={2.25} />
          </span>
        ) : null}
        <span className="max-w-full truncate text-[10px] font-semibold uppercase tracking-wide">
          {tool.shortLabel}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={tool.label}
      className={cn(
        "group relative flex w-[3.35rem] flex-col items-center gap-1 py-2.5 transition-colors",
        "text-primary-foreground hover:bg-white/10",
        isActive && "bg-white/15",
      )}
    >
      {tool.maple ? (
        <MapleAvatar
          size="sm"
          variant="rail"
          highlight
          className="h-8 w-8 ring-2 ring-white/90"
        />
      ) : Icon ? (
        <RailIconPlate active={isActive}>
          <Icon className="size-4 shrink-0" strokeWidth={2.35} />
        </RailIconPlate>
      ) : null}
      <span className="text-[9px] font-bold uppercase tracking-[0.08em] opacity-95">
        {tool.shortLabel}
      </span>
      {isActive && (
        <span className="absolute left-0 top-2.5 bottom-2.5 w-0.5 rounded-r-full bg-white" />
      )}
    </button>
  );
}

export function WorkspaceQuickToolsRail({ clientId }: { clientId: number }) {
  const [activeTool, setActiveTool] = useState<QuickTool | null>(null);
  const [railOpen, setRailOpen] = useState(true);

  function openTool(tool: QuickTool) {
    setActiveTool((prev) => (prev === tool ? null : tool));
  }

  return (
    <>
      {/* Desktop — floating pill rail */}
      <div
        className={cn(
          "fixed z-40 hidden flex-col items-center transition-all duration-300 ease-out sm:flex",
          "right-0 top-1/2 -translate-y-1/2",
          railOpen ? "translate-x-0" : "translate-x-[calc(100%-12px)]",
        )}
        aria-label="Workspace quick tools"
      >
        <div
          className={cn(
            "relative flex flex-col items-center overflow-hidden rounded-l-[1.65rem] py-2 shadow-2xl shadow-red-950/25",
            "border border-r-0 border-white/15",
            "bg-gradient-to-b from-[var(--primary-500,var(--primary))] via-[var(--primary)] to-[var(--primary-700,var(--primary))]",
          )}
        >
          <button
            type="button"
            onClick={() => setRailOpen((v) => !v)}
            className={cn(
              "mb-1 flex size-8 items-center justify-center rounded-full",
              "bg-black/20 text-white shadow-inner transition-colors hover:bg-black/30",
            )}
            title={railOpen ? "Collapse tools" : "Expand tools"}
            aria-expanded={railOpen}
          >
            <ChevronRight
              className={cn("size-4 transition-transform duration-300", !railOpen && "rotate-180")}
            />
          </button>

          {railOpen && (
            <>
              <div className="mb-1 h-px w-8 bg-white/25" />
              {TOOLS.map((tool) => (
                <QuickToolButton
                  key={tool.id}
                  tool={tool}
                  isActive={activeTool === tool.id}
                  onClick={() => openTool(tool.id)}
                  variant="rail"
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Mobile — bottom dock */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border/80 bg-background/95 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] backdrop-blur-md sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        aria-label="Workspace quick tools"
      >
        {TOOLS.map((tool) => (
          <QuickToolButton
            key={tool.id}
            tool={tool}
            isActive={activeTool === tool.id}
            onClick={() => openTool(tool.id)}
            variant="dock"
          />
        ))}
      </div>

      <ToolSheet activeTool={activeTool} clientId={clientId} onClose={() => setActiveTool(null)} />
    </>
  );
}

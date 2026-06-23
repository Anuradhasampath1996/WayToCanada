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
        <SheetHeader className="shrink-0 border-b px-4 py-4 pr-12 text-left sm:px-5">
          <SheetTitle className="flex items-center gap-2 text-base">
            {activeTool === "meetings" && (
              <>
                <Video className="size-4 text-primary" />
                Video meetings
              </>
            )}
            {activeTool === "payments" && (
              <>
                <DollarSign className="size-4 text-primary" />
                Payment requests
              </>
            )}
            {activeTool === "ai-advisor" && (
              <>
                <MapleAvatar size="sm" className="h-7 w-7 rounded-lg text-sm shadow-none ring-0" />
                <span>
                  {MAPLE_ASSISTANT.name}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    · always here for you
                  </span>
                </span>
              </>
            )}
          </SheetTitle>
          <SheetDescription className="text-left text-xs">
            {activeTool === "meetings"
              ? "Schedule Google Meet, Zoom, or Teams with your client."
              : activeTool === "payments"
                ? "Send secure payment links at any stage of the case."
                : `${MAPLE_ASSISTANT.name} is your friendly co-pilot in this workspace — click when you need case or pathway help.`}
          </SheetDescription>
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
          "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 transition-colors",
          isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/60",
        )}
      >
        {tool.maple ? (
          <span className="text-lg leading-none" aria-hidden>
            {MAPLE_ASSISTANT.emoji}
          </span>
        ) : Icon ? (
          <Icon className="size-5 shrink-0" strokeWidth={2} />
        ) : null}
        <span className="max-w-full truncate text-[10px] font-semibold">{tool.shortLabel}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={tool.label}
      className={cn(
        "group relative flex w-12 flex-col items-center gap-0.5 py-3 transition-colors",
        "text-primary-foreground hover:bg-primary-foreground/15",
        isActive && "bg-primary-foreground/20",
      )}
    >
      {tool.maple ? (
        <span className="text-base leading-none" aria-hidden>
          {MAPLE_ASSISTANT.emoji}
        </span>
      ) : Icon ? (
        <Icon className="size-5 shrink-0" strokeWidth={2} />
      ) : null}
      <span className="text-[9px] font-semibold uppercase tracking-wide opacity-90">
        {tool.shortLabel}
      </span>
      {isActive && (
        <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-primary-foreground" />
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
      {/* Desktop — floating right rail */}
      <div
        className={cn(
          "fixed z-40 hidden flex-col items-center transition-all duration-300 ease-out sm:flex",
          "right-0 top-1/2 -translate-y-1/2",
          railOpen ? "translate-x-0" : "translate-x-[calc(100%-10px)]",
        )}
        aria-label="Workspace quick tools"
      >
        <div
          className={cn(
            "flex flex-col items-stretch overflow-hidden rounded-l-2xl shadow-xl",
            "border border-r-0 border-primary/30",
            "bg-gradient-to-b from-[var(--primary-500,var(--primary))] to-[var(--primary-700,var(--primary))]",
          )}
        >
          <button
            type="button"
            onClick={() => setRailOpen((v) => !v)}
            className="flex h-8 w-12 items-center justify-center text-primary-foreground/90 transition-colors hover:bg-primary-foreground/10"
            title={railOpen ? "Collapse tools" : "Expand tools"}
            aria-expanded={railOpen}
          >
            <span className="text-primary-foreground">
              {railOpen ? <ChevronRight className="size-4" /> : <ChevronRight className="size-4 rotate-180" />}
            </span>
          </button>

          {railOpen && (
            <>
              <div className="mx-2 border-t border-primary-foreground/20" />
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

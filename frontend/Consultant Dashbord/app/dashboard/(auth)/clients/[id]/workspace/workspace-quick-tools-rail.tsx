"use client";

import { useState } from "react";
import { Video, DollarSign, ChevronRight } from "lucide-react";
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

type QuickTool = "meetings" | "payments";

const TOOLS: Array<{
  id: QuickTool;
  label: string;
  shortLabel: string;
  icon: typeof Video;
}> = [
  { id: "meetings", label: "Video meetings", shortLabel: "Meet", icon: Video },
  { id: "payments", label: "Payment requests", shortLabel: "Pay", icon: DollarSign },
];

export function WorkspaceQuickToolsRail({ clientId }: { clientId: number }) {
  const [activeTool, setActiveTool] = useState<QuickTool | null>(null);
  const [railOpen, setRailOpen] = useState(true);

  function openTool(tool: QuickTool) {
    setActiveTool((prev) => (prev === tool ? null : tool));
  }

  return (
    <>
      {/* Floating vertical rail — right edge */}
      <div
        className={cn(
          "fixed z-40 flex flex-col items-center transition-all duration-300 ease-out",
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
            {railOpen ? (
              <ChevronRight className="size-4" />
            ) : (
              <ChevronRight className="size-4 rotate-180" />
            )}
          </button>

          {railOpen && (
            <>
              <div className="mx-2 border-t border-primary-foreground/20" />
              {TOOLS.map((tool) => {
                const Icon = tool.icon;
                const isActive = activeTool === tool.id;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => openTool(tool.id)}
                    title={tool.label}
                    className={cn(
                      "group relative flex w-12 flex-col items-center gap-0.5 py-3 transition-colors",
                      "text-primary-foreground hover:bg-primary-foreground/15",
                      isActive && "bg-primary-foreground/20",
                    )}
                  >
                    <Icon className="size-5 shrink-0" strokeWidth={2} />
                    <span className="text-[9px] font-semibold uppercase tracking-wide opacity-90">
                      {tool.shortLabel}
                    </span>
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-primary-foreground" />
                    )}
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>

      <Sheet open={activeTool !== null} onOpenChange={(open) => !open && setActiveTool(null)}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
        >
          <SheetHeader className="shrink-0 border-b px-5 py-4 pr-12 text-left">
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
            </SheetTitle>
            <SheetDescription className="text-left text-xs">
              {activeTool === "meetings"
                ? "Schedule Google Meet, Zoom, or Teams with your client."
                : "Send secure payment links at any stage of the case."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {activeTool === "meetings" && (
              <ClientMeetingsPanel clientId={clientId} embedded />
            )}
            {activeTool === "payments" && (
              <ClientPaymentRequestsPanel clientId={clientId} embedded />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

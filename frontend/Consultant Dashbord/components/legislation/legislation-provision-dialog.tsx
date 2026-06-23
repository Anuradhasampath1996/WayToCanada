"use client";

import * as React from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BookOpen, FileText, Loader2, Sparkles, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ResolvedProvision } from "@/components/legislation/legislation-provision-types";

import "./legislation-viewer.css";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("wtc_consultant_token") ??
        document.cookie.match(/wtc_consultant_token=([^;]+)/)?.[1] ??
        ""
      : "";
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function LegislationProvisionDialog({
  open,
  loading,
  popup,
  error,
  onClose,
  showOpenInHub = true,
}: {
  open: boolean;
  loading: boolean;
  popup: ResolvedProvision | null;
  error: string | null;
  onClose: () => void;
  showOpenInHub?: boolean;
}) {
  const [tab, setTab] = React.useState<"legal" | "maple">("legal");
  const [bookmarkSaved, setBookmarkSaved] = React.useState(false);

  React.useEffect(() => {
    if (open) setTab("legal");
  }, [open, popup?.provision_key]);

  React.useEffect(() => {
    setBookmarkSaved(false);
  }, [popup?.act_code, popup?.provision_key]);

  const hasMapleSummary = Boolean(popup?.maple_summary?.summary);
  const summaryAvailable = Boolean(popup?.summary_available ?? hasMapleSummary);

  async function saveBookmark() {
    if (!popup) return;
    try {
      const res = await fetch(`${API}/consultant/legislation/bookmarks`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          act_code: popup.act_code,
          provision_key: popup.provision_key,
          language: popup.language,
          label: popup.citation,
        }),
      });
      if (res.ok) setBookmarkSaved(true);
    } catch {
      // ignore
    }
  }

  const hubPath =
    popup?.document?.id != null
      ? `/dashboard/legislations/${popup.document.id}?provision=${encodeURIComponent(popup.provision_key)}`
      : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="flex max-h-[min(88vh,900px)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-3 overflow-hidden p-4 sm:max-w-2xl sm:p-6">
        {loading && !popup && (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
            Loading section…
          </div>
        )}

        {popup && !loading && (
          <>
            <DialogHeader className="shrink-0 space-y-1 pr-8">
              <DialogTitle className="text-sm leading-snug break-words sm:text-base">{popup.citation}</DialogTitle>
              <DialogDescription asChild>
                <p className="pt-1 text-xs break-words">From: {popup.document.title}</p>
              </DialogDescription>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain">
            {(hasMapleSummary || summaryAvailable) && (
              <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
                <button
                  type="button"
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors",
                    tab === "legal" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setTab("legal")}
                >
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  Legal text
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors",
                    tab === "maple" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                    !hasMapleSummary && "opacity-60",
                  )}
                  onClick={() => setTab("maple")}
                  disabled={!hasMapleSummary}
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                  Maple explains
                </button>
              </div>
            )}

            {tab === "maple" && hasMapleSummary ? (
              <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm leading-relaxed sm:p-4">
                <p>{popup.maple_summary!.summary}</p>
                {popup.maple_summary!.key_points.length > 0 && (
                  <ul className="list-disc space-y-1 pl-5 text-[13px] text-muted-foreground">
                    {popup.maple_summary!.key_points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div
                className="leg-popup-content max-w-full overflow-x-auto"
                dangerouslySetInnerHTML={{
                  __html: popup.popup_html || popup.html_fragment || popup.text_content,
                }}
              />
            )}
            </div>

            <div className="flex shrink-0 flex-col-reverse gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-9 w-full justify-center sm:w-auto"
                onClick={() => void saveBookmark()}
                disabled={bookmarkSaved}
              >
                <Star className={cn("mr-1 h-3 w-3", bookmarkSaved && "fill-amber-400 text-amber-500")} />
                {bookmarkSaved ? "Saved" : "Save section"}
              </Button>
              {showOpenInHub && hubPath && (
                <Button type="button" variant="outline" size="sm" className="h-9 w-full justify-center sm:w-auto" asChild>
                  <Link href={hubPath} onClick={onClose}>
                    <BookOpen className="mr-1 h-3 w-3" />
                    Open in Legislation Hub
                  </Link>
                </Button>
              )}
            </div>
          </>
        )}

        {error && !loading && (
          <>
            <DialogHeader>
              <DialogTitle className="text-base">Section not available</DialogTitle>
              <DialogDescription className="break-words">{error}</DialogDescription>
            </DialogHeader>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

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
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {loading && !popup && (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading section…
          </div>
        )}

        {popup && !loading && (
          <>
            <DialogHeader>
              <DialogTitle className="text-base pr-6 leading-snug">{popup.citation}</DialogTitle>
              <DialogDescription asChild>
                <p className="text-xs pt-1">From: {popup.document.title}</p>
              </DialogDescription>
            </DialogHeader>

            {(hasMapleSummary || summaryAvailable) && (
              <div className="flex gap-1 rounded-lg border bg-muted/40 p-1">
                <button
                  type="button"
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                    tab === "legal" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setTab("legal")}
                >
                  <FileText className="h-3.5 w-3.5" />
                  Legal text
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                    tab === "maple" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                    !hasMapleSummary && "opacity-60",
                  )}
                  onClick={() => setTab("maple")}
                  disabled={!hasMapleSummary}
                >
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Maple explains
                </button>
              </div>
            )}

            {tab === "maple" && hasMapleSummary ? (
              <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed">
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
                className="leg-popup-content rounded-lg border bg-muted/30 p-4 text-sm leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: popup.popup_html || popup.html_fragment || popup.text_content,
                }}
              />
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => void saveBookmark()}
                disabled={bookmarkSaved}
              >
                <Star className={cn("h-3 w-3 mr-1", bookmarkSaved && "fill-amber-400 text-amber-500")} />
                {bookmarkSaved ? "Saved" : "Save section"}
              </Button>
              {showOpenInHub && hubPath && (
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link href={hubPath} onClick={onClose}>
                    <BookOpen className="h-3 w-3 mr-1" />
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
              <DialogDescription>{error}</DialogDescription>
            </DialogHeader>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

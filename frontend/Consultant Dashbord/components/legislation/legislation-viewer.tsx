"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, BookOpen, Sparkles, FileText, Star, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

import "./legislation-viewer.css";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

export type MapleSummary = {
  summary: string;
  key_points: string[];
  openai_used?: boolean;
};

export type ResolvedProvision = {
  act_code: string;
  provision_key: string;
  language: string;
  marginal_note: string | null;
  text_content: string;
  html_fragment: string;
  popup_html?: string;
  citation: string;
  document: { id: number; title: string; slug: string };
  maple_summary?: MapleSummary | null;
  summary_available?: boolean;
};

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("wtc_consultant_token") ??
        document.cookie.match(/wtc_consultant_token=([^;]+)/)?.[1] ?? ""
      : "";
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function cacheKey(act: string, key: string, language: string): string {
  return `${act}::${key}::${language}`;
}

function sectionIdForProvision(provisionKey: string): string {
  const section = provisionKey.split("(")[0].trim();
  return `s-${section}`;
}

export function LegislationViewer({
  html,
  language = "en",
  documentId,
  actCode,
}: {
  html: string;
  language?: string;
  documentId?: number;
  actCode?: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const resolveCacheRef = React.useRef<Map<string, ResolvedProvision>>(new Map());

  const [loading, setLoading] = React.useState(false);
  const [popup, setPopup] = React.useState<ResolvedProvision | null>(null);
  const [popupError, setPopupError] = React.useState<string | null>(null);
  const [popupTab, setPopupTab] = React.useState<"legal" | "maple">("legal");
  const [summaryAvailable, setSummaryAvailable] = React.useState(false);
  const [bookmarkSaved, setBookmarkSaved] = React.useState(false);
  const [selectionText, setSelectionText] = React.useState("");
  const [selectionPos, setSelectionPos] = React.useState<{ top: number; left: number } | null>(null);
  const [explainOpen, setExplainOpen] = React.useState(false);
  const [explainLoading, setExplainLoading] = React.useState(false);
  const [explainText, setExplainText] = React.useState("");
  const autoPopupDoneRef = React.useRef<string | null>(null);

  const scrollToProvision = React.useCallback((provisionKey: string) => {
    const el = containerRef.current?.querySelector<HTMLElement>(
      `#${CSS.escape(sectionIdForProvision(provisionKey))}`,
    );
    if (!el) return false;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.add("leg-highlight-scroll");
    window.setTimeout(() => el.classList.remove("leg-highlight-scroll"), 2500);
    return true;
  }, []);

  React.useEffect(() => {
    async function loadCapabilities() {
      try {
        const res = await fetch(`${API}/legislation/capabilities`, { headers: authHeaders() });
        if (!res.ok) return;
        const json = await res.json();
        setSummaryAvailable(Boolean(json.data?.popup_summary_available));
      } catch {
        // ignore
      }
    }
    void loadCapabilities();
  }, []);

  const openFullDocument = () => {
    if (!popup?.document?.id) return;

    const targetId = popup.document.id;
    const provisionKey = popup.provision_key;

    setPopup(null);
    setPopupError(null);
    setPopupTab("legal");

    if (documentId && documentId === targetId) {
      scrollToProvision(provisionKey);
      return;
    }

    const url = `/dashboard/legislations/${targetId}?provision=${encodeURIComponent(provisionKey)}`;
    router.push(url);
  };

  const resolveReference = React.useCallback(
    async (act: string, key: string) => {
      const ck = cacheKey(act, key, language);
      const cached = resolveCacheRef.current.get(ck);
      if (cached) {
        setPopup(cached);
        setPopupTab("legal");
        return;
      }

      setLoading(true);
      setPopupError(null);
      try {
        const params = new URLSearchParams({ act, key, language, summary: "1" });
        const res = await fetch(`${API}/legislation/resolve?${params}`, { headers: authHeaders() });
        const json = await res.json();
        if (!res.ok) {
          setPopupError(json.message ?? "Reference not found.");
          setPopup(null);
          return;
        }
        const data = json.data as ResolvedProvision;
        resolveCacheRef.current.set(ck, data);
        setPopup(data);
        setPopupTab("legal");
        if (data.summary_available !== undefined) {
          setSummaryAvailable(Boolean(data.summary_available));
        }
      } catch {
        setPopupError("Could not load referenced provision.");
        setPopup(null);
      } finally {
        setLoading(false);
      }
    },
    [language],
  );

  React.useEffect(() => {
    const provision = searchParams.get("provision");
    if (!provision || !actCode) return;
    const timer = window.setTimeout(() => {
      scrollToProvision(provision);
      if (autoPopupDoneRef.current !== provision) {
        autoPopupDoneRef.current = provision;
        void resolveReference(actCode, provision);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchParams, html, actCode, scrollToProvision, resolveReference]);

  const saveBookmark = React.useCallback(async () => {
    if (!popup) return;
    try {
      const res = await fetch(`${API}/consultant/legislation/bookmarks`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
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
  }, [popup]);

  const runExplainSelection = React.useCallback(async () => {
    if (selectionText.trim().length < 10) return;
    setExplainOpen(true);
    setExplainLoading(true);
    setExplainText("");
    try {
      const res = await fetch(`${API}/legislation/explain`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          text: selectionText,
          citation: actCode ? `${actCode} document` : undefined,
        }),
      });
      const json = await res.json();
      setExplainText(json.data?.explanation ?? json.message ?? "Could not explain this selection.");
    } catch {
      setExplainText("Could not explain this selection.");
    } finally {
      setExplainLoading(false);
      setSelectionPos(null);
    }
  }, [selectionText, actCode]);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onMouseUp = () => {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? "";
      if (!text || text.length < 12 || !sel?.rangeCount) {
        setSelectionPos(null);
        return;
      }
      const range = sel.getRangeAt(0);
      if (!el.contains(range.commonAncestorContainer)) {
        setSelectionPos(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      setSelectionText(text);
      setSelectionPos({ top: rect.top + window.scrollY - 40, left: rect.left + window.scrollX });
    };

    document.addEventListener("mouseup", onMouseUp);
    return () => document.removeEventListener("mouseup", onMouseUp);
  }, [html]);

  React.useEffect(() => {
    setBookmarkSaved(false);
  }, [popup?.act_code, popup?.provision_key]);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a.leg-ref") as HTMLAnchorElement | null;
      if (!target) return;
      e.preventDefault();

      const act = target.dataset.act ?? "";
      const key = target.dataset.key ?? "";
      if (target.dataset.external === "1") return;

      void resolveReference(act, key);
    };

    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [html, resolveReference]);

  const hasMapleSummary = Boolean(popup?.maple_summary?.summary);

  return (
    <>
      <div
        ref={containerRef}
        className="legislation-viewer relative min-w-0 max-w-full overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {selectionPos && (
        <Button
          type="button"
          size="sm"
          className={cn(
            "fixed z-50 h-9 gap-1.5 px-3 shadow-lg",
            isMobile
              ? "bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 w-[min(100%,calc(100vw-1.5rem))] -translate-x-1/2"
              : "max-w-xs",
          )}
          style={
            isMobile
              ? undefined
              : { top: selectionPos.top, left: selectionPos.left }
          }
          onClick={() => void runExplainSelection()}
        >
          <MessageCircle className="h-3.5 w-3.5 shrink-0" />
          Ask Maple
        </Button>
      )}

      {loading && (
        <div className="fixed bottom-4 left-3 right-3 z-50 flex items-center justify-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm shadow-lg sm:left-auto sm:right-6 sm:justify-start">
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
          Loading reference…
        </div>
      )}

      <Dialog
        open={!!popup || !!popupError}
        onOpenChange={(o) => {
          if (!o) {
            setPopup(null);
            setPopupError(null);
            setPopupTab("legal");
          }
        }}
      >
        <DialogContent className="flex max-h-[min(88vh,900px)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-3 overflow-hidden p-4 sm:max-w-2xl sm:p-6">
          {popup && (
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
                      popupTab === "legal" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => setPopupTab("legal")}
                  >
                    <FileText className="h-3.5 w-3.5 shrink-0" />
                    Legal text
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium transition-colors",
                      popupTab === "maple" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                      !hasMapleSummary && "opacity-60",
                    )}
                    onClick={() => setPopupTab("maple")}
                    disabled={!hasMapleSummary}
                  >
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                    Maple explains
                  </button>
                </div>
              )}

              {popupTab === "maple" && hasMapleSummary ? (
                <div className="leg-maple-summary space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm leading-relaxed sm:p-4">
                  <p>{popup.maple_summary!.summary}</p>
                  {popup.maple_summary!.key_points.length > 0 && (
                    <ul className="list-disc space-y-1 pl-5 text-[13px] text-muted-foreground">
                      {popup.maple_summary!.key_points.map((point) => (
                        <li key={point}>{point}</li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    AI summary for consultant guidance — verify against the legal text before advising clients.
                  </p>
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

              {popup.document?.id ? (
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 w-full justify-center sm:w-auto"
                    onClick={openFullDocument}
                  >
                    <BookOpen className="mr-1 h-3 w-3" />
                    Open full document
                  </Button>
                </div>
              ) : null}
            </>
          )}
          {popupError && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">Reference not available</DialogTitle>
                <DialogDescription>{popupError}</DialogDescription>
              </DialogHeader>
              <p className="text-xs text-muted-foreground">Run <strong>Legislation Hub → Sync</strong> in admin.</p>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={explainOpen} onOpenChange={setExplainOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] p-4 sm:max-w-lg sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-start gap-2 text-sm leading-snug sm:text-base">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Maple explains your selection
            </DialogTitle>
          </DialogHeader>
          {explainLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              Analyzing selected text…
            </div>
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-line break-words">{explainText}</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

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
      <div ref={containerRef} className="legislation-viewer relative" dangerouslySetInnerHTML={{ __html: html }} />

      {selectionPos && (
        <Button
          type="button"
          size="sm"
          className="fixed z-50 h-8 gap-1.5 shadow-lg"
          style={{ top: selectionPos.top, left: selectionPos.left }}
          onClick={() => void runExplainSelection()}
        >
          <MessageCircle className="h-3.5 w-3.5" />
          Ask Maple
        </Button>
      )}

      {loading && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border bg-background px-4 py-2 shadow-lg text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
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
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {popup && (
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
                      popupTab === "legal" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => setPopupTab("legal")}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Legal text
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                      popupTab === "maple" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground",
                      !hasMapleSummary && "opacity-60",
                    )}
                    onClick={() => setPopupTab("maple")}
                    disabled={!hasMapleSummary}
                  >
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Maple explains
                  </button>
                </div>
              )}

              {popupTab === "maple" && hasMapleSummary ? (
                <div className="leg-maple-summary space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed">
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
                  className="leg-popup-content"
                  dangerouslySetInnerHTML={{
                    __html: popup.popup_html || popup.html_fragment || popup.text_content,
                  }}
                />
              )}

              {popup.document?.id ? (
                <div className="flex justify-between pt-2">
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
                  <Button type="button" variant="outline" size="sm" onClick={openFullDocument}>
                    <BookOpen className="h-3 w-3 mr-1" />
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Maple explains your selection
            </DialogTitle>
          </DialogHeader>
          {explainLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing selected text…
            </div>
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-line">{explainText}</p>
          )}
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        .legislation-viewer { font-size: 0.9375rem; line-height: 1.65; }
        .legislation-viewer .leg-section { margin: 1.25rem 0; padding: 1rem; border: 1px solid var(--border); border-radius: 0.5rem; }
        .legislation-viewer .leg-section-num { font-weight: 700; color: var(--primary); }
        .legislation-viewer .leg-marginal { font-size: 0.75rem; font-style: italic; color: var(--muted-foreground); }
        .legislation-viewer .leg-ref { color: var(--primary); font-weight: 600; text-decoration: underline; cursor: pointer; }
        .leg-popup-content { border-radius: 0.5rem; border: 1px solid var(--border); background: color-mix(in oklab, var(--muted) 30%, transparent); padding: 1rem 1.25rem; font-size: 0.875rem; line-height: 1.7; }
        .leg-popup-content .leg-popup-section { font-size: 1rem; font-weight: 700; color: var(--primary); padding-bottom: 0.35rem; border-bottom: 1px solid var(--border); margin-bottom: 0.5rem; }
        .leg-popup-content .leg-popup-marginal { font-size: 0.75rem; font-style: italic; color: var(--muted-foreground); margin-bottom: 0.5rem; }
        .leg-popup-content .leg-popup-body-text { text-align: justify; }
        .leg-highlight-scroll { outline: 2px solid color-mix(in oklab, var(--primary) 55%, transparent); outline-offset: 4px; border-radius: 0.5rem; transition: outline-color 0.3s ease; }
      `}</style>
    </>
  );
}

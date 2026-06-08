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
import { Loader2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

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

function sectionIdForProvision(provisionKey: string): string {
  const section = provisionKey.split("(")[0].trim();
  return `s-${section}`;
}

export function LegislationViewer({
  html,
  language = "en",
  documentId,
}: {
  html: string;
  language?: string;
  documentId?: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [loading, setLoading] = React.useState(false);
  const [popup, setPopup] = React.useState<ResolvedProvision | null>(null);
  const [popupError, setPopupError] = React.useState<string | null>(null);

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
    const provision = searchParams.get("provision");
    if (!provision) return;
    const timer = window.setTimeout(() => {
      scrollToProvision(provision);
    }, 150);
    return () => window.clearTimeout(timer);
  }, [searchParams, html, scrollToProvision]);

  const openFullDocument = () => {
    if (!popup?.document?.id) return;

    const targetId = popup.document.id;
    const provisionKey = popup.provision_key;

    setPopup(null);
    setPopupError(null);

    if (documentId && documentId === targetId) {
      scrollToProvision(provisionKey);
      return;
    }

    const url = `/dashboard/legislations/${targetId}?provision=${encodeURIComponent(provisionKey)}`;
    router.push(url);
  };

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onClick = async (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a.leg-ref") as HTMLAnchorElement | null;
      if (!target) return;
      e.preventDefault();

      const act = target.dataset.act ?? "";
      const key = target.dataset.key ?? "";
      if (target.dataset.external === "1") return;

      setLoading(true);
      setPopupError(null);
      try {
        const params = new URLSearchParams({ act, key, language });
        const res = await fetch(`${API}/legislation/resolve?${params}`, { headers: authHeaders() });
        const json = await res.json();
        if (!res.ok) {
          setPopupError(json.message ?? "Reference not found.");
          setPopup(null);
          return;
        }
        setPopup(json.data as ResolvedProvision);
      } catch {
        setPopupError("Could not load referenced provision.");
        setPopup(null);
      } finally {
        setLoading(false);
      }
    };

    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, [html, language]);

  return (
    <>
      <div ref={containerRef} className="legislation-viewer" dangerouslySetInnerHTML={{ __html: html }} />

      {loading && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border bg-background px-4 py-2 shadow-lg text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading reference…
        </div>
      )}

      <Dialog open={!!popup || !!popupError} onOpenChange={(o) => { if (!o) { setPopup(null); setPopupError(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {popup && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base pr-6 leading-snug">{popup.citation}</DialogTitle>
                <DialogDescription asChild>
                  <p className="text-xs pt-1">From: {popup.document.title}</p>
                </DialogDescription>
              </DialogHeader>
              <div className="leg-popup-content" dangerouslySetInnerHTML={{ __html: popup.popup_html || popup.html_fragment || popup.text_content }} />
              {popup.document?.id ? (
                <div className="flex justify-end pt-2">
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

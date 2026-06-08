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
import { Loader2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminAuthHeaders } from "@/lib/admin-auth";

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

export function AdminLegislationViewer({
  html,
  language = "en",
}: {
  html: string;
  language?: string;
}) {
  const [loading, setLoading] = React.useState(false);
  const [popup, setPopup] = React.useState<ResolvedProvision | null>(null);
  const [popupError, setPopupError] = React.useState<string | null>(null);

  const handleClick = React.useCallback(
    async (e: React.MouseEvent<HTMLDivElement>) => {
      const target = (e.target as HTMLElement).closest("a.leg-ref") as HTMLAnchorElement | null;
      if (!target) return;

      e.preventDefault();
      e.stopPropagation();

      const act = target.dataset.act ?? "";
      const key = target.dataset.key ?? "";
      if (!act || !key || target.dataset.external === "1" || key === "external") return;

      setLoading(true);
      setPopupError(null);
      setPopup(null);

      try {
        const params = new URLSearchParams({ act, key, language });
        const res = await fetch(`${API}/admin/legislation/resolve?${params}`, {
          headers: adminAuthHeaders(),
        });
        const json = await res.json();
        if (!res.ok) {
          setPopupError(json.message ?? "Reference not found.");
          return;
        }
        setPopup(json.data as ResolvedProvision);
      } catch {
        setPopupError("Could not load referenced provision.");
      } finally {
        setLoading(false);
      }
    },
    [language],
  );

  return (
    <>
      <div
        className="legislation-viewer"
        onClick={handleClick}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {loading && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border bg-background px-4 py-2 shadow-lg text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading reference…
        </div>
      )}

      <Dialog
        open={!!popup || !!popupError}
        onOpenChange={(open) => {
          if (!open) {
            setPopup(null);
            setPopupError(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {popup && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base pr-6 leading-snug">{popup.citation}</DialogTitle>
                <DialogDescription asChild>
                  <p className="text-xs pt-1">From: {popup.document?.title ?? popup.act_code}</p>
                </DialogDescription>
              </DialogHeader>
              <div
                className="leg-popup-content"
                dangerouslySetInnerHTML={{
                  __html: popup.popup_html || popup.html_fragment || popup.text_content || "",
                }}
              />
              {popup.document?.id && (
                <div className="flex justify-end pt-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/admindashboard/legislations-hub/documents/${popup.document.id}`}>
                      <BookOpen className="h-3 w-3 mr-1" />
                      Open full document
                    </Link>
                  </Button>
                </div>
              )}
            </>
          )}
          {popupError && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">Reference not available</DialogTitle>
                <DialogDescription>{popupError}</DialogDescription>
              </DialogHeader>
              <p className="text-xs text-muted-foreground">
                Sync the target act in <strong>Legislation Hub</strong> if it was recently added.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

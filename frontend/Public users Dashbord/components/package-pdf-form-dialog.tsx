"use client";

import * as React from "react";
import {
  ChevronLeft, ChevronRight, Download, Loader2, AlertCircle,
  ZoomIn, ZoomOut, Send, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CLIENT_API, clientUploadHeaders } from "@/lib/client-api";

async function fetchPdfBytes(streamUrl: string, headers: Record<string, string>): Promise<Uint8Array> {
  const res = await fetch(streamUrl, {
    headers: { ...headers, Accept: "application/pdf, application/octet-stream, */*" },
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json as { message?: string }).message ?? "Failed to load PDF.");
  }
  const buffer = await res.arrayBuffer();
  if (!buffer.byteLength) throw new Error("PDF file is empty.");
  return new Uint8Array(buffer);
}

export function PackagePdfFormDialog({
  open,
  onOpenChange,
  documentId,
  title,
  streamUrl,
  getAuthHeaders,
  alreadySubmitted,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: number;
  title: string;
  streamUrl: string;
  getAuthHeaders: () => Record<string, string>;
  alreadySubmitted?: boolean;
  onSubmitted?: () => void;
}) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const pendingBytesRef = React.useRef<Uint8Array | null>(null);
  const getAuthHeadersRef = React.useRef(getAuthHeaders);
  const viewerReadyRef = React.useRef(false);

  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(alreadySubmitted ?? false);
  const [page, setPage] = React.useState(1);
  const [numPages, setNumPages] = React.useState(0);
  const [scale, setScale] = React.useState(1.1);
  const [viewerReady, setViewerReady] = React.useState(false);

  getAuthHeadersRef.current = getAuthHeaders;

  const postToViewer = React.useCallback((payload: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(
      { target: "wtc-pdf-viewer", ...payload },
      "*",
    );
  }, []);

  const deliverPdf = React.useCallback(() => {
    if (!viewerReadyRef.current || !pendingBytesRef.current) return;
    postToViewer({ type: "load-bytes", data: pendingBytesRef.current });
  }, [postToViewer]);

  React.useEffect(() => {
    if (!open) {
      viewerReadyRef.current = false;
      setViewerReady(false);
      setSubmitted(alreadySubmitted ?? false);
      pendingBytesRef.current = null;
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setPage(1);
      setNumPages(0);
      pendingBytesRef.current = null;

      try {
        const bytes = await fetchPdfBytes(streamUrl, getAuthHeadersRef.current());
        if (cancelled) return;
        pendingBytesRef.current = bytes;
        deliverPdf();
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load PDF.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      viewerReadyRef.current = false;
      pendingBytesRef.current = null;
    };
  }, [open, streamUrl, deliverPdf, alreadySubmitted]);

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || msg.source !== "wtc-pdf-viewer") return;

      if (msg.type === "ready") {
        viewerReadyRef.current = true;
        setViewerReady(true);
        deliverPdf();
      }
      if (msg.type === "loaded") {
        setNumPages(Number(msg.numPages) || 0);
        setPage(1);
        setError(null);
      }
      if (msg.type === "error") {
        setError(String(msg.message ?? "Could not display this PDF."));
      }
      if (msg.type === "saved" && msg.data) {
        void uploadSavedPdf(msg.data as ArrayBuffer);
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [deliverPdf]);

  React.useEffect(() => {
    if (!viewerReady || loading || error) return;
    postToViewer({ type: "set-page", page });
  }, [page, viewerReady, loading, error, postToViewer]);

  React.useEffect(() => {
    if (!viewerReady || loading || error) return;
    postToViewer({ type: "set-scale", scale });
  }, [scale, viewerReady, loading, error, postToViewer]);

  async function uploadSavedPdf(data: ArrayBuffer) {
    setSubmitting(true);
    setError(null);
    try {
      const blob = new Blob([data], { type: "application/pdf" });
      const form = new FormData();
      form.append("file", blob, title.replace(/[^\w\s.-]/g, "_") + ".pdf");

      const res = await fetch(`${CLIENT_API}/client/package-documents/${documentId}/submit`, {
        method: "POST",
        headers: clientUploadHeaders(),
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Submit failed.");

      setSubmitted(true);
      onSubmitted?.();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Submit failed.");
    } finally {
      setSubmitting(false);
    }
  }

  function requestSaveAndSubmit() {
    setSubmitting(true);
    setError(null);
    postToViewer({ type: "save" });
  }

  function downloadOriginal() {
    if (!pendingBytesRef.current) return;
    const blob = new Blob([Uint8Array.from(pendingBytesRef.current)], { type: "application/pdf" });
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u;
    a.download = title.replace(/[^\w\s.-]/g, "_") + ".pdf";
    a.click();
    URL.revokeObjectURL(u);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[96vw] max-h-[92vh] flex flex-col p-0 gap-0 sm:max-w-5xl">
        <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <div className="flex items-start gap-2 pr-8">
            <DialogTitle className="flex-1">{title}</DialogTitle>
            {submitted && (
              <Badge className="bg-green-600 shrink-0 gap-1">
                <CheckCircle2 className="h-3 w-3" /> Submitted
              </Badge>
            )}
          </div>
          <DialogDescription>
            Fill the form below, then submit to your consultant for review.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 px-5 py-2 border-b bg-muted/30 shrink-0 flex-wrap">
          <div className="flex items-center gap-1">
            <Button size="icon" variant="outline" className="h-8 w-8" disabled={page <= 1 || loading || !!error} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs tabular-nums px-2 min-w-[80px] text-center">
              {numPages > 0 ? `${page} / ${numPages}` : "—"}
            </span>
            <Button size="icon" variant="outline" className="h-8 w-8" disabled={page >= numPages || loading || !!error} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <Button size="icon" variant="outline" className="h-8 w-8" disabled={!!error} onClick={() => setScale((s) => Math.max(0.6, s - 0.15))}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs w-12 text-center tabular-nums">{Math.round(scale * 100)}%</span>
            <Button size="icon" variant="outline" className="h-8 w-8" disabled={!!error} onClick={() => setScale((s) => Math.min(2.5, s + 0.15))}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 ml-1" onClick={downloadOriginal} disabled={loading || !pendingBytesRef.current}>
              <Download className="h-3.5 w-3.5" /> Download
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={requestSaveAndSubmit}
              disabled={loading || submitting || !!error || !viewerReady}
            >
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {submitting ? "Submitting…" : submitted ? "Resubmit" : "Submit to consultant"}
            </Button>
          </div>
        </div>

        <div className="relative flex-1 min-h-[60vh] bg-neutral-700">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-background/90 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading form…
            </div>
          )}

          {error && !loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
              <div className="max-w-md text-center space-y-3 bg-background rounded-xl border p-6 shadow-lg">
                <AlertCircle className="h-10 w-10 text-amber-500 mx-auto" />
                <p className="text-sm font-medium">{error}</p>
                <Button size="sm" variant="outline" onClick={downloadOriginal}>
                  <Download className="h-4 w-4 mr-1.5" /> Download PDF
                </Button>
              </div>
            </div>
          )}

          <iframe
            ref={iframeRef}
            title={title}
            src="/pdf-viewer/form-viewer.html"
            className={cn("absolute inset-0 h-full w-full border-0", (loading || error) && "opacity-0 pointer-events-none")}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

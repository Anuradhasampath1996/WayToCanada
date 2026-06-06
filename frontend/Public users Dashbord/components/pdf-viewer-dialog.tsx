"use client";

import * as React from "react";
import {
  ChevronLeft, ChevronRight, Download, Loader2, AlertCircle, ZoomIn, ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

async function fetchPdfBytes(streamUrl: string, headers: Record<string, string>): Promise<ArrayBuffer> {
  const res = await fetch(streamUrl, { headers });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json as { message?: string }).message ?? "Failed to load PDF.");
  }
  return res.arrayBuffer();
}

export function PdfViewerDialog({
  open,
  onOpenChange,
  title,
  streamUrl,
  getAuthHeaders,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  streamUrl: string;
  getAuthHeaders: () => Record<string, string>;
}) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const pendingBytesRef = React.useRef<ArrayBuffer | null>(null);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [numPages, setNumPages] = React.useState(0);
  const [scale, setScale] = React.useState(1.1);
  const [viewerReady, setViewerReady] = React.useState(false);

  const postToViewer = React.useCallback((payload: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(
      { target: "wtc-pdf-viewer", ...payload },
      "*",
    );
  }, []);

  React.useEffect(() => {
    if (!open || !streamUrl) {
      setViewerReady(false);
      pendingBytesRef.current = null;
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setPage(1);
      setNumPages(0);

      try {
        const buffer = await fetchPdfBytes(streamUrl, getAuthHeaders());
        if (cancelled) return;
        pendingBytesRef.current = buffer;
        if (iframeRef.current?.contentWindow) {
          postToViewer({ type: "load-bytes", data: buffer });
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not display this PDF.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      pendingBytesRef.current = null;
      setViewerReady(false);
    };
  }, [open, streamUrl, getAuthHeaders, postToViewer]);

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || msg.source !== "wtc-pdf-viewer") return;

      if (msg.type === "ready") {
        setViewerReady(true);
        if (pendingBytesRef.current) {
          postToViewer({ type: "load-bytes", data: pendingBytesRef.current });
        }
      }

      if (msg.type === "loaded") {
        setNumPages(Number(msg.numPages) || 0);
        setPage(1);
        setError(null);
      }

      if (msg.type === "error") {
        setError(String(msg.message ?? "Could not display this PDF."));
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [postToViewer]);

  React.useEffect(() => {
    if (!viewerReady || loading || error) return;
    postToViewer({ type: "set-page", page });
  }, [page, viewerReady, loading, error, postToViewer]);

  React.useEffect(() => {
    if (!viewerReady || loading || error) return;
    postToViewer({ type: "set-scale", scale });
  }, [scale, viewerReady, loading, error, postToViewer]);

  const downloadPdf = () => {
    fetch(`${streamUrl}${streamUrl.includes("?") ? "&" : "?"}download=1`, { headers: getAuthHeaders() })
      .then((r) => r.blob())
      .then((blob) => {
        const u = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = u;
        a.download = title.replace(/[^\w\s.-]/g, "_") + ".pdf";
        a.click();
        URL.revokeObjectURL(u);
      })
      .catch(() => setError("Download failed."));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[96vw] max-h-[92vh] flex flex-col p-0 gap-0 sm:max-w-5xl">
        <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="pr-8">{title}</DialogTitle>
          <DialogDescription>
            Full PDF viewer with IRCC XFA form support — scroll to navigate pages.
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
          <div className="flex items-center gap-1">
            <Button size="icon" variant="outline" className="h-8 w-8" disabled={!!error} onClick={() => setScale((s) => Math.max(0.6, s - 0.15))}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs w-12 text-center tabular-nums">{Math.round(scale * 100)}%</span>
            <Button size="icon" variant="outline" className="h-8 w-8" disabled={!!error} onClick={() => setScale((s) => Math.min(2.5, s + 0.15))}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" className="gap-1.5 ml-2" onClick={downloadPdf} disabled={loading}>
              <Download className="h-3.5 w-3.5" /> Download
            </Button>
          </div>
        </div>

        <div className="relative flex-1 min-h-[55vh] bg-neutral-700">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-neutral-100/90 dark:bg-neutral-900/90 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading PDF…
            </div>
          )}

          {error && !loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
              <div className="max-w-md text-center space-y-3 bg-background rounded-xl border p-6 shadow-lg">
                <AlertCircle className="h-10 w-10 text-amber-500 mx-auto" />
                <p className="text-sm font-medium">{error}</p>
                <p className="text-xs text-muted-foreground">
                  If this is a legacy IRCC form, download and open in Adobe Acrobat Reader (desktop).
                </p>
                <Button size="sm" variant="outline" onClick={downloadPdf}>
                  <Download className="h-4 w-4 mr-1.5" /> Download PDF
                </Button>
              </div>
            </div>
          )}

          <iframe
            ref={iframeRef}
            title={title}
            src="/pdf-viewer/index.html"
            className={cn("absolute inset-0 h-full w-full border-0", (loading || error) && "opacity-0 pointer-events-none")}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

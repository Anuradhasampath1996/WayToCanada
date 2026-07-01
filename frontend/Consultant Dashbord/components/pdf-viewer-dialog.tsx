"use client";

import * as React from "react";
import { Download, Loader2, AlertCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

async function fetchPdfBlob(streamUrl: string, headers: Record<string, string>): Promise<Blob> {
  const res = await fetch(streamUrl, {
    headers: {
      ...headers,
      Accept: "application/pdf, application/octet-stream, */*",
    },
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json as { message?: string }).message ?? "Failed to load PDF.");
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json as { message?: string }).message ?? "Failed to load PDF.");
  }
  const blob = await res.blob();
  if (!blob.size) {
    throw new Error("PDF file is empty.");
  }
  return blob;
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
  const blobUrlRef = React.useRef<string | null>(null);
  const getAuthHeadersRef = React.useRef(getAuthHeaders);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);
  const [showXfaHint, setShowXfaHint] = React.useState(false);
  const [hintDismissed, setHintDismissed] = React.useState(false);

  getAuthHeadersRef.current = getAuthHeaders;

  const revokeBlobUrl = React.useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
    setBlobUrl(null);
  }, []);

  React.useEffect(() => {
    if (!open || !streamUrl) {
      setError(null);
      setShowXfaHint(false);
      setHintDismissed(false);
      revokeBlobUrl();
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      setShowXfaHint(false);
      setHintDismissed(false);
      revokeBlobUrl();

      try {
        const blob = await fetchPdfBlob(streamUrl, getAuthHeadersRef.current());
        if (cancelled) return;

        const url = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobUrl(url);

        setShowXfaHint(
          /citizenship|imm\s*\d|ircc|xfa|application for/i.test(title),
        );
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
      revokeBlobUrl();
    };
  }, [open, streamUrl, revokeBlobUrl]);

  const downloadPdf = () => {
    if (blobUrlRef.current) {
      const a = document.createElement("a");
      a.href = blobUrlRef.current;
      a.download = title.replace(/[^\w\s.-]/g, "_") + ".pdf";
      a.click();
      return;
    }

    fetch(`${streamUrl}${streamUrl.includes("?") ? "&" : "?"}download=1`, {
      headers: getAuthHeadersRef.current(),
    })
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

  const openInNewTab = () => {
    if (blobUrlRef.current) {
      window.open(blobUrlRef.current, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[96vw] max-h-[92vh] flex flex-col p-0 gap-0 sm:max-w-5xl">
        <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <DialogTitle className="pr-8">{title}</DialogTitle>
          <DialogDescription>
            Preview the document below, or download to open locally.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-end gap-2 px-5 py-2 border-b bg-muted/30 shrink-0 flex-wrap">
          {blobUrl && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={openInNewTab}>
              <ExternalLink className="h-3.5 w-3.5" /> Open in new tab
            </Button>
          )}
          <Button
            size="sm"
            variant={showXfaHint ? "default" : "outline"}
            className="gap-1.5"
            onClick={downloadPdf}
            disabled={loading}
          >
            <Download className="h-3.5 w-3.5" />
            {showXfaHint ? "Download for Acrobat Reader" : "Download PDF"}
          </Button>
        </div>

        {showXfaHint && !hintDismissed && !loading && !error && (
          <div className="mx-5 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 shrink-0 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-amber-800">
                This IRCC form may not display fully in your browser. Download it and open with{" "}
                <strong>Adobe Acrobat Reader</strong> (free) to view all fields.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setHintDismissed(true)}
              className="text-xs text-amber-700 hover:underline shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="relative flex-1 min-h-[55vh] bg-neutral-200">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-background/90 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading PDF…
            </div>
          )}

          {error && !loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
              <div className="max-w-md text-center space-y-3 bg-background rounded-xl border p-6 shadow-lg">
                <AlertCircle className="h-10 w-10 text-amber-500 mx-auto" />
                <p className="text-sm font-medium">{error}</p>
                <Button size="sm" variant="outline" onClick={downloadPdf}>
                  <Download className="h-4 w-4 mr-1.5" /> Download PDF
                </Button>
              </div>
            </div>
          )}

          {blobUrl && !error && (
            <iframe
              title={title}
              src={blobUrl}
              className="absolute inset-0 h-full w-full border-0 bg-white"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

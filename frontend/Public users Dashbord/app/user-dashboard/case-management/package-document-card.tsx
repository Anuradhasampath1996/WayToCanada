"use client";

import { useEffect, useState } from "react";
import {
  Eye, Loader2, FileText, ClipboardList, FilePen, CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { clientStreamHeaders } from "@/lib/client-api";
import { renderPdfThumbnail } from "@/lib/pdf-thumbnail";
import { PREVIEW_HEIGHT, PREVIEW_WIDTH } from "@/lib/preview-constants";
import { PdfFormViewerPreview } from "@/lib/pdf-form-viewer-preview";

export interface PackageDocumentItem {
  id: number;
  label: string;
  doc_type: string;
  original_filename: string;
  submission?: { id: number; status: string; submitted_at: string | null } | null;
}

function docTypeIcon(docType: string) {
  if (docType === "checklist") return ClipboardList;
  if (docType === "form") return FilePen;
  return FileText;
}

async function fetchPdfBytes(
  streamUrl: string,
  headers: Record<string, string>,
): Promise<Uint8Array | null> {
  const res = await fetch(streamUrl, {
    headers: {
      ...headers,
      Accept: "application/pdf, application/octet-stream, */*",
    },
  });
  if (!res.ok) return null;
  const buffer = await res.arrayBuffer();
  if (!buffer.byteLength) return null;
  return new Uint8Array(buffer);
}

export function PackageDocumentCard({
  doc,
  streamUrl,
  onOpen,
}: {
  doc: PackageDocumentItem;
  streamUrl: string;
  onOpen: () => void;
}) {
  const Icon = docTypeIcon(doc.doc_type);
  const isSubmitted = Boolean(doc.submission?.submitted_at);
  const isForm = doc.doc_type === "form";

  const [loadingPreview, setLoadingPreview] = useState(true);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [useViewerPreview, setUseViewerPreview] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoadingPreview(true);
      setPdfBytes(null);
      setThumbnailUrl(null);
      setUseViewerPreview(false);

      try {
        const bytes = await fetchPdfBytes(streamUrl, clientStreamHeaders());
        if (cancelled) return;
        if (!bytes) return;

        setPdfBytes(bytes);

        if (isForm) {
          setUseViewerPreview(true);
          return;
        }

        const dataUrl = await renderPdfThumbnail(bytes, PREVIEW_WIDTH, PREVIEW_HEIGHT);
        if (cancelled) return;
        if (dataUrl) {
          setThumbnailUrl(dataUrl);
        } else {
          setUseViewerPreview(true);
        }
      } catch {
        // preview unavailable — fallback UI shown
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [streamUrl, isForm]);

  const hasPreview = Boolean(thumbnailUrl || (useViewerPreview && pdfBytes));
  const statusBadge = isSubmitted ? (
    <Badge className="bg-green-600 text-[10px] shrink-0">Submitted</Badge>
  ) : isForm ? (
    <Badge variant="secondary" className="text-[10px] shrink-0">Fill & submit</Badge>
  ) : (
    <Badge variant="outline" className="text-[10px] shrink-0">{doc.doc_type}</Badge>
  );

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold line-clamp-2">{doc.label}</p>
            <p className="text-xs text-muted-foreground truncate">{doc.original_filename}</p>
          </div>
        </div>
        {statusBadge}
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-lg border-2 transition-colors cursor-pointer",
          loadingPreview
            ? "border-primary/40 bg-primary/5"
            : hasPreview
              ? "border-green-400 bg-green-50/50 hover:border-primary/60"
              : "border-border hover:border-primary/50 hover:bg-muted/30",
        )}
        onClick={onOpen}
      >
        {loadingPreview ? (
          <div className="flex h-44 items-center justify-center gap-2 text-sm text-primary">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading preview…</span>
          </div>
        ) : thumbnailUrl ? (
          <div className="relative h-44 w-full bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbnailUrl}
                  alt={doc.label}
                  className="block h-full w-full"
                />
            <PreviewOverlay isSubmitted={isSubmitted} onOpen={onOpen} />
          </div>
        ) : useViewerPreview && pdfBytes ? (
          <div className="relative h-44 w-full">
            <PdfFormViewerPreview bytes={pdfBytes} label={doc.label} />
            <PreviewOverlay isSubmitted={isSubmitted} onOpen={onOpen} />
          </div>
        ) : (
          <div className="flex h-44 flex-col items-center justify-center gap-2 bg-gradient-to-b from-muted/30 to-muted/10 px-4 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-red-50">
              <FileText className="h-9 w-9 text-red-400" />
            </div>
            <span className="text-xs font-medium text-foreground">PDF form</span>
            <span className="text-[11px] text-muted-foreground">Click to open and fill</span>
          </div>
        )}
      </div>

      <Button
        type="button"
        variant={isForm && !isSubmitted ? "default" : "outline"}
        size="sm"
        className="h-8 w-full text-xs"
        onClick={onOpen}
      >
        <Eye className="mr-1.5 h-3.5 w-3.5" />
        {isForm
          ? isSubmitted
            ? "View submitted form"
            : "Fill & submit form"
          : "View document"}
      </Button>
    </div>
  );
}

function PreviewOverlay({
  isSubmitted,
  onOpen,
}: {
  isSubmitted: boolean;
  onOpen: () => void;
}) {
  return (
    <>
      <button
        type="button"
        className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full border border-green-300 bg-white/90 px-2.5 py-1.5 text-xs font-medium text-green-700 shadow-md backdrop-blur-sm transition-all hover:bg-white"
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
      >
        <Eye className="h-3.5 w-3.5" />
        View
      </button>
      {isSubmitted && (
        <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1 rounded-full bg-green-600/90 px-2 py-1 text-[10px] font-semibold text-white shadow backdrop-blur-sm">
          <CheckCircle2 className="h-3 w-3" />
          Submitted
        </div>
      )}
    </>
  );
}

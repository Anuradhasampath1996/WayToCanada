"use client";

import { useEffect, useState } from "react";
import { Eye, Loader2, FileText, MoreHorizontal, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { renderImageThumbnail } from "@/lib/image-thumbnail";
import { renderPdfThumbnail } from "@/lib/pdf-thumbnail";
import { PREVIEW_HEIGHT, PREVIEW_WIDTH } from "@/lib/preview-constants";

export interface ConsultantDocumentItem {
  id: number;
  document_type: string;
  document_label: string;
  original_filename: string;
  mime_type: string | null;
  file_size: number | null;
  status: string;
  ai_confidence?: number | null;
  ai_match_result?: { matched: boolean; reason: string } | null;
  rejection_comment?: string | null;
  uploaded_at?: string | null;
}

function inferPreviewType(mime: string | null, filename: string): "image" | "pdf" | "other" {
  if (mime?.startsWith("image/")) return "image";
  if (mime === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) return "pdf";
  if (/\.(jpe?g|png|webp|gif)$/i.test(filename)) return "image";
  return "other";
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtSize(bytes: number | null | undefined) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

const STATUS_BORDER: Record<string, string> = {
  consultant_approved: "border-green-300",
  consultant_rejected: "border-red-300",
  ai_flagged: "border-orange-300",
  pending_review: "border-amber-200",
  under_ai_review: "border-blue-200",
};

export function ConsultantDocumentPreviewCard({
  doc,
  streamUrl,
  getAuthHeaders,
  statusBadge,
  onView,
  onManage,
}: {
  doc: ConsultantDocumentItem;
  streamUrl: string;
  getAuthHeaders: () => Record<string, string>;
  statusBadge?: React.ReactNode;
  onView: () => void;
  onManage?: () => void;
}) {
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<"image" | "pdf" | "other">("other");

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      setLoadingPreview(true);
      setPreviewUrl(null);
      try {
        const res = await fetch(streamUrl, { headers: getAuthHeaders() });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;

        const type = inferPreviewType(doc.mime_type, doc.original_filename);

        if (type === "image") {
          const thumb = await renderImageThumbnail(blob, PREVIEW_WIDTH, PREVIEW_HEIGHT);
          if (cancelled) return;
          if (thumb) {
            setPreviewUrl(thumb);
            setPreviewType("image");
          } else {
            objectUrl = URL.createObjectURL(blob);
            setPreviewUrl(objectUrl);
            setPreviewType("image");
          }
        } else if (type === "pdf") {
          const buf = await blob.arrayBuffer();
          const thumb = await renderPdfThumbnail(new Uint8Array(buf), PREVIEW_WIDTH, PREVIEW_HEIGHT);
          if (cancelled) return;
          if (thumb) {
            setPreviewUrl(thumb);
            setPreviewType("image");
          } else {
            setPreviewUrl(null);
            setPreviewType("pdf");
          }
        } else {
          setPreviewUrl(null);
          setPreviewType("other");
        }
      } catch {
        if (!cancelled) {
          setPreviewUrl(null);
          setPreviewType("other");
        }
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [streamUrl, doc.mime_type, doc.original_filename, getAuthHeaders]);

  const borderClass = STATUS_BORDER[doc.status] ?? "border-border";

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-3 space-y-2.5 transition-colors",
        doc.status === "consultant_approved" && "bg-green-50/20",
        doc.status === "consultant_rejected" && "bg-red-50/20",
        doc.status === "ai_flagged" && "bg-orange-50/20",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{doc.document_label}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {doc.original_filename}
            {doc.file_size ? ` · ${fmtSize(doc.file_size)}` : ""}
          </p>
        </div>
        {statusBadge}
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-lg border-2 bg-white",
          loadingPreview ? "border-primary/30" : borderClass,
        )}
      >
        {loadingPreview ? (
          <div className="flex h-44 items-center justify-center gap-2 text-sm text-primary">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading preview…</span>
          </div>
        ) : previewUrl && previewType === "image" ? (
          <div
            className="relative h-44 w-full cursor-pointer"
            onClick={onView}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={doc.original_filename}
              className="block h-full w-full object-cover object-top"
            />
            <PreviewOverlay onView={onView} />
          </div>
        ) : previewType === "pdf" ? (
          <div
            className="relative flex h-44 cursor-pointer flex-col items-center justify-center gap-2 bg-gradient-to-b from-red-50/80 to-white"
            onClick={onView}
          >
            <FileText className="h-14 w-14 text-red-400" />
            <span className="text-xs font-medium text-red-500">PDF document</span>
            <PreviewOverlay onView={onView} />
          </div>
        ) : (
          <div
            className="relative flex h-44 cursor-pointer flex-col items-center justify-center gap-2 px-4 text-center"
            onClick={onView}
          >
            <FileText className="h-12 w-12 text-muted-foreground/50" />
            <span className="truncate text-xs text-muted-foreground">{doc.original_filename}</span>
            <PreviewOverlay onView={onView} />
          </div>
        )}
      </div>

      {doc.ai_match_result && (
        <div
          className={cn(
            "rounded-lg px-2.5 py-1.5 text-[11px]",
            doc.ai_match_result.matched ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800",
          )}
        >
          <Bot className="mr-1 inline h-3 w-3" />
          {doc.ai_match_result.reason}
          {doc.ai_confidence != null && ` (${(doc.ai_confidence * 100).toFixed(0)}%)`}
        </div>
      )}

      {doc.rejection_comment && (
        <p className="rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700 line-clamp-2">
          {doc.rejection_comment}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        {doc.uploaded_at && (
          <span className="text-[10px] text-muted-foreground">Uploaded {fmtDate(doc.uploaded_at)}</span>
        )}
        <div className="ml-auto flex gap-1.5">
          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={onView}>
            <Eye className="h-3 w-3" /> View
          </Button>
          {onManage && (
            <Button
              size="sm"
              className="h-7 gap-1 text-xs"
              variant={doc.status === "consultant_rejected" ? "outline" : "default"}
              onClick={onManage}
            >
              <MoreHorizontal className="h-3 w-3" />
              Manage
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewOverlay({ onView }: { onView: () => void }) {
  return (
    <button
      type="button"
      className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-full border border-green-300 bg-white/90 px-2.5 py-1.5 text-xs font-medium text-green-700 shadow-md backdrop-blur-sm transition-all hover:bg-white"
      onClick={(e) => {
        e.stopPropagation();
        onView();
      }}
    >
      <Eye className="h-3.5 w-3.5" />
      View
    </button>
  );
}

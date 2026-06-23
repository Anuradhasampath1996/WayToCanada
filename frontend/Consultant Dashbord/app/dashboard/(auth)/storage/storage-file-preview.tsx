"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Move,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type PreviewKind = "pdf" | "image" | "text" | "docx" | "unsupported";

const ZOOM_LEVELS = [50, 75, 100, 125, 150, 175, 200, 250, 300];

export function getPreviewKind(file: {
  mime_type: string | null;
  original_filename: string;
}): PreviewKind {
  const mime = (file.mime_type ?? "").toLowerCase();
  const name = file.original_filename.toLowerCase();
  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (
    mime.startsWith("image/") ||
    /\.(jpe?g|png|gif|webp|bmp|svg)$/.test(name)
  ) {
    return "image";
  }
  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  ) {
    return "docx";
  }
  if (mime.startsWith("text/") || name.endsWith(".txt") || name.endsWith(".csv")) return "text";
  return "unsupported";
}

function shortFilename(name: string, max = 56): string {
  if (name.length <= max) return name;
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  const base = name.slice(0, max - ext.length - 3);
  return `${base}...${ext}`;
}

type StorageFilePreview = {
  id: number;
  original_filename: string;
  mime_type: string | null;
};

type Props = {
  file: StorageFilePreview | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  previewUrl: string | null;
  previewText: string | null;
  previewHtml: string | null;
  previewKind: PreviewKind | null;
  loading: boolean;
  onDownload: (file: StorageFilePreview) => void;
};

function ZoomToolbar({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
  canZoom,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  canZoom: boolean;
}) {
  if (!canZoom) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2 sm:px-4">
      <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={onZoomOut} disabled={zoom <= ZOOM_LEVELS[0]}>
        <ZoomOut className="h-4 w-4" />
      </Button>
      <span className="min-w-[3.5rem] text-center text-sm font-medium tabular-nums">{zoom}%</span>
      <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={onZoomIn} disabled={zoom >= ZOOM_LEVELS[ZOOM_LEVELS.length - 1]}>
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button type="button" size="sm" variant="ghost" className="h-8 gap-1" onClick={onReset}>
        <RotateCcw className="h-3.5 w-3.5" />
        Reset
      </Button>
      <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:ml-auto sm:flex">
        <Move className="h-3.5 w-3.5" />
        Click &amp; drag to pan
      </span>
    </div>
  );
}

/** Scroll container with mouse-drag panning (grab & move). */
function PanZoomViewport({
  children,
  className,
  blockChildPointerEvents = false,
}: {
  children: ReactNode;
  className?: string;
  blockChildPointerEvents?: boolean;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  };

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !viewportRef.current) return;
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;
      viewportRef.current.scrollLeft -= dx;
      viewportRef.current.scrollTop -= dy;
      lastPos.current = { x: e.clientX, y: e.clientY };
    };

    const stopDrag = () => {
      dragging.current = false;
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", stopDrag);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", stopDrag);
    };
  }, []);

  return (
    <div
      ref={viewportRef}
      onMouseDown={onMouseDown}
      className={cn(
        "h-[min(55vh,32rem)] w-full overflow-auto select-none sm:h-[60vh]",
        "cursor-grab active:cursor-grabbing",
        blockChildPointerEvents && "[&_*]:pointer-events-none",
        className,
      )}
    >
      {children}
    </div>
  );
}

function EditNotice({ kind }: { kind: PreviewKind }) {
  if (kind === "pdf") {
    return (
      <p className="border-b bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:bg-amber-950/30 dark:text-amber-100 sm:px-4">
        PDF preview &amp; zoom are available here. To <strong>edit</strong> this PDF, download it and use
        Adobe Acrobat or similar — full in-browser PDF editing needs an OnlyOffice server (future upgrade).
      </p>
    );
  }
  if (kind === "docx") {
    return (
      <p className="border-b bg-blue-50 px-3 py-2 text-xs text-blue-950 dark:bg-blue-950/30 dark:text-blue-100 sm:px-4">
        Word preview is <strong>read-only</strong>. Download the file to edit in Microsoft Word on your computer.
        Full in-browser Word editing needs OnlyOffice or Microsoft 365 integration.
      </p>
    );
  }
  return null;
}

export function StorageFilePreviewDialog({
  file,
  open,
  onOpenChange,
  previewUrl,
  previewText,
  previewHtml,
  previewKind,
  loading,
  onDownload,
}: Props) {
  const [zoom, setZoom] = useState(100);

  useEffect(() => {
    if (!open) setZoom(100);
  }, [open, file?.id]);

  const canZoom = previewKind === "image" || previewKind === "pdf";

  const zoomIn = useCallback(() => {
    setZoom((z) => {
      const next = ZOOM_LEVELS.find((l) => l > z);
      return next ?? z;
    });
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((z) => {
      const prev = [...ZOOM_LEVELS].reverse().find((l) => l < z);
      return prev ?? z;
    });
  }, []);

  const openInNewTab = () => {
    if (previewUrl) window.open(previewUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-none sm:w-[min(96vw,56rem)]">
        <DialogHeader className="shrink-0 border-b px-4 py-3 sm:px-5 sm:py-4">
          <DialogTitle className="truncate pr-8 text-sm font-medium sm:pr-10 sm:text-base" title={file?.original_filename}>
            {file ? shortFilename(file.original_filename) : "Preview"}
          </DialogTitle>
        </DialogHeader>

        {previewKind && <EditNotice kind={previewKind} />}

        <ZoomToolbar
          zoom={zoom}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onReset={() => setZoom(100)}
          canZoom={canZoom}
        />

        <div className="min-h-0 flex-1 overflow-hidden bg-muted/20">
          {loading ? (
            <div className="flex h-[min(55vh,32rem)] items-center justify-center sm:h-[60vh]">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : previewKind === "pdf" && previewUrl ? (
            <PanZoomViewport
              className="bg-neutral-200 dark:bg-neutral-800"
              blockChildPointerEvents={zoom > 100}
            >
              <iframe
                src={previewUrl}
                title={file?.original_filename}
                className="block min-h-[min(55vh,32rem)] border-0 bg-white sm:min-h-[60vh]"
                style={{
                  width: `${zoom}%`,
                  minWidth: "100%",
                  pointerEvents: zoom > 100 ? "none" : "auto",
                }}
              />
            </PanZoomViewport>
          ) : previewKind === "image" && previewUrl ? (
            <PanZoomViewport className="bg-neutral-100 dark:bg-neutral-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={file?.original_filename}
                className="block h-auto max-w-none pointer-events-none"
                style={{ width: `${zoom}%`, minWidth: zoom <= 100 ? "100%" : undefined }}
                draggable={false}
              />
            </PanZoomViewport>
          ) : previewKind === "docx" && previewHtml ? (
            <div
              className="docx-preview h-[min(55vh,32rem)] overflow-auto bg-white p-4 text-sm leading-relaxed text-foreground dark:bg-neutral-950 sm:h-[60vh] sm:p-6 [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_ol]:my-2 [&_p]:my-2 [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:bg-muted [&_th]:p-2 [&_ul]:my-2"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          ) : previewKind === "text" && previewText !== null ? (
            <pre className="h-[min(55vh,32rem)] overflow-auto whitespace-pre-wrap p-3 text-sm font-mono sm:h-[60vh] sm:p-4">{previewText}</pre>
          ) : (
            <div className="flex h-[40vh] flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
              <FileText className="h-10 w-10 opacity-50" />
              <p>Preview is not available for this file type.</p>
              {file && (
                <Button variant="outline" size="sm" onClick={() => onDownload(file)}>
                  <Download className="h-4 w-4 mr-2" />
                  Download to open
                </Button>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:px-5 sm:py-4">
          {previewUrl && (previewKind === "pdf" || previewKind === "image") && (
            <Button type="button" variant="outline" className="h-9 w-full sm:w-auto" onClick={openInNewTab}>
              <ExternalLink className="mr-2 h-4 w-4" />
              Open in new tab
            </Button>
          )}
          {file && (
            <Button type="button" variant="outline" className="h-9 w-full sm:w-auto" onClick={() => onDownload(file)}>
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          )}
          <Button type="button" className="h-9 w-full sm:ml-auto sm:w-auto" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

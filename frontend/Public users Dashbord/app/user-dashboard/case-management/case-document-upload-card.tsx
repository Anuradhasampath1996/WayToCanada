"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload, Camera, Eye, Loader2, CheckCircle2, FileText, XCircle,
  CreditCard, Shield, HeartPulse, Wallet, Briefcase, GraduationCap,
  BookOpen, Users, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { CLIENT_API, clientStreamHeaders } from "@/lib/client-api";
import { renderImageThumbnail } from "@/lib/image-thumbnail";
import { renderPdfThumbnail } from "@/lib/pdf-thumbnail";
import { PREVIEW_HEIGHT, PREVIEW_WIDTH } from "@/lib/preview-constants";

export interface CaseDocumentSubmission {
  id: number;
  document_type: string;
  document_label: string;
  original_filename: string;
  mime_type: string | null;
  status: string;
  rejection_comment: string | null;
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  identity: CreditCard,
  background: Shield,
  medical: HeartPulse,
  financial: Wallet,
  work: Briefcase,
  eligibility: GraduationCap,
  application: FileText,
  study: BookOpen,
  sponsor: Users,
  relationship: Users,
};

function docIcon(category: string): LucideIcon {
  return CATEGORY_ICONS[category] ?? FileText;
}

function inferPreviewType(mime: string | null, filename: string): "image" | "pdf" | "other" {
  if (mime?.startsWith("image/")) return "image";
  if (mime === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) return "pdf";
  if (/\.(jpe?g|png|webp|gif)$/i.test(filename)) return "image";
  return "other";
}

function validateUploadFile(file: File): string | null {
  const max = 20 * 1024 * 1024;
  if (file.size > max) return "File is too large. Maximum size is 20 MB.";
  const allowed =
    ["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type) ||
    /\.(jpe?g|png|webp|pdf)$/i.test(file.name);
  if (!allowed) return "Please upload a JPG, PNG, WEBP, or PDF file.";
  return null;
}

function aggregateStatus(submissions: CaseDocumentSubmission[]): string | null {
  if (!submissions.length) return null;
  if (submissions.some((s) => s.status === "consultant_rejected")) return "consultant_rejected";
  if (submissions.some((s) => s.status === "pending_review" || s.status === "pending")) {
    return "pending_review";
  }
  if (submissions.every((s) => s.status === "consultant_approved")) return "consultant_approved";
  return submissions[0].status;
}

function UploadedFilePreview<T extends CaseDocumentSubmission>({
  submission,
  onView,
}: {
  submission: T;
  onView: (submission: T) => void;
}) {
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<"image" | "pdf" | "other">("other");

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      setLoadingPreview(true);
      try {
        const res = await fetch(
          `${CLIENT_API}/client/documents/${submission.id}/stream`,
          { headers: clientStreamHeaders() },
        );
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;

        const type = inferPreviewType(submission.mime_type, submission.original_filename);

        if (type === "image") {
          const thumb = await renderImageThumbnail(blob, PREVIEW_WIDTH, PREVIEW_HEIGHT);
          if (cancelled) return;
          if (thumb) {
            setPreviewUrl(thumb);
          } else {
            objectUrl = URL.createObjectURL(blob);
            setPreviewUrl(objectUrl);
          }
          setPreviewType("image");
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
  }, [submission]);

  const isRejected = submission.status === "consultant_rejected";
  const isApproved = submission.status === "consultant_approved";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-white",
        isRejected && "border-red-300",
        isApproved && "border-green-300",
      )}
    >
      <div
        className="relative h-32 w-full cursor-pointer"
        onClick={() => onView(submission)}
      >
        {loadingPreview ? (
          <div className="flex h-full items-center justify-center text-primary">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : previewUrl && previewType === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={submission.original_filename}
            className="block h-full w-full object-cover"
          />
        ) : previewType === "pdf" ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 bg-red-50/50">
            <FileText className="h-10 w-10 text-red-400" />
            <span className="text-[10px] font-medium text-red-500">PDF</span>
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-1 px-2 text-center">
            <FileText className="h-8 w-8 text-muted-foreground/50" />
            <span className="line-clamp-2 text-[10px] text-muted-foreground">
              {submission.original_filename}
            </span>
          </div>
        )}
      </div>

      <button
        type="button"
        className="absolute right-1.5 top-1.5 z-10 flex items-center gap-0.5 rounded-full border border-green-300 bg-white/90 px-2 py-1 text-[10px] font-medium text-green-700 shadow backdrop-blur-sm hover:bg-white"
        onClick={(e) => {
          e.stopPropagation();
          onView(submission);
        }}
      >
        <Eye className="h-3 w-3" />
        View
      </button>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-1.5 pt-6">
        <p className="truncate text-[10px] font-medium text-white">
          {submission.original_filename}
        </p>
      </div>

      <div
        className={cn(
          "absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white shadow",
          isApproved ? "bg-green-600/90" : isRejected ? "bg-red-600/90" : "bg-amber-600/90",
        )}
      >
        <CheckCircle2 className="h-2.5 w-2.5" />
        {isApproved ? "Approved" : isRejected ? "Rejected" : "Uploaded"}
      </div>
    </div>
  );
}

export function CaseDocumentUploadCard<T extends CaseDocumentSubmission>({
  docId,
  label,
  category,
  description,
  submissions = [],
  statusBadge,
  allowsMultiple = true,
  onUpload,
  onViewDocument,
  onReload,
}: {
  docId: string;
  label: string;
  category: string;
  description?: string;
  submissions?: T[];
  statusBadge?: React.ReactNode;
  allowsMultiple?: boolean;
  onUpload: (
    docType: string,
    docLabel: string,
    file: File,
    options?: { silent?: boolean; skipReload?: boolean },
  ) => Promise<boolean>;
  onViewDocument: (submission: T) => void;
  onReload?: () => Promise<void>;
}) {
  const Icon = docIcon(category);
  const isMobile = useIsMobile();
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  const showUploadToast = (msg: string) => {
    setUploadSuccess(msg);
    setTimeout(() => setUploadSuccess(null), 3500);
  };

  const aggregate = aggregateStatus(submissions);
  const isApproved = aggregate === "consultant_approved" && !allowsMultiple;
  const isRejected = aggregate === "consultant_rejected";
  const hasFiles = submissions.length > 0;
  const rejectionNotes = submissions
    .filter((s) => s.status === "consultant_rejected" && s.rejection_comment)
    .map((s) => s.rejection_comment as string);

  const openFilePicker = () => inputRef.current?.click();
  const openCamera = () => cameraRef.current?.click();

  const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (!files.length) return;

    for (const file of files) {
      const err = validateUploadFile(file);
      if (err) {
        setUploadError(err);
        return;
      }
    }

    setUploadError(null);
    setUploading(true);

    let successCount = 0;
    let failCount = 0;
    const batch = files.length > 1;

    for (let i = 0; i < files.length; i++) {
      setUploadProgress({ current: i + 1, total: files.length });
      const ok = await onUpload(docId, label, files[i], batch ? { silent: true, skipReload: true } : undefined);
      if (ok) successCount++;
      else failCount++;
    }

    if (batch && successCount > 0) {
      await onReload?.();
    }

    setUploading(false);
    setUploadProgress(null);

    if (successCount > 0 && failCount === 0) {
      showUploadToast(
        files.length === 1
          ? "Document uploaded successfully."
          : `${successCount} file${successCount === 1 ? "" : "s"} uploaded successfully.`,
      );
    } else if (failCount > 0 && successCount === 0) {
      setUploadError("Upload failed. Please try again.");
    } else if (failCount > 0) {
      setUploadError(`${failCount} of ${files.length} file(s) failed to upload.`);
    }
  }, [docId, label, onUpload, onReload]);

  const canAddMore = allowsMultiple ? !isApproved : !hasFiles;
  const uploadLabel = allowsMultiple
    ? hasFiles
      ? "Add more files"
      : "Choose files"
    : isRejected
      ? "Upload corrected file"
      : hasFiles
        ? "Replace file"
        : "Choose file";

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 space-y-3",
        aggregate === "consultant_approved" && "border-green-200 bg-green-50/20",
        isRejected && "border-red-200 bg-red-50/20",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{label}</p>
            <p className="text-xs text-muted-foreground truncate">
              {description ?? category.replace(/_/g, " ")}
              {allowsMultiple && !hasFiles ? " · multiple files allowed" : ""}
            </p>
          </div>
        </div>
        {statusBadge}
      </div>

      {rejectionNotes.length > 0 && (
        <div className="space-y-1.5">
          {rejectionNotes.map((note, i) => (
            <div key={i} className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
              <XCircle className="mr-1 inline h-3 w-3" />
              <strong>Consultant note:</strong> {note}
            </div>
          ))}
        </div>
      )}

      {hasFiles && (
        <div
          className={cn(
            "grid gap-2",
            submissions.length > 1 ? "grid-cols-2" : "grid-cols-1",
          )}
        >
          {submissions.map((submission) => (
            <UploadedFilePreview
              key={submission.id}
              submission={submission}
              onView={onViewDocument}
            />
          ))}
        </div>
      )}

      <div
        className={cn(
          "relative rounded-lg border-2 border-dashed transition-colors",
          uploading
            ? "border-primary/40 bg-primary/5"
            : !hasFiles
              ? "border-border hover:border-primary/50 hover:bg-muted/30 cursor-pointer"
              : "border-border bg-muted/20",
        )}
        onClick={() => {
          if (uploading || !canAddMore) return;
          if (isMobile && !hasFiles) return;
          if (!hasFiles) openFilePicker();
        }}
      >
        {uploading ? (
          <div className="flex flex-col items-center justify-center gap-1 p-6 text-sm text-primary">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>
              {uploadProgress
                ? `Uploading ${uploadProgress.current} of ${uploadProgress.total}…`
                : "Uploading…"}
            </span>
          </div>
        ) : !hasFiles ? (
          <div className="space-y-3 p-5 text-center">
            <Upload className="mx-auto h-7 w-7 text-muted-foreground/40" />
            {isMobile ? (
              <>
                <p className="text-xs font-medium text-muted-foreground">Upload your document</p>
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="h-10 w-full"
                    onClick={(e) => { e.stopPropagation(); openCamera(); }}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Take photo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 w-full"
                    onClick={(e) => { e.stopPropagation(); openFilePicker(); }}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {allowsMultiple ? "Choose files" : "Choose file or PDF"}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground/60">
                  JPG, PNG, WEBP, or PDF — up to 20 MB
                  {allowsMultiple ? " · select multiple" : ""}
                </p>
              </>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  {allowsMultiple ? "Click to choose files" : "Click to upload"}
                </p>
                <p className="text-[11px] text-muted-foreground/60">
                  PDF, JPG, PNG, WEBP — up to 20 MB
                  {allowsMultiple ? " · you can select multiple files at once" : ""}
                </p>
              </div>
            )}
          </div>
        ) : canAddMore ? (
          <div className="flex items-center justify-center gap-2 p-4 text-xs text-muted-foreground">
            <Upload className="h-4 w-4" />
            <span>Drop more files here or use the button below</span>
          </div>
        ) : null}

        <input
          ref={inputRef}
          type="file"
          multiple={allowsMultiple}
          accept=".pdf,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => {
            const list = e.target.files;
            if (list?.length) void handleFiles(list);
            e.target.value = "";
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFiles([f]);
            e.target.value = "";
          }}
        />
      </div>

      {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
      {uploadSuccess && <p className="text-xs text-green-600">{uploadSuccess}</p>}

      {canAddMore && (hasFiles || isMobile) && !uploading && (
        <Button
          type="button"
          variant={isRejected ? "default" : "outline"}
          size="sm"
          className="h-8 w-full text-xs"
          onClick={openFilePicker}
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          {uploadLabel}
        </Button>
      )}

      {hasFiles && allowsMultiple && (
        <p className="text-center text-[11px] text-muted-foreground">
          {submissions.length} file{submissions.length === 1 ? "" : "s"} uploaded
        </p>
      )}
    </div>
  );
}

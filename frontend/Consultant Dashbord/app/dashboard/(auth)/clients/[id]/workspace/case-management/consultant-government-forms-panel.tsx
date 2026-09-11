"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  Eye,
  FileCheck,
  Loader2,
  MessageSquareWarning,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { PdfViewerDialog } from "@/components/pdf-viewer-dialog";
import { GovernmentFormFilledPreviewDialog } from "@/components/government-form-filled-preview-dialog";
import {
  downloadGovernmentFormPdf,
  fetchGovernmentForms,
  generateGovernmentForm,
  governmentFormsDownloadUrl,
  governmentFormsTemplatePreviewUrl,
  markGovernmentFormReviewed,
  pdfAuthHeaders,
  requestAllUnansweredGovernmentFormFields,
  reviewApplicationInfo,
  type GovernmentFormItem,
  type GovernmentFormsIndexResponse,
  type PathwayFormReference,
} from "@/lib/government-forms-api";
import {
  formatGeneratedDate,
  GENERATION_STATUS_LABELS,
  mapRedirectHint,
  resolveGenerationDisplayStatus,
  type GenerationDisplayStatus,
} from "@/lib/government-forms-ui";
import {
  GovernmentFormsGapAnalysis,
  GovernmentFormsJourney,
  FormFillQuestionsDialog,
} from "@/components/government-forms-workflow-ui";

const ADOBE_NOTE =
  "Open this official form in Adobe Acrobat Reader to review and complete any required signature or final form actions. Browser PDF viewers are not sufficient for official validation.";

function StatusBadge({ status }: { status: GenerationDisplayStatus | "not_ready" | "ready" }) {
  const styles: Record<string, string> = {
    ready: "bg-green-50 text-green-800 border-green-200",
    not_ready: "bg-amber-50 text-amber-800 border-amber-200",
    generating: "bg-blue-50 text-blue-800 border-blue-200",
    generated: "bg-slate-50 text-slate-800 border-slate-200",
    needs_review: "bg-amber-50 text-amber-800 border-amber-200",
    reviewed: "bg-green-50 text-green-800 border-green-200",
    superseded: "bg-muted text-muted-foreground border-border",
    stale: "bg-orange-50 text-orange-800 border-orange-200",
    error: "bg-red-50 text-red-800 border-red-200",
  };
  const label =
    status === "not_ready"
      ? "Not Ready"
      : status === "ready"
        ? "Ready to Generate"
        : GENERATION_STATUS_LABELS[status as GenerationDisplayStatus] ?? status;

  return (
    <Badge variant="outline" className={cn("text-[10px] font-medium", styles[status] ?? "")}>
      {label}
    </Badge>
  );
}

function MissingInformationDialog({
  open,
  onOpenChange,
  form,
  profileId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: GovernmentFormItem | null;
  profileId: string;
}) {
  const missing = form?.readiness.missing_fields ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Missing Information</DialogTitle>
          <DialogDescription>
            {form?.form_code} — complete the items below before generating this official form.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-3 text-sm" role="list">
          {missing.map((field) => {
            const href = mapRedirectHint(profileId, field.redirect_hint);
            return (
              <li key={field.key} className="flex flex-col gap-1 rounded-lg border px-3 py-2">
                <span className="font-medium">{field.label}</span>
                <span className="text-xs text-muted-foreground">
                  {field.responsible_party === "consultant" ? "Consultant" : "Client"} ·{" "}
                  {field.source_section.replace(/_/g, " ")}
                </span>
                {href && (
                  <Link
                    href={href}
                    className="text-xs text-primary inline-flex items-center gap-1 hover:underline mt-1"
                    onClick={() => onOpenChange(false)}
                  >
                    Update {field.responsible_party === "consultant" ? "Profile" : "Client Information"}
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function GovernmentFormCard({
  form,
  profileId,
  reviewed,
  applicationStale,
  fieldRemarks,
  onRefresh,
  onToast,
}: {
  form: GovernmentFormItem;
  profileId: string;
  reviewed: boolean;
  applicationStale: boolean;
  fieldRemarks: Record<string, import("@/lib/government-forms-api").FieldRemark>;
  onRefresh: () => Promise<void>;
  onToast: (msg: string, type?: "success" | "error") => void;
}) {
  const [generating, setGenerating] = React.useState(false);
  const [markingReviewed, setMarkingReviewed] = React.useState(false);
  const [missingOpen, setMissingOpen] = React.useState(false);
  const [questionsOpen, setQuestionsOpen] = React.useState(false);
  const [genError, setGenError] = React.useState<string | null>(null);
  const [pdfPreview, setPdfPreview] = React.useState<
    | { mode: "blank"; title: string; streamUrl: string }
    | { mode: "filled"; title: string; streamUrl: string; formCode: string }
    | null
  >(null);

  const gen = form.current_generation;
  const displayStatus = reviewed
    ? resolveGenerationDisplayStatus(gen, generating, Boolean(genError))
    : null;

  const canGenerate = reviewed && form.readiness.ready && !generating && !gen;
  const canRegenerate = reviewed && form.readiness.ready && !generating && Boolean(gen);

  async function handleGenerate() {
    if (generating) return;
    if (!form.readiness.ready) {
      setMissingOpen(true);
      return;
    }
    setGenerating(true);
    setGenError(null);
    try {
      await generateGovernmentForm(profileId, form.form_code);
      onToast(`${form.form_code} generated successfully.`);
      await onRefresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Generation failed.";
      setGenError(msg);
      onToast(msg, "error");
    } finally {
      setGenerating(false);
    }
  }

  async function handleMarkReviewed() {
    if (!gen) return;
    setMarkingReviewed(true);
    try {
      await markGovernmentFormReviewed(profileId, gen.id);
      onToast("Form marked as reviewed.");
      await onRefresh();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Could not mark reviewed.", "error");
    } finally {
      setMarkingReviewed(false);
    }
  }

  async function handleDownload() {
    if (!gen) return;
    try {
      await downloadGovernmentFormPdf(
        profileId,
        gen.id,
        `${form.form_code}-${form.version_label}.pdf`,
      );
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Download failed.", "error");
    }
  }

  function handlePreviewBlank() {
    setPdfPreview({
      mode: "blank",
      title: `${form.form_code} — Official blank template`,
      streamUrl: governmentFormsTemplatePreviewUrl(profileId, form.form_code, false),
    });
  }

  function handlePreviewFilled() {
    if (!gen) return;
    setPdfPreview({
      mode: "filled",
      title: `${form.form_code} — Auto-filled preview`,
      streamUrl: governmentFormsDownloadUrl(profileId, gen.id, false, { flattened: true }),
      formCode: form.form_code,
    });
  }

  const fillCoverage = form.fill_coverage;
  const unansweredLeft = fillCoverage?.unanswered_fields?.length ?? 0;

  return (
    <div className="rounded-2xl border overflow-hidden shadow-sm">
      <div className="px-4 py-4 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <FileCheck className="h-4 w-4 text-primary shrink-0" aria-hidden />
              <h3 className="font-semibold text-sm">{form.form_code}</h3>
              <Badge variant="secondary" className="text-[10px]">
                v{form.version_label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{form.name}</p>
            <div className="mt-2 space-y-1.5 max-w-sm">
              <div className="flex items-center gap-2">
                <Progress value={form.readiness.percentage} className="h-1.5 flex-1" />
                <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
                  Generate ready {form.readiness.percentage}%
                </span>
              </div>
              {fillCoverage && (
                <div className="flex items-center gap-2">
                  <Progress value={fillCoverage.percentage} className="h-1.5 flex-1" />
                  <span className="text-[10px] text-muted-foreground tabular-nums whitespace-nowrap">
                    Form fill {fillCoverage.mapped_filled}/{fillCoverage.mapped_total} (
                    {fillCoverage.percentage}%)
                  </span>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2">
            <div className="text-right">
              <span className="text-2xl font-bold tabular-nums">
                {fillCoverage?.percentage ?? form.readiness.percentage}%
              </span>
              <span className="block text-xs text-muted-foreground">
                {fillCoverage ? "Form fill" : "Readiness"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="h-8 gap-1.5"
                onClick={() => setQuestionsOpen(true)}
                aria-label={`Review remaining questions for ${form.form_code}`}
              >
                <MessageSquareWarning className="h-3.5 w-3.5" />
                {unansweredLeft > 0
                  ? `Remaining questions (${unansweredLeft})`
                  : "Review questions (complete)"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5"
                onClick={handlePreviewBlank}
                aria-label={`Preview blank ${form.form_code} form`}
              >
                <Eye className="h-3.5 w-3.5" />
                Preview blank
              </Button>
              {gen && (
                <Button
                  size="sm"
                  variant="default"
                  className="h-8 gap-1.5"
                  onClick={handlePreviewFilled}
                  aria-label={`Preview filled ${form.form_code} form`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  Preview filled
                </Button>
              )}
            </div>
          </div>
        </div>

        {!reviewed ? (
          <p className="text-sm text-muted-foreground">
            Review application information to unlock readiness and generation.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={form.readiness.ready ? "ready" : "not_ready"} />
              {displayStatus && displayStatus !== "ready" && (
                <StatusBadge status={displayStatus} />
              )}
            </div>

            {!form.readiness.ready && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-sm text-amber-900">
                {form.readiness.missing_fields.length} required item
                {form.readiness.missing_fields.length === 1 ? "" : "s"} missing before generation.
              </div>
            )}

            {form.readiness.ready && fillCoverage && fillCoverage.percentage < 100 && (
              <div className="rounded-lg border border-sky-200 bg-sky-50/70 px-3 py-2.5 text-sm text-sky-950 space-y-2">
                <p>
                  Generate-ready is 100%, but{" "}
                  <strong>{unansweredLeft}</strong> mapped form question
                  {unansweredLeft === 1 ? "" : "s"} still need answers. Empty fields stay blank on
                  the PDF.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 border-sky-300 bg-white"
                  onClick={() => setQuestionsOpen(true)}
                >
                  <MessageSquareWarning className="h-3.5 w-3.5" />
                  Open remaining questions
                </Button>
              </div>
            )}

            {form.readiness.ready && fillCoverage && (
              <div className="rounded-lg border border-muted px-3 py-2.5 text-xs text-muted-foreground space-y-1.5">
                <p>
                  <span className="font-medium text-foreground">How autofill works:</span> we pull
                  what we already have from the client questionnaire + your consultant profile. If a
                  mapped field is missing, open <strong>Remaining questions</strong> — answer it
                  here, or request it from the client — then regenerate.
                </p>
                <p>
                  Form fill {fillCoverage.mapped_filled}/{fillCoverage.mapped_total} is only the{" "}
                  <strong>mapped</strong> autofill set (not every IRCC box). Signatures, cancel
                  sections, fax, and some office/application fields stay for Adobe Acrobat after
                  download.
                </p>
              </div>
            )}

            {(form.readiness.overflow_warnings?.length ?? 0) > 0 && (
              <div
                className="rounded-lg border border-red-200 bg-red-50/60 px-3 py-2 text-sm text-red-900 space-y-1"
                role="alert"
              >
                <p className="font-medium">IMM 5406 capacity exceeded</p>
                {form.readiness.overflow_warnings?.map((warning) => (
                  <p key={warning.section}>{warning.message}</p>
                ))}
              </div>
            )}

            {(applicationStale || gen?.is_stale) && (
              <div
                className="rounded-lg border border-orange-200 bg-orange-50/60 px-3 py-2 text-sm text-orange-900 flex gap-2"
                role="alert"
              >
                <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
                <span>
                  Client or application information has changed since
                  {gen ? " this form was generated" : " review"}. Review updated information and
                  regenerate the form.
                </span>
              </div>
            )}

            {genError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 flex gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                {genError}
              </div>
            )}

            {gen && (
              <div className="rounded-lg border bg-muted/20 px-3 py-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Latest generation
                </p>
                <p className="text-sm">
                  Generated {formatGeneratedDate(gen.generated_at)}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button size="sm" variant="default" onClick={handlePreviewFilled} aria-label="Preview generated form">
                    <Eye className="h-3.5 w-3.5 mr-1.5" />
                    Preview
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleDownload} aria-label="Download generated form">
                    <Download className="h-3.5 w-3.5 mr-1.5" />
                    Download
                  </Button>
                  {(gen.review_status === "needs_review" || gen.generation_status === "GENERATED") && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={markingReviewed}
                      onClick={handleMarkReviewed}
                      aria-label="Mark form reviewed"
                    >
                      {markingReviewed ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Mark Reviewed
                    </Button>
                  )}
                  {canRegenerate && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={generating}
                      onClick={handleGenerate}
                      aria-label="Regenerate form"
                    >
                      {generating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Regenerate
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground pt-1">{ADOBE_NOTE}</p>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {!form.readiness.ready && (
                <Button size="sm" variant="outline" onClick={() => setMissingOpen(true)}>
                  View Missing Information
                </Button>
              )}
              {canGenerate && (
                <Button size="sm" disabled={generating} onClick={handleGenerate} aria-label="Generate form">
                  {generating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Generating…
                    </>
                  ) : (
                    "Generate Form"
                  )}
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      <MissingInformationDialog
        open={missingOpen}
        onOpenChange={setMissingOpen}
        form={form}
        profileId={profileId}
      />

      <FormFillQuestionsDialog
        open={questionsOpen}
        onOpenChange={setQuestionsOpen}
        form={form}
        profileId={profileId}
        fieldRemarks={fieldRemarks}
        onToast={onToast}
        onRefresh={onRefresh}
      />

      {pdfPreview?.mode === "blank" && (
        <PdfViewerDialog
          open
          onOpenChange={(open) => {
            if (!open) setPdfPreview(null);
          }}
          title={pdfPreview.title}
          streamUrl={pdfPreview.streamUrl}
          getAuthHeaders={() => pdfAuthHeaders()}
        />
      )}

      {pdfPreview?.mode === "filled" && (
        <GovernmentFormFilledPreviewDialog
          open
          onOpenChange={(open) => {
            if (!open) setPdfPreview(null);
          }}
          title={pdfPreview.title}
          formCode={pdfPreview.formCode}
          profileId={profileId}
          streamUrl={pdfPreview.streamUrl}
          getAuthHeaders={() => pdfAuthHeaders()}
        />
      )}
    </div>
  );
}

export function ConsultantGovernmentFormsPanel({
  profileId,
  onToast,
  onDataChange,
}: {
  profileId: string;
  onToast?: (msg: string, type?: "success" | "error") => void;
  onDataChange?: () => void;
}) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<GovernmentFormsIndexResponse | null>(null);
  const [reviewing, setReviewing] = React.useState(false);
  const [requestingAll, setRequestingAll] = React.useState(false);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const json = await fetchGovernmentForms(profileId);
      setData(json);
      onDataChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load government forms.");
    } finally {
      setLoading(false);
    }
  }, [profileId, onDataChange]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const toast = (msg: string, type: "success" | "error" = "success") => {
    onToast?.(msg, type);
  };

  const totalRequestable = React.useMemo(() => {
    if (!data) return 0;
    const keys = new Set<string>();
    for (const form of data.forms) {
      for (const field of form.fill_coverage?.unanswered_fields ?? []) {
        if (field.can_request && field.questionnaire_key) {
          keys.add(field.questionnaire_key);
        }
      }
    }
    return keys.size;
  }, [data]);

  const manualForms = React.useMemo(
    () => (data?.pathway_forms ?? []).filter((f: PathwayFormReference) => !f.fillable),
    [data],
  );

  async function handleReviewApplicationInfo() {
    setReviewing(true);
    try {
      await reviewApplicationInfo(profileId);
      toast("Application information reviewed.");
      setLoading(true);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Review failed.", "error");
    } finally {
      setReviewing(false);
    }
  }

  async function handleRequestAllRemaining() {
    if (totalRequestable === 0) return;
    setRequestingAll(true);
    try {
      const json = await requestAllUnansweredGovernmentFormFields(profileId);
      toast(json.message);
      setData((prev) =>
        prev
          ? {
              ...prev,
              field_remarks: json.field_remarks,
              pathway_forms: json.pathway_forms ?? prev.pathway_forms,
              forms: prev.forms.map((form) => {
                const updated = json.forms.find((f) => f.form_code === form.form_code);
                return updated ? { ...form, fill_coverage: updated.fill_coverage } : form;
              }),
            }
          : prev,
      );
      onDataChange?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Request failed.", "error");
    } finally {
      setRequestingAll(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 justify-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading government forms…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center space-y-3">
        <AlertCircle className="h-8 w-8 mx-auto text-red-600" aria-hidden />
        <p className="text-sm text-red-800">{error}</p>
        <Button size="sm" variant="outline" onClick={() => { setLoading(true); void load(); }}>
          Retry
        </Button>
      </div>
    );
  }

  if (!data || (data.forms.length === 0 && (data.pathway_forms?.length ?? 0) === 0)) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        <FileCheck className="h-8 w-8 mx-auto mb-2 opacity-40" aria-hidden />
        <p>No government forms are available for this case yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <GovernmentFormsJourney
        data={data}
        onReReview={data.application_info_stale ? handleReviewApplicationInfo : undefined}
        reReviewing={reviewing}
      />

      {data.application_info_reviewed && totalRequestable > 0 && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50/60 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-sky-950">
              {totalRequestable} remaining question{totalRequestable === 1 ? "" : "s"} across pathway forms
            </p>
            <p className="text-xs text-sky-900/80 mt-0.5">
              Request missing autofill answers from the client in one batch (deduped across forms).
            </p>
          </div>
          <Button
            size="sm"
            className="shrink-0 gap-1.5"
            disabled={requestingAll}
            onClick={() => void handleRequestAllRemaining()}
          >
            {requestingAll ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <MessageSquareWarning className="h-3.5 w-3.5" />
            )}
            Request all remaining from client
          </Button>
        </div>
      )}

      {manualForms.length > 0 && (
        <div className="rounded-2xl border border-dashed px-4 py-3 space-y-2">
          <p className="text-sm font-semibold">Pathway forms — manual for now</p>
          <p className="text-xs text-muted-foreground">
            These appear on the client&apos;s pathway/package but do not have PDF autofill mappings yet.
            Complete them in Adobe or when mappings are added.
          </p>
          <ul className="space-y-1.5">
            {manualForms.map((form) => (
              <li
                key={form.normalized || form.code}
                className="flex items-center justify-between gap-2 text-sm rounded-lg border bg-muted/20 px-3 py-2"
              >
                <span className="min-w-0">
                  <span className="font-medium">{form.code}</span>
                  <span className="text-muted-foreground"> — {form.name}</span>
                </span>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  Manual / mapping later
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!data.application_info_reviewed ? (
        <div className="rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50/40 p-6 space-y-4 dark:bg-violet-950/20">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-900/50">
              <FileCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold">Step 1 — Review application information</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Lock a snapshot of the client questionnaire before auto-filling official IRCC forms.
              </p>
            </div>
          </div>
          <Button disabled={reviewing} onClick={handleReviewApplicationInfo} aria-label="Review application information">
            {reviewing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Reviewing…
              </>
            ) : (
              "Review Application Information"
            )}
          </Button>
        </div>
      ) : (
        <div className="rounded-2xl border border-green-200/80 bg-green-50/50 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm dark:bg-green-950/20">
          <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            <span>
              Application information reviewed
              {data.reviewed_at ? ` · ${formatGeneratedDate(data.reviewed_at)}` : ""}
            </span>
          </div>
          {data.application_info_stale && (
            <Badge variant="outline" className="bg-orange-50 text-orange-800 border-orange-200 text-[10px]">
              Review may be outdated — re-review recommended
            </Badge>
          )}
        </div>
      )}

      <GovernmentFormsGapAnalysis
        forms={data.forms}
        profileId={profileId}
        reviewed={data.application_info_reviewed}
        fieldRemarks={data.field_remarks ?? {}}
        onToast={toast}
        onRefresh={load}
      />

      <div className="space-y-4">
        <p className="text-sm font-semibold">Official forms (autofill)</p>
        {data.forms.length === 0 ? (
          <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-4 py-3 text-sm text-amber-950 space-y-1">
            <p className="font-medium">No active autofill forms available yet</p>
            <p className="text-xs text-amber-900/90">
              {Array.isArray(data.pathway_forms) && data.pathway_forms.length > 0
                ? "This pathway’s official form templates are not loaded yet. They should appear after the next deploy — refresh this page once the update finishes."
                : "This pathway does not have autofill-mapped official forms configured yet. You can still use Application Forms / interactive packages."}
            </p>
            {Array.isArray(data.pathway_forms) && data.pathway_forms.length > 0 && (
              <p className="text-[11px] text-muted-foreground pt-1">
                Mapped codes: {data.pathway_forms.map((f) => f.code).join(", ")}
              </p>
            )}
          </div>
        ) : (
          data.forms.map((form) => (
            <GovernmentFormCard
              key={form.form_code}
              form={form}
              profileId={profileId}
              reviewed={data.application_info_reviewed}
              applicationStale={data.application_info_stale}
              fieldRemarks={data.field_remarks ?? {}}
              onRefresh={load}
              onToast={toast}
            />
          ))
        )}
      </div>
    </div>
  );
}

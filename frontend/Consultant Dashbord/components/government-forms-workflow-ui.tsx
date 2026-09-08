"use client";

import * as React from "react";
import {
  Bot,
  CheckCircle2,
  Circle,
  CircleDot,
  Loader2,
  Mail,
  Pencil,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type {
  FieldRemark,
  GovernmentFormItem,
  GovernmentFormMissingField,
} from "@/lib/government-forms-api";
import {
  fillGovernmentFormGapField,
  requestQuestionnaireRefill,
  requestUnansweredGovernmentFormFields,
  type GovernmentFormFillCoverage,
} from "@/lib/government-forms-api";
import {
  aggregateReadiness,
  canFillGapField,
  canRequestFromClient,
  computeWorkflowSteps,
  gapFieldFillSpec,
  groupMissingFields,
  mapCanonicalToQuestionnaireField,
  type WorkflowStep,
  type WorkflowStepStatus,
} from "@/lib/government-forms-workflow";
import type { GovernmentFormsIndexResponse } from "@/lib/government-forms-api";

function stepIcon(status: WorkflowStepStatus) {
  if (status === "complete") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
  if (status === "active") return <CircleDot className="h-4 w-4 text-primary" />;
  if (status === "blocked") return <Circle className="h-4 w-4 text-muted-foreground/50" />;
  return <Circle className="h-4 w-4 text-muted-foreground" />;
}

export function GovernmentFormsJourney({
  data,
  onReReview,
  reReviewing,
}: {
  data: GovernmentFormsIndexResponse;
  onReReview?: () => void;
  reReviewing?: boolean;
}) {
  const steps = computeWorkflowSteps(data);
  const agg = aggregateReadiness(data.forms);

  return (
    <div className="rounded-2xl border bg-gradient-to-br from-violet-50/50 via-card to-card px-4 py-4 space-y-4 dark:from-violet-950/20">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-sm">Government Forms Journey</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {agg.formCount} official form{agg.formCount === 1 ? "" : "s"} ·{" "}
            {agg.averagePercentage}% average auto-fill readiness
          </p>
        </div>
        <div className="flex items-center gap-2 min-w-[140px]">
          <Progress value={agg.averagePercentage} className="h-2 flex-1" />
          <span className="text-sm font-semibold tabular-nums">{agg.averagePercentage}%</span>
        </div>
      </div>

      <ol className="grid gap-2 sm:grid-cols-5" aria-label="Government forms workflow">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className={cn(
              "rounded-lg border px-3 py-2 text-xs space-y-1",
              step.status === "active" && "border-primary/40 bg-primary/5",
              step.status === "complete" && "border-green-200 bg-green-50/40",
            )}
          >
            <div className="flex items-center gap-1.5 font-medium">
              {stepIcon(step.status)}
              <span>
                {index + 1}. {step.title}
              </span>
            </div>
            <p className="text-muted-foreground leading-snug pl-5">{step.description}</p>
          </li>
        ))}
      </ol>

      {data.application_info_stale && data.application_info_reviewed && onReReview && (
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
          <p className="text-xs text-orange-800 flex-1">
            Client data changed since last review. Re-review before regenerating forms.
          </p>
          <Button size="sm" variant="outline" disabled={reReviewing} onClick={onReReview}>
            {reReviewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Re-review data"}
          </Button>
        </div>
      )}
    </div>
  );
}

function FillForClientDialog({
  open,
  onOpenChange,
  field,
  formCode,
  profileId,
  onSaved,
  onError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: GovernmentFormMissingField;
  formCode: string;
  profileId: string;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const spec = gapFieldFillSpec(field.key);
  const [value, setValue] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) setValue("");
  }, [open, field.key]);

  async function handleSave() {
    if (!value.trim() && spec?.inputType !== "select") {
      onError("Please enter a value.");
      return;
    }
    setSaving(true);
    try {
      await fillGovernmentFormGapField(profileId, field.key, value.trim());
      onOpenChange(false);
      onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : "Could not save field.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Fill for client</DialogTitle>
          <DialogDescription>
            {formCode} — {field.label}. This saves directly to the client questionnaire.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium">{field.label}</label>
          {spec?.inputType === "select" ? (
            <select
              className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            >
              <option value="">Select…</option>
              {(spec.options ?? []).map((opt) => (
                <option key={opt} value={opt}>
                  {opt === "yes" ? "Married / Yes" : opt === "no" ? "Single / No" : opt}
                </option>
              ))}
            </select>
          ) : (
            <Input
              type={spec?.inputType === "date" ? "date" : spec?.inputType === "email" ? "email" : "text"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`Enter ${field.label.toLowerCase()}`}
            />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RequestFromClientDialog({
  open,
  onOpenChange,
  field,
  formCode,
  profileId,
  onRequested,
  onError,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: GovernmentFormMissingField;
  formCode: string;
  profileId: string;
  onRequested: (remarks: Record<string, FieldRemark>) => void;
  onError: (msg: string) => void;
}) {
  const questionnaireKey = mapCanonicalToQuestionnaireField(field.key);
  const defaultRemark = `Required for ${formCode}: ${field.label}. Please update this in your questionnaire.`;
  const [remark, setRemark] = React.useState(defaultRemark);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) setRemark(defaultRemark);
  }, [open, field.key, defaultRemark]);

  async function handleSend() {
    if (!questionnaireKey) return;
    if (!remark.trim()) {
      onError("Please add a note for the client.");
      return;
    }
    setSaving(true);
    try {
      const json = await requestQuestionnaireRefill(profileId, questionnaireKey, remark.trim());
      onOpenChange(false);
      onRequested(json.field_remarks ?? {});
    } catch (e) {
      onError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request from client</DialogTitle>
          <DialogDescription>
            The client will see this request in their dashboard questionnaire with your note.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-sm font-medium">{field.label}</p>
          <Textarea
            rows={4}
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="Explain what the client should provide or correct…"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={saving || !questionnaireKey}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Send request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MissingFieldRow({
  field,
  formCode,
  profileId,
  fieldRemarks,
  onRequested,
  onFilled,
  onError,
}: {
  field: GovernmentFormMissingField;
  formCode: string;
  profileId: string;
  fieldRemarks: Record<string, FieldRemark>;
  onRequested: (remarks: Record<string, FieldRemark>) => void;
  onFilled: () => void;
  onError: (msg: string) => void;
}) {
  const [fillOpen, setFillOpen] = React.useState(false);
  const [requestOpen, setRequestOpen] = React.useState(false);

  const questionnaireKey = mapCanonicalToQuestionnaireField(field.key);
  const pendingRemark = questionnaireKey ? fieldRemarks[questionnaireKey] : undefined;
  const requestSent = pendingRemark?.status === "pending";
  const fillable = canFillGapField(field);
  const requestable = canRequestFromClient(field);

  return (
    <>
      <li className="flex flex-col gap-2 rounded-lg border px-3 py-2 text-sm">
        <div className="flex items-start gap-2">
          {field.responsible_party === "client" ? (
            <User className="h-3.5 w-3.5 mt-0.5 text-blue-600 shrink-0" />
          ) : (
            <Bot className="h-3.5 w-3.5 mt-0.5 text-violet-600 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{field.label}</span>
              {requestSent && (
                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200">
                  Requested from client
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {field.responsible_party === "consultant" ? "Consultant" : "Client"} ·{" "}
              {field.source_section.replace(/_/g, " ")}
            </p>
            {requestSent && pendingRemark?.remark && (
              <p className="text-xs text-amber-800 mt-1 line-clamp-2">{pendingRemark.remark}</p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pl-5">
          {fillable && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setFillOpen(true)}
            >
              <Pencil className="h-3 w-3 mr-1" />
              Fill for client
            </Button>
          )}
          {requestable && (
            <Button
              size="sm"
              variant={requestSent ? "outline" : "secondary"}
              className="h-7 text-xs"
              onClick={() => setRequestOpen(true)}
            >
              <Mail className="h-3 w-3 mr-1" />
              {requestSent ? "Request again" : "Request from client"}
            </Button>
          )}
        </div>
      </li>

      {fillable && (
        <FillForClientDialog
          open={fillOpen}
          onOpenChange={setFillOpen}
          field={field}
          formCode={formCode}
          profileId={profileId}
          onSaved={onFilled}
          onError={onError}
        />
      )}
      {requestable && (
        <RequestFromClientDialog
          open={requestOpen}
          onOpenChange={setRequestOpen}
          field={field}
          formCode={formCode}
          profileId={profileId}
          onRequested={onRequested}
          onError={onError}
        />
      )}
    </>
  );
}

export function GovernmentFormsGapAnalysis({
  forms,
  profileId,
  reviewed,
  fieldRemarks: initialRemarks = {},
  onToast,
  onRefresh,
}: {
  forms: GovernmentFormItem[];
  profileId: string;
  reviewed: boolean;
  fieldRemarks?: Record<string, FieldRemark>;
  onToast: (msg: string, type?: "success" | "error") => void;
  onRefresh: () => Promise<void>;
}) {
  const [fieldRemarks, setFieldRemarks] = React.useState(initialRemarks);
  const [refreshing, setRefreshing] = React.useState(false);

  React.useEffect(() => {
    setFieldRemarks(initialRemarks);
  }, [initialRemarks]);

  async function handleFilled() {
    setRefreshing(true);
    try {
      await onRefresh();
      onToast("Field saved. Gap list updated.");
    } finally {
      setRefreshing(false);
    }
  }

  function handleRequested(remarks: Record<string, FieldRemark>) {
    setFieldRemarks((prev) => ({ ...prev, ...remarks }));
    onToast("Request sent — client will see this in their questionnaire.");
  }

  if (!reviewed) return null;

  const formsWithGaps = forms.filter((f) => f.readiness.missing_fields.length > 0);
  if (formsWithGaps.length === 0) {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50/50 px-4 py-3 text-sm text-green-900 flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        Maple analysis: all required data is present. You can generate both forms at 100% auto-fill.
      </div>
    );
  }

  return (
    <div className="rounded-xl border px-4 py-4 space-y-4">
      <div className="flex items-start gap-2">
        <Bot className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div>
          <h3 className="font-semibold text-sm">Maple — Missing data analysis</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Request from the client (appears in their dashboard) or fill yourself. Saved fields drop
            off this list automatically.
          </p>
        </div>
        {refreshing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-auto" />}
      </div>

      {formsWithGaps.map((form) => {
        const groups = groupMissingFields(form.readiness.missing_fields);
        return (
          <div key={form.form_code} className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">
                {form.form_code} — {form.readiness.percentage}% ready
              </p>
              <span className="text-xs text-muted-foreground">
                {form.readiness.missing_fields.length} gap
                {form.readiness.missing_fields.length === 1 ? "" : "s"}
              </span>
            </div>

            {groups.overflow.length > 0 && (
              <ul className="space-y-2">
                {groups.overflow.map((field) => (
                  <li
                    key={field.key}
                    className="rounded-lg border border-red-200 bg-red-50/50 px-3 py-2 text-sm text-red-900"
                  >
                    {field.label}: {field.source_section}
                  </li>
                ))}
              </ul>
            )}

            {(groups.client.length > 0 || groups.consultant.length > 0) && (
              <ul className="space-y-2">
                {[...groups.client, ...groups.consultant].map((field) => (
                  <MissingFieldRow
                    key={`${form.form_code}-${field.key}`}
                    field={field}
                    formCode={form.form_code}
                    profileId={profileId}
                    fieldRemarks={fieldRemarks}
                    onRequested={handleRequested}
                    onFilled={handleFilled}
                    onError={(msg) => onToast(msg, "error")}
                  />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

type UnansweredField = GovernmentFormFillCoverage["unanswered_fields"][number];

function UnansweredQuestionRow({
  field,
  formCode,
  profileId,
  fieldRemarks,
  onSaved,
  onRequested,
  onError,
}: {
  field: UnansweredField;
  formCode: string;
  profileId: string;
  fieldRemarks: Record<string, FieldRemark>;
  onSaved: () => void;
  onRequested: (remarks: Record<string, FieldRemark>) => void;
  onError: (msg: string) => void;
}) {
  const missingField: GovernmentFormMissingField = {
    key: field.key,
    label: field.label,
    source_section: "form_fill",
    responsible_party: field.responsible_party,
    redirect_hint: null,
  };
  const spec =
    gapFieldFillSpec(field.key) ??
    (field.can_fill ? { inputType: "text" as const, fillable: true } : null);
  const [value, setValue] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [requesting, setRequesting] = React.useState(false);
  const [saveMessage, setSaveMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(
    null,
  );

  const qKey = field.questionnaire_key;
  const pending = qKey ? fieldRemarks[qKey]?.status === "pending" : false;
  const canFill = Boolean(field.can_fill) && Boolean(spec?.fillable);
  const canRequest = field.can_request && Boolean(qKey);

  async function handleSave() {
    if (!canFill) return;
    if (!value.trim() && spec?.inputType !== "select") {
      setSaveMessage({ type: "error", text: "Please enter a value." });
      onError("Please enter a value.");
      return;
    }
    setSaving(true);
    setSaveMessage(null);
    const submitted = value.trim();
    try {
      await fillGovernmentFormGapField(profileId, field.key, submitted);
      await onSaved();
      setValue("");
      setSaveMessage({ type: "success", text: "Saved." });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not save.";
      setSaveMessage({ type: "error", text: msg });
      onError(msg);
      setValue(submitted);
    } finally {
      setSaving(false);
    }
  }

  async function handleRequest() {
    if (!qKey) return;
    setRequesting(true);
    try {
      const json = await requestQuestionnaireRefill(
        profileId,
        qKey,
        `Required for ${formCode}: ${field.label}. Please update this in your questionnaire.`,
      );
      onRequested(json.field_remarks ?? {});
    } catch (e) {
      onError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <li className="rounded-lg border px-3 py-3 space-y-2 bg-background">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{field.label}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {field.responsible_party === "client" ? "Client question" : "Consultant field"}
            {pending ? " · request already sent" : ""}
          </p>
        </div>
        {pending && (
          <Badge variant="outline" className="text-[10px] shrink-0">
            Pending client
          </Badge>
        )}
      </div>

      {canFill && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-col sm:flex-row gap-2">
            {spec?.inputType === "select" ? (
              <select
                className="flex h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={value}
                onChange={(e) => {
                  setSaveMessage(null);
                  setValue(e.target.value);
                }}
              >
                <option value="">Select…</option>
                {(spec.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === "yes" ? "Married / Yes" : opt === "no" ? "Single / No" : opt}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                type={spec?.inputType === "date" ? "date" : spec?.inputType === "email" ? "email" : "text"}
                value={value}
                onChange={(e) => {
                  setSaveMessage(null);
                  setValue(e.target.value);
                }}
                placeholder={
                  field.key === "representative.address.street_number"
                    ? "e.g. 123"
                    : `Answer: ${field.label}`
                }
                className="flex-1"
              />
            )}
            <Button size="sm" className="h-9 gap-1.5 shrink-0" disabled={saving} onClick={handleSave}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
              Save answer
            </Button>
          </div>
          {saveMessage && (
            <p
              className={
                saveMessage.type === "success"
                  ? "text-xs text-green-700"
                  : "text-xs text-red-600"
              }
              role="status"
            >
              {saveMessage.text}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {canRequest && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5"
            disabled={requesting || pending}
            onClick={handleRequest}
          >
            {requesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
            {pending ? "Already requested" : "Request from client"}
          </Button>
        )}
        {!canFill && !canRequest && (
          <p className="text-xs text-muted-foreground">
            This field cannot be answered or requested here yet.
          </p>
        )}
        {canFill && !canRequest && (
          <p className="text-[11px] text-muted-foreground">
            {field.responsible_party === "consultant"
              ? "Enter the value here — it saves to your consultant profile."
              : "Enter the value here (not collected on the client questionnaire yet)."}
          </p>
        )}
      </div>
    </li>
  );
}

/** Popup: remaining autofill questions — answer in-place or request from client. */
export function FormFillQuestionsDialog({
  open,
  onOpenChange,
  form,
  profileId,
  fieldRemarks = {},
  onToast,
  onRefresh,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: GovernmentFormItem;
  profileId: string;
  fieldRemarks?: Record<string, FieldRemark>;
  onToast: (msg: string, type?: "success" | "error") => void;
  onRefresh: () => Promise<void>;
}) {
  const coverage = form.fill_coverage;
  const unanswered = coverage?.unanswered_fields ?? [];
  const left = unanswered.length;
  const [remarks, setRemarks] = React.useState(fieldRemarks);
  const [batchRequesting, setBatchRequesting] = React.useState(false);

  React.useEffect(() => {
    if (open) setRemarks(fieldRemarks);
  }, [open, fieldRemarks]);

  const requestableCount = unanswered.filter((f) => f.can_request).length;

  async function handleRefreshAfterSave() {
    try {
      await onRefresh();
      onToast("Answer saved.");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Saved, but could not refresh the list.", "error");
      throw e;
    }
  }

  async function handleRequestAll() {
    setBatchRequesting(true);
    try {
      const json = await requestUnansweredGovernmentFormFields(profileId, form.form_code);
      setRemarks((prev) => ({ ...prev, ...json.field_remarks }));
      onToast(json.message);
      await onRefresh();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Request failed.", "error");
    } finally {
      setBatchRequesting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[96vw] max-h-[90vh] flex flex-col gap-0 p-0">
        <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <DialogTitle>
            {form.form_code} — remaining questions
          </DialogTitle>
          <DialogDescription>
            {coverage
              ? `${coverage.mapped_filled} of ${coverage.mapped_total} mapped fields filled (${coverage.percentage}%). `
              : ""}
            Answer here yourself, or send a request to the client questionnaire. This is not the full
            IRCC PDF — only fields we map into the form.
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-3 border-b bg-muted/30 flex flex-wrap items-center gap-2 shrink-0">
          <Badge variant="secondary" className="tabular-nums">
            {left} remaining
          </Badge>
          {coverage && (
            <span className="text-xs text-muted-foreground">
              Form fill {coverage.mapped_filled}/{coverage.mapped_total}
            </span>
          )}
          {requestableCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 ml-auto"
              disabled={batchRequesting}
              onClick={handleRequestAll}
            >
              {batchRequesting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Mail className="h-3.5 w-3.5" />
              )}
              Request all from client ({requestableCount})
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {left === 0 ? (
            <div className="rounded-lg border border-green-200 bg-green-50/60 px-4 py-6 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto" />
              <p className="text-sm font-medium text-green-900">
                All mapped autofill fields are filled.
              </p>
              <p className="text-xs text-green-800/80">
                Regenerate the PDF to write these values. IRCC checkboxes, appointment type,
                signatures, and other unmapped sections stay blank until those mappings are added.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {unanswered.map((field) => (
                <UnansweredQuestionRow
                  key={field.key}
                  field={field}
                  formCode={form.form_code}
                  profileId={profileId}
                  fieldRemarks={remarks}
                  onSaved={handleRefreshAfterSave}
                  onRequested={(next) => {
                    setRemarks((prev) => ({ ...prev, ...next }));
                    onToast("Request sent to client.");
                  }}
                  onError={(msg) => onToast(msg, "error")}
                />
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className="px-5 py-3 border-t shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

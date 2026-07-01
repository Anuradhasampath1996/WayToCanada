"use client";

import * as React from "react";
import {
  Loader2, CheckCircle2, Clock, FormInput, Save, Send, ChevronLeft, Sparkles,
  AlertCircle, Upload, FileText, MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CLIENT_API, clientAuthHeaders, clientUploadHeaders } from "@/lib/client-api";
import { useClientJourneyOptional } from "@/context/client-journey-context";

type FormField = {
  type: string;
  key?: string;
  label: string;
  required?: boolean;
  help_text?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
};

type FormResponse = {
  id?: number;
  status: string;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  consultant_notes?: string | null;
  updated_at?: string | null;
};

type FormSummary = {
  id: number;
  slug: string;
  title: string;
  description?: string | null;
  field_count?: number;
  response?: FormResponse | null;
};

type FormDetail = {
  id: number;
  title: string;
  description?: string | null;
  form_schema: { fields: FormField[] };
  response?: FormResponse & { response_data?: Record<string, unknown> } | null;
};

function formStatusBadge(response: FormResponse | null | undefined): {
  label: string;
  variant: "default" | "outline" | "secondary";
  className?: string;
  icon: React.ReactNode;
} {
  if (!response) {
    return { label: "Not started", variant: "secondary", icon: <Clock className="h-3 w-3" /> };
  }
  if (response.reviewed_at) {
    return {
      label: "Verified",
      variant: "default",
      className: "bg-green-600",
      icon: <CheckCircle2 className="h-3 w-3" />,
    };
  }
  if (response.status === "submitted") {
    return {
      label: "Under review",
      variant: "outline",
      className: "border-amber-200 text-amber-800",
      icon: <Clock className="h-3 w-3" />,
    };
  }
  return {
    label: "Draft",
    variant: "outline",
    className: "border-blue-200 text-blue-700",
    icon: <Save className="h-3 w-3" />,
  };
}

function isEmptyValue(value: unknown, type: string): boolean {
  if (type === "checkbox") return value === null || value === undefined;
  if (type === "file") return !value || value === "";
  return value === null || value === undefined || value === "";
}

function validateForm(fields: FormField[], values: Record<string, unknown>): string[] {
  const errors: string[] = [];
  for (const field of fields) {
    if (field.type === "section" || !field.key) continue;
    if (!field.required) continue;
    const val = values[field.key];
    if (isEmptyValue(val, field.type)) {
      errors.push(`${field.label} is required.`);
    }
  }
  return errors;
}

function FieldRenderer({
  field,
  value,
  onChange,
  disabled,
  error,
  onFileUpload,
}: {
  field: FormField;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled: boolean;
  error?: string;
  onFileUpload?: (file: File) => Promise<void>;
}) {
  const [uploading, setUploading] = React.useState(false);

  if (field.type === "section") {
    return (
      <div className="pt-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b pb-1">
          {field.label}
        </p>
      </div>
    );
  }

  const id = field.key ?? field.label;

  const handleFile = async (file: File) => {
    if (!onFileUpload) return;
    setUploading(true);
    try {
      await onFileUpload(file);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {field.label}
        {field.required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {field.help_text && <p className="text-xs text-muted-foreground">{field.help_text}</p>}

      {field.type === "textarea" ? (
        <Textarea
          id={id}
          disabled={disabled}
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={error ? "border-destructive" : undefined}
        />
      ) : field.type === "select" || field.type === "radio" ? (
        <Select disabled={disabled} value={String(value ?? "")} onValueChange={onChange}>
          <SelectTrigger id={id} className={error ? "border-destructive" : undefined}>
            <SelectValue placeholder={field.placeholder ?? "Select…"} />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.type === "checkbox" ? (
        <div className="flex items-center gap-2">
          <Checkbox
            id={id}
            disabled={disabled}
            checked={Boolean(value)}
            onCheckedChange={(v) => onChange(Boolean(v))}
          />
          <label htmlFor={id} className="text-sm">{field.label}</label>
        </div>
      ) : field.type === "file" ? (
        <div className="space-y-2">
          {value ? (
            <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <span className="flex-1 truncate">{String(value).split("/").pop()}</span>
              {!disabled && (
                <button type="button" className="text-xs text-primary hover:underline" onClick={() => onChange("")}>
                  Remove
                </button>
              )}
            </div>
          ) : null}
          {!disabled && (
            <label className={cn(
              "flex flex-col items-center gap-1 rounded-lg border border-dashed py-4 cursor-pointer hover:bg-muted/30",
              uploading && "opacity-60 pointer-events-none",
              error && "border-destructive",
            )}>
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <Upload className="h-5 w-5 text-muted-foreground" />
              )}
              <span className="text-xs text-muted-foreground">
                {uploading ? "Uploading…" : "Click to upload (PDF, JPG, PNG · max 10 MB)"}
              </span>
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                className="hidden"
                disabled={disabled || uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
      ) : (
        <Input
          id={id}
          disabled={disabled}
          type={
            field.type === "number" ? "number"
            : field.type === "date" ? "date"
            : field.type === "email" ? "email"
            : field.type === "tel" ? "tel"
            : "text"
          }
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={error ? "border-destructive" : undefined}
        />
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function FormEditor({
  formId,
  onBack,
  onSaved,
}: {
  formId: number;
  onBack: () => void;
  onSaved: () => void;
}) {
  const journey = useClientJourneyOptional();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = React.useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [form, setForm] = React.useState<FormDetail | null>(null);
  const [values, setValues] = React.useState<Record<string, unknown>>({});
  const [prefilled, setPrefilled] = React.useState(false);
  const autoSaveTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipAutoSave = React.useRef(true);

  const refreshJourney = React.useCallback(async () => {
    await journey?.refresh();
  }, [journey]);

  React.useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`${CLIENT_API}/client/interactive-forms/${formId}`, { headers: clientAuthHeaders() })
      .then((r) => r.json())
      .then((json) => {
        if (!json.data) throw new Error(json.message ?? "Failed to load form.");
        const detail = json.data as FormDetail;
        setForm(detail);
        const existing = detail.response?.response_data ?? {};
        const merged = json.merged_data ?? json.prefill ?? {};
        const initial = { ...merged, ...existing };
        setValues(initial);
        setPrefilled(Object.keys(json.prefill ?? {}).length > 0 && Object.keys(existing).length === 0);
        skipAutoSave.current = true;
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load form."))
      .finally(() => setLoading(false));
  }, [formId]);

  const isSubmitted = form?.response?.status === "submitted";
  const isVerified = !!form?.response?.reviewed_at;
  const readOnly = isSubmitted;

  const saveDraft = React.useCallback(async (silent = false) => {
    if (readOnly) return;
    if (!silent) setSaving(true);
    else setAutoSaveStatus("saving");
    setError("");
    try {
      const res = await fetch(`${CLIENT_API}/client/interactive-forms/${formId}`, {
        method: "PUT",
        headers: clientAuthHeaders(true),
        body: JSON.stringify({ response_data: values }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Save failed.");
      if (silent) {
        setAutoSaveStatus("saved");
        setTimeout(() => setAutoSaveStatus("idle"), 2000);
      } else {
        await refreshJourney();
        onSaved();
      }
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : "Save failed.");
      else setAutoSaveStatus("idle");
    } finally {
      if (!silent) setSaving(false);
    }
  }, [formId, values, readOnly, refreshJourney, onSaved]);

  React.useEffect(() => {
    if (loading || readOnly) return;
    if (skipAutoSave.current) {
      skipAutoSave.current = false;
      return;
    }
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => saveDraft(true), 2000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [values, loading, readOnly, saveDraft]);

  async function uploadFieldFile(file: File, fieldKey: string) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", "client-document");
    const res = await fetch(`${CLIENT_API}/upload`, {
      method: "POST",
      headers: clientUploadHeaders(),
      body: formData,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message ?? "Upload failed.");
    setValues((prev) => ({ ...prev, [fieldKey]: json.path ?? json.url ?? "" }));
  }

  async function submitForm() {
    if (!form) return;
    const fields = form.form_schema?.fields ?? [];
    const validationErrors = validateForm(fields, values);
    if (validationErrors.length > 0) {
      const errMap: Record<string, string> = {};
      for (const field of fields) {
        if (field.key && field.required && isEmptyValue(values[field.key], field.type)) {
          errMap[field.key] = `${field.label} is required.`;
        }
      }
      setFieldErrors(errMap);
      setError(validationErrors[0]);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${CLIENT_API}/client/interactive-forms/${formId}/submit`, {
        method: "POST",
        headers: clientAuthHeaders(true),
        body: JSON.stringify({ response_data: values }),
      });
      const json = await res.json();
      if (!res.ok) {
        const serverErr = json.errors
          ? Object.values(json.errors as Record<string, string>)[0]
          : json.message;
        throw new Error(String(serverErr ?? "Submit failed."));
      }
      setForm((prev) =>
        prev ? { ...prev, response: json.data?.response ?? { status: "submitted" } } : prev,
      );
      await refreshJourney();
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!form) {
    return <p className="text-sm text-destructive py-8">{error || "Form not found."}</p>;
  }

  const status = formStatusBadge(form.response);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 -ml-2">
        <ChevronLeft className="h-4 w-4" /> Back to forms
      </Button>

      <div>
        <h3 className="font-semibold text-lg">{form.title}</h3>
        {form.description && <p className="text-sm text-muted-foreground mt-1">{form.description}</p>}
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <Badge variant={status.variant} className={cn("gap-1", status.className)}>
            {status.icon} {status.label}
          </Badge>
          {prefilled && !isSubmitted && (
            <Badge variant="outline" className="border-blue-200 text-blue-700 gap-1">
              <Sparkles className="h-3 w-3" /> Auto-filled from questionnaire
            </Badge>
          )}
          {autoSaveStatus === "saving" && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Auto-saving…
            </span>
          )}
          {autoSaveStatus === "saved" && (
            <span className="text-xs text-green-600">Draft saved</span>
          )}
        </div>
      </div>

      {form.response?.consultant_notes && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-medium flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4" /> Consultant notes
          </p>
          <p className="mt-1 whitespace-pre-wrap">{form.response.consultant_notes}</p>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="space-y-4 rounded-xl border p-4">
        {(form.form_schema?.fields ?? []).map((field, idx) => (
          <FieldRenderer
            key={field.key ?? `section-${idx}`}
            field={field}
            value={field.key ? values[field.key] : undefined}
            disabled={readOnly}
            error={field.key ? fieldErrors[field.key] : undefined}
            onChange={(v) => {
              if (field.key) {
                setValues((prev) => ({ ...prev, [field.key!]: v }));
                if (fieldErrors[field.key]) {
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next[field.key!];
                    return next;
                  });
                }
              }
            }}
            onFileUpload={
              field.key
                ? (file) => uploadFieldFile(file, field.key!)
                : undefined
            }
          />
        ))}
      </div>

      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => saveDraft(false)} disabled={saving || submitting}>
            <Save className="mr-1.5 h-4 w-4" />
            {saving ? "Saving…" : "Save draft"}
          </Button>
          <Button onClick={submitForm} disabled={saving || submitting}>
            <Send className="mr-1.5 h-4 w-4" />
            {submitting ? "Submitting…" : "Submit to consultant"}
          </Button>
        </div>
      )}

      {isSubmitted && !isVerified && (
        <p className="text-sm text-muted-foreground">
          Your form has been submitted. Your consultant will review it and may add notes above.
        </p>
      )}
    </div>
  );
}

export function InteractiveApplicationForms({ compact = false }: { compact?: boolean }) {
  const journey = useClientJourneyOptional();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [forms, setForms] = React.useState<FormSummary[]>([]);
  const [activeFormId, setActiveFormId] = React.useState<number | null>(null);

  const loadForms = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${CLIENT_API}/client/interactive-forms`, { headers: clientAuthHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to load forms.");
      setForms(json.forms ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load forms.");
      setForms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { loadForms(); }, [loadForms]);

  const handleSaved = React.useCallback(async () => {
    await loadForms();
    await journey?.refresh();
  }, [loadForms, journey]);

  if (activeFormId) {
    return (
      <FormEditor
        formId={activeFormId}
        onBack={() => { setActiveFormId(null); loadForms(); }}
        onSaved={handleSaved}
      />
    );
  }

  if (loading) {
    return (
      <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", compact ? "py-4" : "py-10 justify-center")}>
        <Loader2 className="h-4 w-4 animate-spin" /> Loading application forms…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        {error.includes("No application package") ? (
          <>
            <p className="font-medium">Waiting for your consultant</p>
            <p className="text-xs mt-1">Your consultant has not assigned an application package yet.</p>
          </>
        ) : error}
      </div>
    );
  }

  if (forms.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">
        No fillable forms for your assigned package yet.
      </p>
    );
  }

  const submittedCount = forms.filter((f) => f.response?.status === "submitted").length;
  const verifiedCount = forms.filter((f) => f.response?.reviewed_at).length;

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>{submittedCount}/{forms.length} submitted · {verifiedCount}/{forms.length} verified</span>
        </div>
      )}

      {forms.map((form) => {
        const status = formStatusBadge(form.response);
        const hasNotes = !!form.response?.consultant_notes;
        return (
          <div
            key={form.id}
            className="flex flex-col gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/30 sm:flex-row sm:items-start"
          >
            <FormInput className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm">{form.title}</p>
              {form.description && !compact && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{form.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <Badge variant={status.variant} className={cn("text-[10px] gap-1", status.className)}>
                  {status.icon} {status.label}
                </Badge>
                {hasNotes && (
                  <Badge variant="outline" className="text-[10px] border-amber-200 text-amber-800">
                    Consultant notes
                  </Badge>
                )}
              </div>
            </div>
            <Button
              size="sm"
              variant={form.response?.status === "submitted" ? "outline" : "default"}
              className="h-9 w-full shrink-0 sm:w-auto"
              onClick={() => setActiveFormId(form.id)}
            >
              {form.response?.status === "submitted" ? "View" : "Fill"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

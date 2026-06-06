"use client";

import * as React from "react";
import {
  Loader2, CheckCircle2, Clock, FormInput, Save, Send, ChevronLeft, Sparkles,
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

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type FormField = {
  type: string;
  key?: string;
  label: string;
  required?: boolean;
  help_text?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
};

type FormSummary = {
  id: number;
  slug: string;
  title: string;
  description?: string | null;
  field_count?: number;
  response?: {
    status: string;
    submitted_at?: string | null;
  } | null;
};

type FormDetail = {
  id: number;
  title: string;
  description?: string | null;
  form_schema: { fields: FormField[] };
  response?: {
    status: string;
    response_data?: Record<string, unknown>;
    submitted_at?: string | null;
  } | null;
};

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const cookie = document.cookie.match(/(?:^|;\s*)wtc_token=([^;]+)/);
  return localStorage.getItem("wtc_token") ?? (cookie ? decodeURIComponent(cookie[1]) : null);
}

function authHeaders(json = false): Record<string, string> {
  const token = getToken();
  return {
    Accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function FieldRenderer({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FormField;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled: boolean;
}) {
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
        />
      ) : field.type === "select" || field.type === "radio" ? (
        <Select
          disabled={disabled}
          value={String(value ?? "")}
          onValueChange={onChange}
        >
          <SelectTrigger id={id}>
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
      ) : (
        <Input
          id={id}
          disabled={disabled}
          type={field.type === "number" ? "number" : field.type === "date" ? "date" : field.type === "email" ? "email" : field.type === "tel" ? "tel" : "text"}
          value={String(value ?? "")}
          placeholder={field.placeholder}
          onChange={(e) => onChange(field.type === "number" ? e.target.value : e.target.value)}
        />
      )}
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
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState("");
  const [form, setForm] = React.useState<FormDetail | null>(null);
  const [values, setValues] = React.useState<Record<string, unknown>>({});
  const [prefilled, setPrefilled] = React.useState(false);

  React.useEffect(() => {
    setLoading(true);
    setError("");
    fetch(`${API}/client/interactive-forms/${formId}`, { headers: authHeaders() })
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
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load form."))
      .finally(() => setLoading(false));
  }, [formId]);

  const isSubmitted = form?.response?.status === "submitted";

  async function saveDraft() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${API}/client/interactive-forms/${formId}`, {
        method: "PUT",
        headers: authHeaders(true),
        body: JSON.stringify({ response_data: values }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Save failed.");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function submitForm() {
    setSubmitting(true);
    setError("");
    try {
      await saveDraft();
      const res = await fetch(`${API}/client/interactive-forms/${formId}/submit`, {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify({ response_data: values }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? Object.values(json.errors ?? {})[0] ?? "Submit failed.");
      setForm((prev) => prev ? { ...prev, response: json.data?.response ?? { status: "submitted" } } : prev);
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

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 -ml-2">
        <ChevronLeft className="h-4 w-4" /> Back to forms
      </Button>

      <div>
        <h3 className="font-semibold text-lg">{form.title}</h3>
        {form.description && <p className="text-sm text-muted-foreground mt-1">{form.description}</p>}
        <div className="flex flex-wrap gap-2 mt-2">
          {isSubmitted ? (
            <Badge className="bg-green-600">Submitted</Badge>
          ) : (
            <Badge variant="outline">Draft</Badge>
          )}
          {prefilled && !isSubmitted && (
            <Badge variant="outline" className="border-blue-200 text-blue-700 gap-1">
              <Sparkles className="h-3 w-3" /> Auto-filled from questionnaire
            </Badge>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="space-y-4 rounded-xl border p-4">
        {(form.form_schema?.fields ?? []).map((field, idx) => (
          <FieldRenderer
            key={field.key ?? `section-${idx}`}
            field={field}
            value={field.key ? values[field.key] : undefined}
            disabled={isSubmitted}
            onChange={(v) => field.key && setValues((prev) => ({ ...prev, [field.key!]: v }))}
          />
        ))}
      </div>

      {!isSubmitted && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={saveDraft} disabled={saving || submitting}>
            <Save className="mr-1.5 h-4 w-4" />
            {saving ? "Saving…" : "Save draft"}
          </Button>
          <Button onClick={submitForm} disabled={saving || submitting}>
            <Send className="mr-1.5 h-4 w-4" />
            {submitting ? "Submitting…" : "Submit to consultant"}
          </Button>
        </div>
      )}
    </div>
  );
}

export function InteractiveApplicationForms({ compact = false }: { compact?: boolean }) {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [forms, setForms] = React.useState<FormSummary[]>([]);
  const [activeFormId, setActiveFormId] = React.useState<number | null>(null);

  const loadForms = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/client/interactive-forms`, { headers: authHeaders() });
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

  if (activeFormId) {
    return (
      <FormEditor
        formId={activeFormId}
        onBack={() => { setActiveFormId(null); loadForms(); }}
        onSaved={loadForms}
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

  return (
    <div className="space-y-3">
      {!compact && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            {submittedCount}/{forms.length} forms submitted
          </p>
        </div>
      )}

      {forms.map((form) => {
        const submitted = form.response?.status === "submitted";
        return (
          <div
            key={form.id}
            className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors"
          >
            <FormInput className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{form.title}</p>
              {form.description && !compact && (
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{form.description}</p>
              )}
              <div className="mt-1.5">
                {submitted ? (
                  <Badge className="bg-green-600 text-[10px] gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Submitted
                  </Badge>
                ) : form.response ? (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Clock className="h-3 w-3" /> Draft saved
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">Not started</Badge>
                )}
              </div>
            </div>
            <Button size="sm" variant={submitted ? "outline" : "default"} onClick={() => setActiveFormId(form.id)}>
              {submitted ? "View" : "Fill"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}

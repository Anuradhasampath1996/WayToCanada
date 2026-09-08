"use client";

import * as React from "react";
import {
  Loader2, CheckCircle2, Clock, FormInput, ChevronDown, ChevronUp, ShieldCheck,
  FileText, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type FormField = {
  type: string;
  key?: string;
  label: string;
  required?: boolean;
};

type FormSummary = {
  id: number;
  title: string;
  slug: string;
  has_response?: boolean;
  response?: { status: string; submitted_at?: string | null; reviewed_at?: string | null } | null;
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
    consultant_notes?: string | null;
    verified_fields?: Record<string, boolean>;
    reviewed_at?: string | null;
  } | null;
};

function authHeaders(json = false): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
  return {
    Accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function FormReviewCard({
  profileId,
  formId,
  title,
  onReviewSaved,
}: {
  profileId: string;
  formId: number;
  title: string;
  onReviewSaved?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [detail, setDetail] = React.useState<FormDetail | null>(null);
  const [notes, setNotes] = React.useState("");

  async function loadDetail() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/consultant/clients/${profileId}/interactive-forms/${formId}`, {
        headers: authHeaders(),
      });
      const json = await res.json();
      if (res.ok) {
        setDetail(json.data);
        setNotes(json.data?.response?.consultant_notes ?? "");
      }
    } finally {
      setLoading(false);
    }
  }

  async function toggleOpen() {
    if (!open && !detail) await loadDetail();
    setOpen(!open);
  }

  async function verifyField(fieldKey: string, verified: boolean) {
    const res = await fetch(
      `${API}/consultant/clients/${profileId}/interactive-forms/${formId}/verify-field`,
      {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify({ field_key: fieldKey, verified }),
      }
    );
    if (res.ok) await loadDetail();
  }

  async function saveReview(markReviewed: boolean) {
    setSaving(true);
    try {
      const res = await fetch(`${API}/consultant/clients/${profileId}/interactive-forms/${formId}/review`, {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify({ consultant_notes: notes, mark_reviewed: markReviewed }),
      });
      await loadDetail();
      if (res.ok && markReviewed) onReviewSaved?.();
    } finally {
      setSaving(false);
    }
  }

  const submitted = detail?.response?.status === "submitted";
  const verified = detail?.response?.verified_fields ?? {};

  return (
    <div className="rounded-xl border overflow-hidden">
      <button
        type="button"
        onClick={toggleOpen}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
      >
        <FormInput className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{title}</p>
        </div>
        {submitted ? (
          <Badge className="bg-green-600 text-[10px]">Submitted</Badge>
        ) : detail?.response ? (
          <Badge variant="outline" className="text-[10px]">Draft</Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px]">Not started</Badge>
        )}
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="border-t px-4 py-4 space-y-4 bg-muted/10">
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading responses…
            </div>
          )}

          {!loading && !detail?.response && (
            <p className="text-sm text-muted-foreground">Client has not started this form yet.</p>
          )}

          {!loading && detail?.response && (
            <>
              <div className="space-y-2">
                {(detail.form_schema?.fields ?? [])
                  .filter((f) => f.type !== "section" && f.key)
                  .map((field) => {
                    const value = detail.response?.response_data?.[field.key!];
                    const isVerified = Boolean(verified[field.key!]);
                    return (
                      <div key={field.key} className="rounded-lg border bg-background p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs text-muted-foreground">{field.label}</p>
                            <p className="text-sm font-medium mt-0.5 break-words">
                              {value === null || value === undefined || value === ""
                                ? <span className="text-muted-foreground italic">—</span>
                                : String(value)}
                            </p>
                          </div>
                          {submitted && (
                            <Button
                              size="sm"
                              variant={isVerified ? "default" : "outline"}
                              className={cn("shrink-0 h-7 text-xs", isVerified && "bg-green-600 hover:bg-green-700")}
                              onClick={() => verifyField(field.key!, !isVerified)}
                            >
                              <ShieldCheck className="h-3 w-3 mr-1" />
                              {isVerified ? "Verified" : "Verify"}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {submitted && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Consultant notes</p>
                  <Textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notes for this form review…"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={saving} onClick={() => saveReview(false)}>
                      Save notes
                    </Button>
                    <Button size="sm" disabled={saving} onClick={() => saveReview(true)}>
                      {saving ? "Saving…" : "Mark reviewed"}
                    </Button>
                  </div>
                  {detail.response.reviewed_at && (
                    <p className="text-xs text-green-700 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Reviewed
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

type ReferenceForm = { code: string; name: string };

type InteractiveFormsIndex = {
  category_id: number | null;
  package_label?: string | null;
  form_mode?: "interactive" | "pdf_only" | "none";
  reference_forms?: ReferenceForm[];
  forms: FormSummary[];
};

export function ConsultantInteractiveFormsPanel({
  profileId,
  onVerificationChange,
  onOpenGovernmentForms,
}: {
  profileId: string;
  onVerificationChange?: () => void;
  onOpenGovernmentForms?: () => void;
}) {
  const [loading, setLoading] = React.useState(true);
  const [index, setIndex] = React.useState<InteractiveFormsIndex>({
    category_id: null,
    forms: [],
  });

  React.useEffect(() => {
    fetch(`${API}/consultant/clients/${profileId}/interactive-forms`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((json: InteractiveFormsIndex) => {
        setIndex({
          category_id: json.category_id ?? null,
          package_label: json.package_label ?? null,
          form_mode: json.form_mode ?? (json.forms?.length ? "interactive" : "none"),
          reference_forms: json.reference_forms ?? [],
          forms: json.forms ?? [],
        });
      })
      .finally(() => setLoading(false));
  }, [profileId]);

  const { category_id: categoryId, forms, package_label: packageLabel, form_mode: formMode, reference_forms: referenceForms = [] } = index;

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 justify-center text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading application forms…
      </div>
    );
  }

  if (!categoryId) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        <FormInput className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p>No application package assigned yet.</p>
        <p className="text-xs mt-1">Assign a package in Pathway Calculator → IRCC Forms & Guides.</p>
      </div>
    );
  }

  if (forms.length === 0) {
    if (formMode === "pdf_only" && referenceForms.length > 0) {
      return (
        <div className="rounded-2xl border bg-gradient-to-br from-slate-50 via-card to-blue-50/30 p-6 space-y-5 dark:from-slate-900/40 dark:to-blue-950/20">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/50">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold">PDF forms package — no online forms here</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-xl">
                {packageLabel ? (
                  <>
                    <strong>{packageLabel}</strong> uses official IRCC PDF forms, not interactive
                    web forms that clients fill inside the portal.
                  </>
                ) : (
                  <>This application package uses official IRCC PDF forms, not interactive web forms.</>
                )}
              </p>
            </div>
          </div>

          <div className="rounded-xl border bg-background/80 p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Required IRCC forms for this package
            </p>
            <ul className="space-y-2">
              {referenceForms.map((form) => (
                <li key={form.code} className="flex items-start gap-2 text-sm">
                  <span className="font-mono font-semibold text-primary shrink-0">{form.code}</span>
                  <span className="text-muted-foreground">{form.name}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-violet-200/80 bg-violet-50/50 px-4 py-3 text-sm text-violet-950 dark:bg-violet-950/20 dark:text-violet-100">
            <p className="font-medium">Where to work on these forms</p>
            <ul className="mt-2 space-y-1.5 text-violet-900/90 dark:text-violet-200/90 list-disc list-inside">
              <li>
                <strong>Government Forms</strong> tab — auto-fill IMM 5476 &amp; IMM 5406 from client data
              </li>
              <li>
                <strong>Overview</strong> — IRCC reference PDFs (checklist, guide, main application form)
              </li>
            </ul>
          </div>

          {onOpenGovernmentForms && (
            <Button onClick={onOpenGovernmentForms} className="gap-2">
              Open Government Forms
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground space-y-2">
        <FormInput className="h-8 w-8 mx-auto opacity-40" />
        <p>No interactive application forms are set up for this package.</p>
        {packageLabel && (
          <p className="text-xs">Package: {packageLabel}</p>
        )}
        <p className="text-xs">
          Online forms are only used for Express Entry / online-only packages. Other cases use PDF
          forms in the Government Forms tab.
        </p>
      </div>
    );
  }

  const submittedCount = forms.filter((f) => f.response?.status === "submitted").length;
  const reviewedCount = forms.filter((f) => Boolean(f.response?.reviewed_at)).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-muted-foreground">
          {submittedCount}/{forms.length} submitted · {reviewedCount}/{forms.length} reviewed
        </p>
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" /> Verify submitted answers below
        </Badge>
      </div>
      {forms.map((form) => (
        <FormReviewCard
          key={form.id}
          profileId={profileId}
          formId={form.id}
          title={form.title}
          onReviewSaved={onVerificationChange}
        />
      ))}
    </div>
  );
}

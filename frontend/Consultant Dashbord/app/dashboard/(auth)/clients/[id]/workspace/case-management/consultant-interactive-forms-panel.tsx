"use client";

import * as React from "react";
import {
  Loader2, CheckCircle2, Clock, FormInput, ChevronDown, ChevronUp, ShieldCheck,
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

export function ConsultantInteractiveFormsPanel({
  profileId,
  onVerificationChange,
}: {
  profileId: string;
  onVerificationChange?: () => void;
}) {
  const [loading, setLoading] = React.useState(true);
  const [forms, setForms] = React.useState<FormSummary[]>([]);
  const [categoryId, setCategoryId] = React.useState<number | null>(null);

  React.useEffect(() => {
    fetch(`${API}/consultant/clients/${profileId}/interactive-forms`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((json) => {
        setForms(json.forms ?? []);
        setCategoryId(json.category_id ?? null);
      })
      .finally(() => setLoading(false));
  }, [profileId]);

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
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        No interactive forms configured for this package.
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

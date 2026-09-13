"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { consultantAuthToken } from "@/lib/case-assessment-api";
import {
  fetchAssignment,
  saveConsultantExtraData,
  type CaseAssignment,
} from "@/lib/case-assignment-api";

export function AssignmentPlanPanel({
  profileId,
  assignedPathway,
}: {
  profileId: string;
  assignedPathway: string | null;
}) {
  const [assignment, setAssignment] = useState<CaseAssignment | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    const token = consultantAuthToken();
    const data = await fetchAssignment(profileId, token);
    setAssignment(data);
    const next: Record<string, string> = {};
    for (const field of data.extra_fields.ask ?? []) {
      next[field.key] = field.value ?? "";
    }
    setAnswers(next);
  }

  useEffect(() => {
    if (!assignedPathway) {
      setAssignment(null);
      return;
    }
    void reload().catch((e) => setError(e instanceof Error ? e.message : "Failed to load assignment."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, assignedPathway]);

  if (!assignedPathway) return null;

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
      <div>
        <p className="text-xs font-semibold">Auto-assigned to client</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Only missing pathway fields are asked. Intake answers and uploaded files are reused. A pathway change keeps history.
        </p>
      </div>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      {!assignment ? (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" /> Loading assignment…
        </div>
      ) : (
        <>
          <p className="text-[11px] text-muted-foreground">
            Plan v{assignment.plan_version ?? "—"} · {assignment.registry_key ?? assignedPathway}
          </p>
          {(assignment.extra_fields.reused ?? []).length > 0 && (
            <div>
              <p className="text-[11px] font-semibold">Reused from intake</p>
              <ul className="mt-1 space-y-1">
                {assignment.extra_fields.reused.map((field) => (
                  <li key={field.key} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                    <CheckCircle2 className="mt-0.5 size-3 text-emerald-600" />
                    <span>{field.label}: {field.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {(assignment.extra_fields.ask ?? []).length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold">Missing pathway details</p>
              {assignment.extra_fields.ask.map((field) => (
                <label key={field.key} className="block text-[11px] text-muted-foreground">
                  {field.label}
                  <input
                    value={answers[field.key] ?? ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-input/80 bg-muted/20 px-2 py-1.5 text-xs text-foreground"
                  />
                </label>
              ))}
              <Button
                size="sm"
                className="h-7 rounded-lg text-xs"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  setError(null);
                  saveConsultantExtraData(profileId, consultantAuthToken(), answers)
                    .then((data) => {
                      setAssignment(data);
                    })
                    .catch((e) => setError(e instanceof Error ? e.message : "Save failed."))
                    .finally(() => setBusy(false));
                }}
              >
                Save extra details
              </Button>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <p className="text-[11px] font-semibold">Forms</p>
              <ul className="mt-1 space-y-1">
                {(assignment.forms ?? []).map((form) => (
                  <li key={form.code} className="text-[11px] text-muted-foreground">
                    {form.code}{form.kind ? ` · ${form.kind}` : ""}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-semibold">Documents</p>
              <ul className="mt-1 space-y-1">
                {(assignment.documents ?? []).map((doc) => (
                  <li key={doc.id} className="text-[11px] text-muted-foreground">
                    {doc.label}
                    {doc.reuse_candidate ? " · intake file on file" : ""}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

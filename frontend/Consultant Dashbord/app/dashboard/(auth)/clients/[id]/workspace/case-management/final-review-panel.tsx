"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { consultantAuthToken } from "@/lib/case-assessment-api";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type Highlight = { code: string; severity: string; message: string; fields?: string[] };
type ChecklistItem = { key: string; label: string; checked: boolean };

type FinalReview = {
  checklist: Record<string, ChecklistItem> | null;
  checklist_complete: boolean;
  notes: string | null;
  highlights: Highlight[];
  highlights_are_support_only: boolean;
  automatic_approval: boolean;
  ready_for_client_review: boolean;
  acknowledged: boolean;
  signature_required: boolean;
  signed: boolean;
  confirmed_submission_portal: string | null;
  recommended_portals: string[];
  ready_to_submit: boolean;
  submitted: boolean;
  can_mark_ready_for_client: boolean;
  can_mark_ready_to_submit: boolean;
  consultant_can_acknowledge: boolean;
  consultant_can_sign: boolean;
  auto_submitted: boolean;
};

type Submission = {
  submitted: boolean;
  submission_date: string | null;
  application_number: string | null;
  confirmation_number: string | null;
  government_fees: string | number | null;
  payment_confirmation: string | null;
  immutable: boolean;
  auto_submitted: boolean;
};

export function FinalReviewPanel({ profileId }: { profileId: string }) {
  const [review, setReview] = useState<FinalReview | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [items, setItems] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [portal, setPortal] = useState("ircc_rep");
  const [fields, setFields] = useState({
    submission_date: "",
    application_number: "",
    confirmation_number: "",
    government_fees: "",
    payment_confirmation: "",
  });
  const [receipt, setReceipt] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function reload() {
    const res = await fetch(`${API}/consultant/clients/${profileId}/case-file/final-review`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${consultantAuthToken()}`,
      },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message ?? "Failed to load final review.");
    setReview(json.final_review);
    setSubmission(json.submission);
    const next: Record<string, boolean> = {};
    const checklist = (json.final_review?.checklist ?? {}) as Record<string, ChecklistItem>;
    for (const item of Object.values(checklist)) {
      next[item.key] = item.checked;
    }
    setItems(next);
    setNotes(json.final_review?.notes ?? "");
    setPortal(json.final_review?.confirmed_submission_portal ?? json.final_review?.recommended_portals?.[0] ?? "ircc_rep");
  }

  useEffect(() => {
    void reload().catch((e) => setError(e instanceof Error ? e.message : "Failed to load."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  async function post(path: string, body?: unknown, label = "save") {
    setBusy(label);
    setError(null);
    try {
      const res = await fetch(`${API}/consultant/clients/${profileId}${path}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${consultantAuthToken()}`,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Update failed.");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusy(null);
    }
  }

  async function submitConfirmation() {
    setBusy("submit");
    setError(null);
    try {
      const form = new FormData();
      form.append("submission_date", fields.submission_date);
      form.append("application_number", fields.application_number);
      form.append("confirmation_number", fields.confirmation_number);
      form.append("government_fees", fields.government_fees);
      form.append("payment_confirmation", fields.payment_confirmation);
      if (receipt) form.append("receipt", receipt);
      const res = await fetch(`${API}/consultant/clients/${profileId}/case-file/submission`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${consultantAuthToken()}`,
        },
        body: form,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Could not record submission.");
      await reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record submission.");
    } finally {
      setBusy(null);
    }
  }

  if (!review) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading final review…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-4 text-sm">
        Highlights are support only. They never approve, sign, or submit this file. Maple cannot do those actions either.
      </div>

      {review.highlights.length > 0 && (
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm font-semibold">Inconsistency / support highlights</p>
          <ul className="mt-2 space-y-2">
            {review.highlights.map((h) => (
              <li key={h.code} className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{h.severity}:</span> {h.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold">Consultant final review checklist</p>
        {Object.values(review.checklist ?? {}).map((item) => (
          <label key={item.key} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={items[item.key] ?? false}
              disabled={review.submitted}
              onChange={(e) => setItems((prev) => ({ ...prev, [item.key]: e.target.checked }))}
            />
            <span>{item.label}</span>
          </label>
        ))}
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={review.submitted}
          placeholder="Internal review notes"
          className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
        />
        <Button
          size="sm"
          disabled={!!busy || review.submitted}
          onClick={() => void post("/case-file/final-review/checklist", { items, notes }, "checklist")}
        >
          {busy === "checklist" && <Loader2 className="mr-1 size-3 animate-spin" />}
          Save checklist
        </Button>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-2">
        <p className="text-sm font-semibold">Client review</p>
        <p className="text-xs text-muted-foreground">
          You cannot acknowledge or sign for the client.
          {review.signature_required ? " This process also requires a client declaration." : " Signature is not required on this snapshot."}
        </p>
        <p className="text-xs">
          Ready for client: <strong>{review.ready_for_client_review ? "yes" : "no"}</strong>
          {" · "}Acknowledged: <strong>{review.acknowledged ? "yes" : "no"}</strong>
          {review.signature_required ? ` · Signed: ${review.signed ? "yes" : "no"}` : ""}
        </p>
        <Button
          size="sm"
          disabled={!!busy || !review.can_mark_ready_for_client}
          onClick={() => void post("/case-file/final-review/ready-for-client", undefined, "ready-client")}
        >
          {busy === "ready-client" && <Loader2 className="mr-1 size-3 animate-spin" />}
          Mark ready for client review
        </Button>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold">Submission portal / method</p>
        <p className="text-xs text-muted-foreground">
          Registry recommendation is not a submission. Confirm the portal you will use. RCICMaster never submits to IRCC or a provincial system.
        </p>
        <select
          value={portal}
          disabled={review.submitted}
          onChange={(e) => setPortal(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
        >
          {(review.recommended_portals.length ? review.recommended_portals : ["ircc_rep", "pr_portal", "provincial", "other"]).map((p) => (
            <option key={p} value={p}>{p.replaceAll("_", " ")}</option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!!busy || review.submitted}
            onClick={() => void post("/case-file/requirement-plan/confirm-portal", { portal, note: "Consultant confirmed portal." }, "portal")}
          >
            {busy === "portal" && <Loader2 className="mr-1 size-3 animate-spin" />}
            Confirm portal
          </Button>
          <Button
            size="sm"
            disabled={!!busy || !review.can_mark_ready_to_submit}
            onClick={() => void post("/case-file/final-review/ready-to-submit", undefined, "ready-submit")}
          >
            {busy === "ready-submit" && <Loader2 className="mr-1 size-3 animate-spin" />}
            Mark Ready to Submit
          </Button>
        </div>
        {review.confirmed_submission_portal && (
          <p className="text-xs">Confirmed: {review.confirmed_submission_portal.replaceAll("_", " ")}</p>
        )}
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold">Submission confirmation</p>
        {submission?.submitted ? (
          <div className="space-y-1 text-sm">
            <p>Recorded on {submission.submission_date}. This record is immutable.</p>
            <p>Application #: {submission.application_number ?? "—"}</p>
            <p>Confirmation #: {submission.confirmation_number ?? "—"}</p>
            <p>Fees: {submission.government_fees ?? "—"} · Payment: {submission.payment_confirmation ?? "—"}</p>
          </div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            <input className="rounded-lg border px-3 py-2 text-sm" type="date" value={fields.submission_date} onChange={(e) => setFields((p) => ({ ...p, submission_date: e.target.value }))} />
            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Application number" value={fields.application_number} onChange={(e) => setFields((p) => ({ ...p, application_number: e.target.value }))} />
            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Confirmation number" value={fields.confirmation_number} onChange={(e) => setFields((p) => ({ ...p, confirmation_number: e.target.value }))} />
            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Government fees" value={fields.government_fees} onChange={(e) => setFields((p) => ({ ...p, government_fees: e.target.value }))} />
            <input className="rounded-lg border px-3 py-2 text-sm md:col-span-2" placeholder="Payment confirmation" value={fields.payment_confirmation} onChange={(e) => setFields((p) => ({ ...p, payment_confirmation: e.target.value }))} />
            <input className="text-sm md:col-span-2" type="file" onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} />
            <Button size="sm" disabled={!!busy || !review.ready_to_submit} onClick={() => void submitConfirmation()}>
              {busy === "submit" && <Loader2 className="mr-1 size-3 animate-spin" />}
              Record submission confirmation
            </Button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

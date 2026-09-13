"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { consultantAuthToken } from "@/lib/case-assessment-api";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type GovRequest = {
  id: number;
  type: string;
  label: string;
  status: string;
  due_at: string | null;
  notes: string | null;
  open: boolean;
};

type Payload = {
  government_requests: {
    types: Record<string, string>;
    requests: GovRequest[];
    open_count: number;
    submitted?: boolean;
    can_create?: boolean;
  };
  decision: { decision_status: string | null; statuses: Record<string, string>; has_letter: boolean };
  closure: {
    checklist: Record<string, { key: string; label: string; checked: boolean }>;
    checklist_complete: boolean;
    can_close: boolean;
    open_government_requests: number;
    lifecycle_status: string;
  };
};

export function PostSubmissionPanel({ profileId }: { profileId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const submitted = Boolean(data?.government_requests?.submitted ?? data?.government_requests?.can_create);
  const [type, setType] = useState("biometrics");
  const [custom, setCustom] = useState("");
  const [due, setDue] = useState("");
  const [notes, setNotes] = useState("");
  const [decision, setDecision] = useState("approved");
  const [decisionNote, setDecisionNote] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [letter, setLetter] = useState<File | null>(null);
  const [items, setItems] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function reload() {
    const res = await fetch(`${API}/consultant/clients/${profileId}/case-file/post-submission`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${consultantAuthToken()}` },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message ?? "Failed to load post-submission.");
    setData(json);
    const next: Record<string, boolean> = {};
    const checklist = (json.closure?.checklist ?? {}) as Record<string, { key: string; checked: boolean }>;
    for (const item of Object.values(checklist)) {
      next[item.key] = item.checked;
    }
    setItems(next);
  }

  useEffect(() => {
    void reload().catch((e) => setError(e instanceof Error ? e.message : "Failed to load."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  async function post(path: string, body?: unknown, label = "save", form = false) {
    setBusy(label);
    setError(null);
    try {
      const res = await fetch(`${API}/consultant/clients/${profileId}${path}`, {
        method: "POST",
        headers: form
          ? { Accept: "application/json", Authorization: `Bearer ${consultantAuthToken()}` }
          : {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Bearer ${consultantAuthToken()}`,
            },
        body: form ? (body as FormData) : body === undefined ? undefined : JSON.stringify(body),
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

  if (!data) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Loading post-submission…</div>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold">Government requests</p>
        <p className="text-xs text-muted-foreground">Preset types plus Other. Due dates appear on the consultant calendar. The client is notified in the portal.</p>
        {!submitted && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Government requests cannot be used before the case is submitted.
          </p>
        )}
        <div className="grid gap-2 md:grid-cols-2">
          <select className="rounded-lg border px-3 py-2 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
            {Object.entries(data.government_requests.types).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <input className="rounded-lg border px-3 py-2 text-sm" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          {type === "other" && (
            <input className="rounded-lg border px-3 py-2 text-sm md:col-span-2" placeholder="Describe the request" value={custom} onChange={(e) => setCustom(e.target.value)} />
          )}
          <input className="rounded-lg border px-3 py-2 text-sm md:col-span-2" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <Button size="sm" disabled={!!busy || !submitted} onClick={() => void post("/case-file/government-requests", { type, custom_label: custom, due_at: due || null, notes }, "create")}>
          {busy === "create" && <Loader2 className="mr-1 size-3 animate-spin" />}
          Add government request
        </Button>
        <ul className="space-y-2">
          {data.government_requests.requests.map((req) => (
            <li key={req.id} className="rounded-lg border px-3 py-2 text-sm">
              <p className="font-medium">{req.label} · {req.status.replaceAll("_", " ")}</p>
              {req.due_at && <p className="text-xs text-muted-foreground">Due {new Date(req.due_at).toLocaleDateString()}</p>}
              {req.open ? (
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => void post(`/case-file/government-requests/${req.id}/in-progress`, undefined, `prog-${req.id}`)}>In progress</Button>
                  <Button size="sm" onClick={() => void post(`/case-file/government-requests/${req.id}/answered`, { notes: "Response sent." }, `ans-${req.id}`)}>Mark answered</Button>
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">Answered — cannot move back to an earlier state.</p>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold">Decision</p>
        {data.decision.decision_status ? (
          <p className="text-sm">Recorded: {data.decision.decision_status}{data.decision.has_letter ? " · letter attached" : ""}</p>
        ) : (
          <>
            <select className="rounded-lg border px-3 py-2 text-sm" value={decision} onChange={(e) => setDecision(e.target.value)}>
              {Object.entries(data.decision.statuses).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Decision note" value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} />
            <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Optional next-step note" value={nextStep} onChange={(e) => setNextStep(e.target.value)} />
            <input type="file" className="text-sm" onChange={(e) => setLetter(e.target.files?.[0] ?? null)} />
            {decision === "other" && (
              <p className="text-xs text-muted-foreground">A custom explanation is required for Other.</p>
            )}
            <Button
              size="sm"
              disabled={!!busy || !submitted}
              onClick={() => {
                const form = new FormData();
                form.append("decision_status", decision);
                form.append("decision_note", decisionNote);
                form.append("next_step_note", nextStep);
                if (letter) form.append("letter", letter);
                void post("/case-file/decision", form, "decision", true);
              }}
            >
              Record decision
            </Button>
          </>
        )}
      </div>

      <div className="rounded-xl border bg-card p-4 space-y-3">
        <p className="text-sm font-semibold">Closure review</p>
        {Object.values(data.closure.checklist).map((item) => (
          <label key={item.key} className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" aria-label={item.label} checked={items[item.key] ?? false} onChange={(e) => setItems((prev) => ({ ...prev, [item.key]: e.target.checked }))} />
            <span>{item.label}</span>
          </label>
        ))}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={!!busy} data-testid="phase5-save-checklist" onClick={() => void post("/case-file/closure/checklist", { items }, "checklist")}>Save checklist</Button>
          <Button size="sm" disabled={!!busy || !data.closure.can_close} data-testid="phase5-close-case" onClick={() => void post("/case-file/closure/close", { action: "close" }, "close")}>
            Close case
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Open government requests: {data.closure.open_government_requests}. Lifecycle: {data.closure.lifecycle_status}.
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

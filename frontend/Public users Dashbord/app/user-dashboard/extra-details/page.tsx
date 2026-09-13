"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { ClientJourneyGate } from "@/components/client-journey-gate";
import { ClientJourneyPageChrome } from "@/components/client-workspace-ui";
import { Button } from "@/components/ui/button";
import { useClientJourney } from "@/context/client-journey-context";
import { CLIENT_API, clientAuthHeaders } from "@/lib/client-api";

function ExtraDetailsContent() {
  const { assignment, refresh } = useClientJourney();
  const ask = assignment?.extra_fields?.ask ?? [];
  const reused = assignment?.extra_fields?.reused ?? [];
  const forms = assignment?.forms ?? [];
  const documents = assignment?.documents ?? [];
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    const next: Record<string, string> = {};
    for (const field of ask) next[field.key] = "";
    return next;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const askKeys = useMemo(() => ask.map((field) => field.key).join("|"), [ask]);

  useEffect(() => {
    setAnswers((prev) => {
      const next = { ...prev };
      for (const field of ask) {
        if (next[field.key] == null) next[field.key] = "";
      }
      return next;
    });
  }, [askKeys, ask]);

  return (
    <ClientJourneyPageChrome
      stepId="extra_details"
      description="Answer only the missing questions for your selected pathway. Your consultant already reused name, study, and other profile answers that were on file."
    >
      {reused.length > 0 && (
        <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/40 p-4">
          <p className="text-sm font-semibold text-emerald-900">Already on file</p>
          <ul className="mt-2 space-y-1">
            {reused.map((field) => (
              <li key={field.key} className="flex items-start gap-2 text-sm text-emerald-900/80">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <span>{field.label}{field.value ? `: ${field.value}` : ""}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <p className="text-sm font-semibold">Missing pathway questions</p>
        {ask.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            No extra questions are outstanding for this pathway.
          </p>
        ) : (
          <form
            className="mt-3 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              setSaved(false);
              fetch(`${CLIENT_API}/client/case-assignment/extra-data`, {
                method: "POST",
                headers: clientAuthHeaders(),
                body: JSON.stringify({ answers }),
              })
                .then(async (res) => {
                  const json = await res.json();
                  if (!res.ok) throw new Error(json?.message ?? "Could not save extra details.");
                  setSaved(true);
                  await refresh();
                })
                .catch((err: unknown) => setError(err instanceof Error ? err.message : "Save failed."))
                .finally(() => setBusy(false));
            }}
          >
            {ask.map((field) => (
              <label key={`${askKeys}-${field.key}`} className="block text-sm">
                <span className="text-muted-foreground">{field.label}</span>
                <input
                  value={answers[field.key] ?? ""}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
              </label>
            ))}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {saved && <p className="text-sm text-emerald-700">Saved. Known profile answers were not asked again.</p>}
            <Button type="submit" disabled={busy} className="rounded-lg">
              {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
              Save extra details
            </Button>
          </form>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm font-semibold">Assigned forms</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {forms.length === 0 && <li>No forms assigned yet.</li>}
            {forms.map((form) => (
              <li key={form.code}>{form.name ?? form.code}{form.kind ? ` · ${form.kind}` : ""}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm font-semibold">Assigned documents</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {documents.length === 0 && <li>No documents assigned yet.</li>}
            {documents.map((doc) => (
              <li key={doc.id}>
                {doc.label}
                {doc.reuse_candidate ? " · intake file available" : ""}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ClientJourneyPageChrome>
  );
}

export default function ExtraDetailsPage() {
  return (
    <ClientJourneyGate stepId="extra_details">
      <ExtraDetailsContent />
    </ClientJourneyGate>
  );
}

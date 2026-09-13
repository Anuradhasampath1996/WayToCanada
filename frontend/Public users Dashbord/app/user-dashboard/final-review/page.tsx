"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { ClientJourneyGate } from "@/components/client-journey-gate";
import { ClientJourneyPageChrome } from "@/components/client-workspace-ui";
import { Button } from "@/components/ui/button";
import { useClientJourney } from "@/context/client-journey-context";
import { CLIENT_API, clientAuthHeaders } from "@/lib/client-api";

type FinalReview = {
  read_only: boolean;
  package: {
    pathway?: string | null;
    forms?: { code?: string; name?: string }[];
    documents?: { id?: string; label?: string }[];
  };
  highlights: { code: string; severity: string; message: string }[];
  acknowledged: boolean;
  acknowledged_at: string | null;
  signature_required: boolean;
  signed: boolean;
  client_can_acknowledge: boolean;
  client_can_sign: boolean;
  submitted: boolean;
  ready_to_submit: boolean;
};

function FinalReviewContent() {
  const { refresh } = useClientJourney();
  const [data, setData] = useState<FinalReview | null>(null);
  const [signature, setSignature] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function reload() {
    const res = await fetch(`${CLIENT_API}/client/final-review`, { headers: clientAuthHeaders() });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message ?? "Could not load the final package.");
    setData(json.final_review);
  }

  useEffect(() => {
    void reload().catch((e) => setError(e instanceof Error ? e.message : "Failed to load."));
  }, []);

  async function post(path: string, body?: Record<string, string>, label = "save") {
    setBusy(label);
    setError("");
    try {
      const res = await fetch(`${CLIENT_API}${path}`, {
        method: "POST",
        headers: clientAuthHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Update failed.");
      setData(json.final_review);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusy(null);
    }
  }

  if (!data) {
    return (
      <ClientJourneyPageChrome stepId="final_review" description="Review the assembled package. Your consultant cannot sign or acknowledge for you.">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Loading package…
        </div>
      </ClientJourneyPageChrome>
    );
  }

  return (
    <ClientJourneyPageChrome
      stepId="final_review"
      description="This package is read-only. Acknowledge it before your consultant records the government submission. Sign only if this application requires a declaration."
    >
      <div className="rounded-xl border bg-card p-4 space-y-2">
        <p className="text-sm font-semibold">Final package · {data.package.pathway ?? "Pathway assigned"}</p>
        <p className="text-xs text-muted-foreground">Read-only review. Nothing here is submitted to IRCC automatically.</p>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs font-semibold">Forms</p>
            <ul className="mt-1 text-sm text-muted-foreground">
              {(data.package.forms ?? []).length === 0 && <li>No forms listed.</li>}
              {(data.package.forms ?? []).map((form) => (
                <li key={form.code}>{form.name ?? form.code}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold">Documents</p>
            <ul className="mt-1 text-sm text-muted-foreground">
              {(data.package.documents ?? []).length === 0 && <li>No documents listed.</li>}
              {(data.package.documents ?? []).map((doc) => (
                <li key={doc.id}>{doc.label ?? doc.id}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {data.highlights.length > 0 && (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-4">
          <p className="text-sm font-semibold">Items your consultant asked you to notice</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            {data.highlights.map((h) => (
              <li key={h.code}>{h.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border bg-card p-4 space-y-3">
        {data.acknowledged ? (
          <p className="flex items-center gap-2 text-sm text-emerald-800">
            <CheckCircle2 className="size-4" />
            Acknowledged {data.acknowledged_at ? new Date(data.acknowledged_at).toLocaleString() : ""}
          </p>
        ) : (
          <Button disabled={!!busy || !data.client_can_acknowledge} onClick={() => void post("/client/final-review/acknowledge", undefined, "ack")}>
            {busy === "ack" && <Loader2 className="mr-2 size-4 animate-spin" />}
            I acknowledge this final package
          </Button>
        )}

        {data.signature_required && (
          data.signed ? (
            <p className="flex items-center gap-2 text-sm text-emerald-800">
              <CheckCircle2 className="size-4" /> Declaration signed
            </p>
          ) : (
            <div className="space-y-2">
              <input
                value={signature}
                onChange={(e) => setSignature(e.target.value)}
                placeholder="Type your full name to declare"
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
              <Button disabled={!!busy || !data.client_can_sign} onClick={() => void post("/client/final-review/sign", { signature }, "sign")}>
                {busy === "sign" && <Loader2 className="mr-2 size-4 animate-spin" />}
                Sign declaration
              </Button>
            </div>
          )
        )}
      </div>

      {data.submitted && <p className="text-sm text-emerald-800">Your consultant recorded the government submission confirmation.</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </ClientJourneyPageChrome>
  );
}

export default function FinalReviewPage() {
  return (
    <ClientJourneyGate stepId="final_review">
      <FinalReviewContent />
    </ClientJourneyGate>
  );
}

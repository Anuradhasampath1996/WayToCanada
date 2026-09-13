"use client";

import { useEffect, useState } from "react";
import { ClientJourneyGate } from "@/components/client-journey-gate";
import { ClientJourneyPageChrome } from "@/components/client-workspace-ui";
import { CLIENT_API, clientAuthHeaders } from "@/lib/client-api";

type RequestRow = { id: number; label: string; status: string; due_at: string | null; notes: string | null };

function GovernmentRequestsContent() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [decision, setDecision] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${CLIENT_API}/client/post-submission`, { headers: clientAuthHeaders() })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.message ?? "Could not load government requests.");
        setRequests(json.government_requests?.requests ?? []);
        setDecision(json.decision?.decision_status ?? null);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load."));
  }, []);

  return (
    <ClientJourneyPageChrome
      stepId="government_requests"
      description="Your consultant records government requests and due dates here. This screen is read-only — you cannot change case data from it."
    >
      {decision && <p className="text-sm">Decision on file: {decision}</p>}
      <div className="rounded-xl border bg-card p-4">
        <p className="text-sm font-semibold">Open and recent requests</p>
        <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
          {requests.length === 0 && <li>No government requests yet.</li>}
          {requests.map((req) => (
            <li key={req.id}>
              <span className="font-medium text-foreground">{req.label}</span>
              {" · "}{req.status === "answered" ? "Completed" : req.status === "response_in_progress" ? "Consultant is responding" : req.status === "client_notified" ? "Action may be needed" : "Requested"}
              {req.due_at ? ` · due ${new Date(req.due_at).toLocaleDateString()}` : ""}
            </li>
          ))}
        </ul>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </ClientJourneyPageChrome>
  );
}

export default function GovernmentRequestsPage() {
  return (
    <ClientJourneyGate stepId="government_requests">
      <GovernmentRequestsContent />
    </ClientJourneyGate>
  );
}

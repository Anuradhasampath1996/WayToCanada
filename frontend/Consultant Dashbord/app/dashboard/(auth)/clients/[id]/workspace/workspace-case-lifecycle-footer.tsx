"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  CaseLifecyclePanel,
  type CaseFileSummary,
  type CaseLifecycleMeta,
} from "./case-lifecycle-panel";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function WorkspaceCaseLifecycleFooter({ profileId }: { profileId: string }) {
  const [clientName, setClientName] = useState("");
  const [caseFiles, setCaseFiles] = useState<CaseFileSummary[]>([]);
  const [lifecycle, setLifecycle] = useState<CaseLifecycleMeta | null>(null);
  const [activeCaseNumber, setActiveCaseNumber] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/consultant/clients/${profileId}/case-file`, {
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) return;
      setClientName(json.client?.user?.name ?? "Client");
      setCaseFiles(json.case_files ?? []);
      setLifecycle(json.lifecycle ?? null);
      setActiveCaseNumber(json.case_file?.case_number ?? 1);
    } catch {
      // footer is non-blocking
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-dashed py-8 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading case management…
      </div>
    );
  }

  if (!clientName) return null;

  return (
    <CaseLifecyclePanel
      profileId={profileId}
      clientName={clientName}
      caseFiles={caseFiles}
      lifecycle={lifecycle}
      activeCaseNumber={activeCaseNumber}
      getAuthHeaders={authHeaders}
      onUpdated={load}
    />
  );
}

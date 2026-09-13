"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { consultantAuthToken } from "@/lib/case-assessment-api";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type RepresentativeState = {
  visible: boolean;
  requirement: string;
  form_code: string;
  state: string;
  can_leave_unused: boolean;
  can_mark_na: boolean;
  activation?: { activated?: boolean; representative_satisfied?: boolean };
};

export function RepresentativePanel({
  profileId,
  assignedPathway,
}: {
  profileId: string;
  assignedPathway: string | null;
}) {
  const [data, setData] = useState<RepresentativeState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function reload() {
    const res = await fetch(`${API}/consultant/clients/${profileId}/case-file/representative`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${consultantAuthToken()}`,
      },
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.message ?? "Failed to load representative stage.");
    setData(json.representative);
  }

  useEffect(() => {
    if (!assignedPathway) return;
    void reload().catch((e) => setError(e instanceof Error ? e.message : "Failed to load."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId, assignedPathway]);

  if (!assignedPathway || !data || !data.visible) return null;

  async function run(action: string) {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`${API}/consultant/clients/${profileId}/case-file/representative`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${consultantAuthToken()}`,
        },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Update failed.");
      setData(json.representative);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
      <div>
        <p className="text-xs font-semibold">Representative authorization</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {data.form_code} is {data.requirement} on this case snapshot.
          {data.requirement === "required" ? " N/A is not allowed." : ""}
        </p>
      </div>
      <p className="text-[11px]">
        State: <span className="font-semibold">{data.state.replaceAll("_", " ")}</span>
        {data.activation?.activated ? " · Case active" : ""}
      </p>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-1.5">
        {["send", "sign", "review", "complete"].map((action) => (
          <Button
            key={action}
            size="sm"
            variant="outline"
            className="h-7 rounded-lg text-xs capitalize"
            disabled={!!busy}
            onClick={() => void run(action)}
          >
            {busy === action && <Loader2 className="mr-1 size-3 animate-spin" />}
            {action}
          </Button>
        ))}
        {data.can_leave_unused && (
          <Button size="sm" variant="ghost" className="h-7 rounded-lg text-xs" disabled={!!busy} onClick={() => void run("leave_unused")}>
            Leave unused
          </Button>
        )}
      </div>
    </div>
  );
}

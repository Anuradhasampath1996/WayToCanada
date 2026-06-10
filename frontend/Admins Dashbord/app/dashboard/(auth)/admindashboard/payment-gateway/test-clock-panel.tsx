"use client";

import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FastForward,
  RefreshCw,
  Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { adminAuthHeaders } from "@/lib/admin-auth";

const API = process.env.NEXT_PUBLIC_API_URL + "/api/v1";

type ClockStatus = {
  available: boolean;
  use_test_clock?: boolean;
  test_clock_id?: string | null;
  frozen_time_human?: string | null;
  status?: string;
  message?: string;
  error?: string;
};

type SyncResult = {
  id: number;
  user?: string;
  status?: string;
  ends_at?: string;
  last_payment_at?: string;
  success: boolean;
  error?: string;
};

function authHeaders() {
  return adminAuthHeaders("application/json");
}

export function TestClockPanel() {
  const [clock, setClock] = React.useState<ClockStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState("");
  const [toast, setToast] = React.useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [syncResults, setSyncResults] = React.useState<SyncResult[] | null>(null);

  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 5000);
  }

  async function loadStatus() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/stripe-test/status`, { headers: authHeaders() });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to load test clock status");
      setClock(json);
    } catch (e: unknown) {
      showToast("error", e instanceof Error ? e.message : "Failed to load status");
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    loadStatus();
  }, []);

  async function enableClock() {
    setBusy("enable");
    try {
      const res = await fetch(`${API}/admin/stripe-test/clock/enable`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ use_for_checkouts: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to enable test clock");
      showToast("success", json.message);
      setClock(json.clock);
    } catch (e: unknown) {
      showToast("error", e instanceof Error ? e.message : "Enable failed");
    } finally {
      setBusy("");
    }
  }

  async function advanceClock(cycle: "monthly" | "yearly") {
    setBusy(`advance-${cycle}`);
    setSyncResults(null);
    try {
      const res = await fetch(`${API}/admin/stripe-test/clock/advance`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ cycle }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Failed to advance clock");
      showToast("success", json.message);
      await loadStatus();
      // Auto-sync after a short delay so Stripe can process invoices
      setTimeout(() => void syncSubscriptions(true), 3000);
    } catch (e: unknown) {
      showToast("error", e instanceof Error ? e.message : "Advance failed");
    } finally {
      setBusy("");
    }
  }

  async function syncSubscriptions(silent = false) {
    setBusy("sync");
    try {
      const res = await fetch(`${API}/admin/stripe-test/subscriptions/sync`, {
        method: "POST",
        headers: authHeaders(),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Sync failed");
      if (!silent) showToast("success", json.message);
      setSyncResults(json.results ?? []);
      await loadStatus();
    } catch (e: unknown) {
      showToast("error", e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy("");
    }
  }

  if (loading) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 flex items-center justify-center gap-2 text-muted-foreground text-sm">
          <RefreshCw className="size-4 animate-spin" />
          Loading test clock…
        </CardContent>
      </Card>
    );
  }

  if (!clock?.available) {
    return null;
  }

  const clockActive = !!clock.test_clock_id && clock.use_test_clock;

  return (
    <Card className="border-dashed border-amber-300/60 bg-amber-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
              <Timer className="size-5 text-amber-700" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Test Auto-Renewal</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Simulate billing cycles with Stripe Test Clock (test mode only)
              </p>
            </div>
          </div>
          <Badge variant="outline" className="border-amber-400 text-amber-700 bg-amber-50">
            Test Mode
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {toast && (
          <div
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              toast.type === "success"
                ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="size-4 shrink-0" />
            ) : (
              <AlertCircle className="size-4 shrink-0" />
            )}
            {toast.msg}
          </div>
        )}

        {/* Step guide */}
        <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
          <li>Click <strong>Enable Test Clock</strong> below</li>
          <li>Consultant subscribes with test card <code className="bg-muted px-1 rounded">4242 4242 4242 4242</code></li>
          <li>Click <strong>Advance +1 Month</strong> to simulate renewal</li>
          <li>Click <strong>Sync from Stripe</strong> — check <code>ends_at</code> and <code>last_payment_at</code> updated</li>
        </ol>

        <Separator />

        {/* Clock status */}
        <div className="rounded-xl border bg-background px-4 py-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-2">
              <Clock className="size-4 text-muted-foreground" />
              Test Clock Status
            </span>
            <Badge className={clockActive ? "bg-emerald-600" : "bg-muted text-muted-foreground"}>
              {clockActive ? "Enabled" : "Not enabled"}
            </Badge>
          </div>

          {clock.test_clock_id ? (
            <div className="text-xs text-muted-foreground space-y-1 font-mono">
              <p>ID: {clock.test_clock_id}</p>
              {clock.frozen_time_human && (
                <p>Simulated time: {new Date(clock.frozen_time_human).toLocaleString("en-CA")}</p>
              )}
              {clock.status && <p>Stripe status: {clock.status}</p>}
            </div>
          ) : (
            <p className="text-xs text-amber-700">{clock.message}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          {!clock.test_clock_id ? (
            <Button
              onClick={enableClock}
              disabled={!!busy}
              className="gap-2 bg-amber-600 hover:bg-amber-700"
            >
              {busy === "enable" ? (
                <RefreshCw className="size-4 animate-spin" />
              ) : (
                <Timer className="size-4" />
              )}
              Enable Test Clock
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => advanceClock("monthly")}
                disabled={!!busy}
                className="gap-2"
              >
                {busy === "advance-monthly" ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <FastForward className="size-4" />
                )}
                Advance +1 Month
              </Button>
              <Button
                variant="outline"
                onClick={() => advanceClock("yearly")}
                disabled={!!busy}
                className="gap-2"
              >
                {busy === "advance-yearly" ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <FastForward className="size-4" />
                )}
                Advance +1 Year
              </Button>
              <Button
                variant="secondary"
                onClick={() => syncSubscriptions()}
                disabled={!!busy}
                className="gap-2"
              >
                {busy === "sync" ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Sync from Stripe
              </Button>
            </>
          )}
        </div>

        {/* Sync results */}
        {syncResults && syncResults.length > 0 && (
          <div className="rounded-xl border bg-background overflow-hidden">
            <div className="px-4 py-2 bg-muted/50 text-xs font-medium">Sync Results</div>
            <div className="divide-y text-xs">
              {syncResults.map((r) => (
                <div key={r.id} className="px-4 py-2.5 flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{r.user ?? `Subscription #${r.id}`}</p>
                    {r.success ? (
                      <p className="text-muted-foreground mt-0.5">
                        Status: {r.status}
                        {r.ends_at && ` · Expires: ${new Date(r.ends_at).toLocaleDateString("en-CA")}`}
                        {r.last_payment_at && ` · Last paid: ${new Date(r.last_payment_at).toLocaleDateString("en-CA")}`}
                      </p>
                    ) : (
                      <p className="text-red-600 mt-0.5">{r.error}</p>
                    )}
                  </div>
                  {r.success ? (
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="size-4 text-red-500 shrink-0 mt-0.5" />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          <strong>Tip:</strong> For real-time webhook testing, also run{" "}
          <code className="bg-muted px-1 rounded">stripe listen --forward-to localhost:8000/api/v1/webhooks/stripe</code>
          . Without CLI, use <strong>Sync from Stripe</strong> after advancing the clock.
        </p>
      </CardContent>
    </Card>
  );
}

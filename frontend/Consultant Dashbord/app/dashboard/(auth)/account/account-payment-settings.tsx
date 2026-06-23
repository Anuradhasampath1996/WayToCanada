"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, Loader2, Wallet, Building2, CheckCircle2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

function authHeaders(json = true): Record<string, string> {
  const token =
    (typeof document !== "undefined"
      ? document.cookie.match(/wtc_consultant_token=([^;]+)/)?.[1]
      : undefined) ?? localStorage.getItem("wtc_consultant_token") ?? "";
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    Accept: "application/json",
  };
}

type PaymentAccount = {
  stripe_connect_account_id: string | null;
  stripe_charges_enabled: boolean;
  stripe_details_submitted: boolean;
  stripe_ready: boolean;
  paypal_email: string | null;
  paypal_me_username: string | null;
  paypal_ready: boolean;
  interac_email: string | null;
  interac_ready: boolean;
  preferred_provider: "stripe" | "paypal" | "interac";
};

export function AccountPaymentSettings({ onStripeReturn }: { onStripeReturn?: boolean }) {
  const [account, setAccount] = useState<PaymentAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [paypalEmail, setPaypalEmail] = useState("");
  const [paypalMe, setPaypalMe] = useState("");
  const [interacEmail, setInteracEmail] = useState("");
  const [preferred, setPreferred] = useState<"stripe" | "paypal" | "interac">("stripe");
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/consultant/payment-account`, { headers: authHeaders() });
      const data: PaymentAccount = await res.json();
      setAccount(data);
      setPaypalEmail(data.paypal_email ?? "");
      setPaypalMe(data.paypal_me_username ?? "");
      setInteracEmail(data.interac_email ?? "");
      setPreferred(data.preferred_provider ?? "stripe");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!onStripeReturn) return;
    (async () => {
      await fetch(`${API}/consultant/payment-account/stripe/sync`, { method: "POST", headers: authHeaders() });
      await load();
      setMessage("Stripe account updated.");
    })();
  }, [onStripeReturn, load]);

  async function saveSettings() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/consultant/payment-account`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          paypal_email: paypalEmail || null,
          paypal_me_username: paypalMe || null,
          interac_email: interacEmail || null,
          preferred_provider: preferred,
        }),
      });
      const data = await res.json();
      setAccount(data);
      setMessage("Payment settings saved.");
    } finally {
      setSaving(false);
    }
  }

  async function connectStripe() {
    setConnecting(true);
    setMessage(null);
    try {
      const res = await fetch(`${API}/consultant/payment-account/stripe/connect`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else setMessage(data.message ?? "Could not start Stripe Connect.");
    } finally {
      setConnecting(false);
    }
  }

  async function openStripeDashboard() {
    const res = await fetch(`${API}/consultant/payment-account/stripe/dashboard`, {
      method: "POST",
      headers: authHeaders(),
    });
    const data = await res.json();
    if (data.url) window.open(data.url, "_blank");
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading payment settings…
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Connect how you want to collect fees from clients. When you send a payment request, clients pay through your linked method.
        </p>
        {message && <p className="mt-2 break-words text-sm text-emerald-600">{message}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {/* Stripe */}
        <div className={cn("space-y-3 rounded-xl border bg-muted/15 p-4", preferred === "stripe" && "ring-2 ring-emerald-500/30 border-emerald-200/50")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <CreditCard className="h-4 w-4 shrink-0 text-violet-600" /> Stripe
            </div>
            {account?.stripe_ready
              ? <Badge className="gap-1 bg-emerald-600"><CheckCircle2 className="h-3 w-3" /> Ready</Badge>
              : <Badge variant="secondary">Not connected</Badge>}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">Card payments — recommended for online checkout in Canada.</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button size="sm" className="h-10 w-full sm:w-auto" onClick={connectStripe} disabled={connecting}>
              {connecting ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              {account?.stripe_connect_account_id ? "Update Stripe account" : "Connect Stripe"}
            </Button>
            {account?.stripe_connect_account_id && (
              <Button size="sm" variant="outline" className="h-10 w-full sm:w-auto" onClick={openStripeDashboard}>
                <ExternalLink className="mr-1 h-3.5 w-3.5" /> Dashboard
              </Button>
            )}
          </div>
        </div>

        {/* PayPal */}
        <div className={cn("space-y-3 rounded-xl border bg-muted/15 p-4", preferred === "paypal" && "ring-2 ring-emerald-500/30 border-emerald-200/50")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Wallet className="h-4 w-4 shrink-0 text-blue-600" /> PayPal
            </div>
            {account?.paypal_ready
              ? <Badge className="gap-1 bg-emerald-600"><CheckCircle2 className="h-3 w-3" /> Ready</Badge>
              : <Badge variant="secondary">Not set</Badge>}
          </div>
          <Input placeholder="PayPal email" value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} className="h-10 text-sm" />
          <Input placeholder="PayPal.me username (optional)" value={paypalMe} onChange={(e) => setPaypalMe(e.target.value)} className="h-10 text-sm" />
        </div>

        {/* Interac */}
        <div className={cn("space-y-3 rounded-xl border bg-muted/15 p-4 sm:col-span-2 xl:col-span-1", preferred === "interac" && "ring-2 ring-emerald-500/30 border-emerald-200/50")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 text-sm font-semibold">
              <Building2 className="h-4 w-4 shrink-0 text-amber-600" />
              <span className="break-words">Interac e-Transfer</span>
            </div>
            {account?.interac_ready
              ? <Badge className="shrink-0 gap-1 bg-emerald-600"><CheckCircle2 className="h-3 w-3" /> Ready</Badge>
              : <Badge variant="secondary" className="shrink-0">Not set</Badge>}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">Popular in Canada — clients send e-Transfer to your email.</p>
          <Input placeholder="Interac deposit email" value={interacEmail} onChange={(e) => setInteracEmail(e.target.value)} className="h-10 text-sm" />
        </div>
      </div>

      <div className="space-y-3 rounded-xl border bg-muted/15 p-4 sm:p-5">
        <p className="text-sm font-semibold">Default payment method for new requests</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {(["stripe", "paypal", "interac"] as const).map((p) => (
            <Button
              key={p}
              type="button"
              size="sm"
              variant={preferred === p ? "default" : "outline"}
              onClick={() => setPreferred(p)}
              className={cn("h-10 w-full sm:w-auto", preferred === p ? "bg-emerald-600 hover:bg-emerald-700" : "")}
            >
              {p === "stripe" ? "Stripe" : p === "paypal" ? "PayPal" : "Interac"}
            </Button>
          ))}
        </div>
        <Button onClick={saveSettings} disabled={saving} className="h-10 w-full bg-emerald-600 hover:bg-emerald-700 sm:w-auto">
          {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
          Save payment settings
        </Button>
      </div>
    </div>
  );
}

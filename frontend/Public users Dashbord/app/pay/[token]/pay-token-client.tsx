"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2, Loader2, CreditCard, Wallet, Building2, AlertCircle, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type PaymentData = {
  title: string;
  description: string | null;
  amount: number;
  currency: string;
  provider: string;
  status: string;
  is_payable: boolean;
  consultant: { name: string; company_name: string | null };
  client_name: string | null;
  interac_email: string | null;
};

export function PayTokenClient({ token }: { token: string }) {
  const searchParams = useSearchParams();
  const [data, setData] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`${API}/payment-request/${token}`);
    if (!res.ok) {
      setError("Payment request not found or expired.");
      setLoading(false);
      return;
    }
    setData(await res.json());
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const paid = searchParams.get("paid");
    if (!sessionId || paid !== "1") return;

    fetch(`${API}/payment-request/${token}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ session_id: sessionId }),
    })
      .then((r) => r.json())
      .then(() => load());
  }, [searchParams, token, load]);

  async function startCheckout() {
    setPaying(true);
    setError(null);
    try {
      const res = await fetch(`${API}/payment-request/${token}/checkout`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Could not start checkout");

      if (json.checkout_url) {
        window.location.href = json.checkout_url;
        return;
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Payment failed");
    } finally {
      setPaying(false);
    }
  }

  async function confirmManualSent() {
    setPaying(true);
    try {
      const res = await fetch(`${API}/payment-request/${token}/confirm-sent`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Could not confirm");
      setConfirmed(true);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not confirm");
    } finally {
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" /> Loading payment request…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-3" />
            <p className="font-medium">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const paid = data.status === "paid";
  const awaiting = data.status === "awaiting_confirmation";

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4 md:p-8 bg-gradient-to-br from-emerald-50/50 via-background to-background">
      <Card className="w-full max-w-lg shadow-lg border-border/80">
        <CardHeader className="text-center pb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600 mb-2">Payment request</p>
          <CardTitle className="text-2xl">{data.title}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            From {data.consultant.company_name || data.consultant.name}
          </p>
        </CardHeader>
        <CardContent className="space-y-6 pb-8">
          <div className="rounded-2xl border bg-muted/30 p-6 text-center">
            <p className="text-sm text-muted-foreground">Amount due</p>
            <p className="text-4xl font-bold text-emerald-700 mt-1">
              ${data.amount.toFixed(2)} <span className="text-lg font-semibold">{data.currency}</span>
            </p>
            {data.description && (
              <p className="text-sm text-muted-foreground mt-3">{data.description}</p>
            )}
          </div>

          {paid && (
            <div className="flex flex-col items-center gap-2 text-emerald-700 py-4">
              <CheckCircle2 className="h-12 w-12" />
              <p className="font-semibold text-lg">Payment received — thank you!</p>
            </div>
          )}

          {awaiting && !paid && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 text-center">
              Your consultant will confirm once they receive your payment.
            </div>
          )}

          {confirmed && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 text-center">
              Thank you — we&apos;ve notified your consultant.
            </div>
          )}

          {data.is_payable && !paid && (
            <div className="space-y-3">
              {data.provider === "stripe" && (
                <Button className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-base" onClick={startCheckout} disabled={paying}>
                  {paying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
                  Pay with card (Stripe)
                </Button>
              )}

              {data.provider === "paypal" && (
                <>
                  <Button className="w-full h-12 bg-[#0070ba] hover:bg-[#005ea6] text-base" onClick={startCheckout} disabled={paying}>
                    {paying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wallet className="h-4 w-4 mr-2" />}
                    Pay with PayPal
                    <ExternalLink className="h-4 w-4 ml-2 opacity-70" />
                  </Button>
                  <Button variant="outline" className="w-full" onClick={confirmManualSent} disabled={paying}>
                    I&apos;ve completed the PayPal payment
                  </Button>
                </>
              )}

              {data.provider === "interac" && data.interac_email && (
                <div className="space-y-3">
                  <div className="rounded-xl border p-4 space-y-2">
                    <div className="flex items-center gap-2 font-semibold text-sm">
                      <Building2 className="h-4 w-4 text-amber-600" /> Interac e-Transfer
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Send <strong>${data.amount.toFixed(2)} CAD</strong> to:
                    </p>
                    <p className="font-mono text-sm font-semibold bg-muted rounded-lg px-3 py-2">{data.interac_email}</p>
                    <p className="text-xs text-muted-foreground">
                      Use memo/reference: <strong>{data.title}</strong>
                    </p>
                  </div>
                  <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={confirmManualSent} disabled={paying}>
                    I&apos;ve sent the e-Transfer
                  </Button>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-600 text-center">{error}</p>}

          <div className="flex justify-center">
            <Badge variant="outline" className="capitalize">{data.provider}</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

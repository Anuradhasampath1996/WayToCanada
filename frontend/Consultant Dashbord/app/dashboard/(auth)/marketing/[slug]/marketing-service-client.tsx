"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Loader2, ChevronLeft, CheckCircle2, CreditCard, Globe, Share2, Target, Megaphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

const ICONS: Record<string, typeof Globe> = {
  "website-builder": Globe,
  "social-media": Share2,
  "google-ads": Target,
};

type Service = {
  id: number;
  slug: string;
  name: string;
  tagline: string | null;
  summary: string | null;
  detail_body: string | null;
  features: string[];
  price: number;
  price_label: string;
  billing_type: string;
};

type TaxQuote = {
  subtotal: number;
  total_tax: number;
  total: number;
  lines?: { label: string; amount: number }[];
};

function authHeaders(json = true): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
  return {
    Accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function fmtPrice(price: number, label: string) {
  const formatted = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(price);
  return label ? `${formatted} ${label}` : formatted;
}

export function MarketingServiceClient({ slug }: { slug: string }) {
  const searchParams = useSearchParams();
  const [service, setService] = useState<Service | null>(null);
  const [owned, setOwned] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [province, setProvince] = useState("ON");
  const [tax, setTax] = useState<TaxQuote | null>(null);
  const [taxLoading, setTaxLoading] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  };

  useEffect(() => {
    if (searchParams.get("checkout") === "cancelled") {
      showToast("Checkout was cancelled.");
    }
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [svcRes, ordRes] = await Promise.all([
        fetch(`${API}/marketing-services/${slug}`, { headers: authHeaders() }),
        fetch(`${API}/consultant/marketing/orders`, { headers: authHeaders() }),
      ]);
      const svcJson = await svcRes.json();
      const ordJson = await ordRes.json();
      if (!svcRes.ok) throw new Error(svcJson?.message ?? "Service not found.");
      setService(svcJson.data);
      const slugs = (ordJson.data ?? []).map((o: { service_slug: string }) => o.service_slug);
      setOwned(slugs.includes(slug));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load service.");
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadTax = useCallback(async () => {
    if (!service) return;
    setTaxLoading(true);
    try {
      const params = new URLSearchParams({
        marketing_service_id: String(service.id),
        province,
      });
      const res = await fetch(`${API}/consultant/marketing/payment/tax-quote?${params}`, {
        headers: authHeaders(),
      });
      const json = await res.json();
      if (res.ok) setTax(json.tax ?? null);
    } finally {
      setTaxLoading(false);
    }
  }, [service, province]);

  useEffect(() => {
    if (service && !owned) void loadTax();
  }, [service, owned, loadTax]);

  async function startCheckout() {
    if (!service || owned) return;
    setCheckingOut(true);
    try {
      const res = await fetch(`${API}/consultant/marketing/payment/checkout-session`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ marketing_service_id: service.id, province }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? "Checkout failed.");
      if (json.url) window.location.href = json.url;
      else throw new Error("No checkout URL returned.");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Could not start checkout.");
      setCheckingOut(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-muted-foreground">
        <Loader2 className="mr-2 size-5 animate-spin" /> Loading…
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-destructive">{error || "Service not found."}</p>
        <Button asChild variant="outline"><Link href="/dashboard/marketing">Back to Marketing</Link></Button>
      </div>
    );
  }

  const Icon = ICONS[service.slug] ?? Megaphone;

  return (
    <div className="space-y-6 pb-10">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-xl border bg-background px-4 py-2 text-sm shadow-lg">{toast}</div>
      )}

      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href="/dashboard/marketing"><ChevronLeft className="mr-1 size-4" /> Back to Marketing</Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-background to-violet-500/5 p-6">
            <div className="flex flex-wrap items-start gap-4">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-700">
                <Icon className="size-7" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold">{service.name}</h1>
                  {owned && <Badge className="gap-1 bg-emerald-600"><CheckCircle2 className="size-3" /> Purchased</Badge>}
                </div>
                {service.tagline && <p className="mt-1 text-muted-foreground">{service.tagline}</p>}
              </div>
            </div>
          </div>

          {service.features?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">What&apos;s included</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {service.features.map((f) => (
                    <li key={f} className="flex gap-2 text-sm">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Full details</CardTitle>
              <CardDescription>{service.summary}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {service.detail_body ?? service.summary}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="sticky top-4 border-violet-500/20 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Get started</CardTitle>
              <CardDescription>
                {owned
                  ? "You have already purchased this service. Our team will contact you."
                  : "Secure payment via Stripe. GST/HST applies based on your province."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-3xl font-bold">{fmtPrice(service.price, service.price_label)}</p>

              {!owned && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="province">Province (for tax)</Label>
                    <Input
                      id="province"
                      value={province}
                      onChange={(e) => setProvince(e.target.value.toUpperCase().slice(0, 2))}
                      maxLength={2}
                      placeholder="ON"
                    />
                  </div>

                  {taxLoading ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="size-3 animate-spin" /> Calculating tax…
                    </p>
                  ) : tax ? (
                    <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
                      <div className="flex justify-between"><span>Subtotal</span><span>{fmtPrice(tax.subtotal, "")}</span></div>
                      <div className="flex justify-between text-muted-foreground"><span>Tax</span><span>{fmtPrice(tax.total_tax, "")}</span></div>
                      <div className="flex justify-between font-semibold border-t pt-1"><span>Total</span><span>{fmtPrice(tax.total, "")}</span></div>
                    </div>
                  ) : null}

                  <Button
                    className="w-full gap-2"
                    size="lg"
                    disabled={checkingOut || service.price <= 0}
                    onClick={() => void startCheckout()}
                  >
                    {checkingOut ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
                    {checkingOut ? "Redirecting to Stripe…" : "Pay & request service"}
                  </Button>
                </>
              )}

              {owned && (
                <div className={cn("rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900")}>
                  Thank you! Our marketing team will reach out within 2 business days.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

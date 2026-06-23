"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Loader2, ChevronLeft, CheckCircle2, CreditCard, Globe, Share2, Target, Megaphone, MapPin, Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

const ICONS: Record<string, typeof Globe> = {
  "website-builder": Globe,
  "social-media": Share2,
  "google-ads": Target,
};

type ProvinceOption = { code: string; name: string; label: string };

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
  tax_label?: string;
  tax_applicable?: boolean;
  disclaimer?: string;
};

function authHeaders(json = true): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
  return {
    Accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function fmtPrice(price: number, label = "") {
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
  const [provinces, setProvinces] = useState<ProvinceOption[]>([]);
  const [billingCountry, setBillingCountry] = useState("CA");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [province, setProvince] = useState("");
  const [tax, setTax] = useState<TaxQuote | null>(null);
  const [taxLoading, setTaxLoading] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);

  const isCanada = billingCountry === "CA";

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  };

  useEffect(() => {
    if (searchParams.get("checkout") === "cancelled") {
      showToast("Checkout was cancelled.");
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadProvincesAndProfile() {
      try {
        const [ratesRes, profileRes] = await Promise.all([
          fetch(`${API}/tax/gst-hst/rates`, { headers: { Accept: "application/json" } }),
          fetch(`${API}/consultant/profile`, { headers: authHeaders(false) }),
        ]);

        const ratesJson = ratesRes.ok ? await ratesRes.json() : null;
        const profileJson = profileRes.ok ? await profileRes.json() : null;

        if (cancelled) return;

        const opts: ProvinceOption[] = ratesJson?.provinces ?? [];
        setProvinces(opts);

        const fromProfile = profileJson?.company_province ?? "";
        if (fromProfile) {
          const match = opts.find(
            (p) => p.code === fromProfile.toUpperCase() || p.name.toLowerCase() === fromProfile.toLowerCase(),
          );
          setProvince(match?.code ?? fromProfile);
        } else if (opts.length > 0) {
          setProvince(opts.find((p) => p.code === "ON")?.code ?? opts[0].code);
        }

        if (profileJson) {
          const country = profileJson.company_country;
          setBillingCountry(
            country === "Canada" || country === "CA" ? "CA" : (country ?? "CA"),
          );
          setAddressLine1(profileJson.company_address_line1 ?? "");
          setAddressLine2(profileJson.company_address_line2 ?? "");
          setCity(profileJson.company_city ?? "");
          setPostalCode(profileJson.company_postal_code ?? "");
        }
      } catch {
        /* optional */
      }
    }

    void loadProvincesAndProfile();
    return () => { cancelled = true; };
  }, []);

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

  const billingPayload = useCallback(() => {
    if (!service) return null;
    return {
      marketing_service_id: service.id,
      billing_country: billingCountry,
      billing_address_line1: addressLine1.trim(),
      billing_address_line2: addressLine2.trim() || undefined,
      billing_city: city.trim(),
      billing_postal_code: postalCode.trim() || undefined,
      billing_province: isCanada ? province : undefined,
      province: isCanada ? province : undefined,
    };
  }, [service, billingCountry, addressLine1, addressLine2, city, postalCode, province, isCanada]);

  const loadTax = useCallback(async () => {
    const payload = billingPayload();
    if (!payload || !addressLine1.trim() || !city.trim()) return;
    if (isCanada && !province) return;

    setTaxLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(payload).forEach(([k, v]) => {
        if (v !== undefined && v !== null) params.set(k, String(v));
      });
      const res = await fetch(`${API}/consultant/marketing/payment/tax-quote?${params}`, {
        headers: authHeaders(false),
      });
      const json = await res.json();
      if (res.ok) setTax(json.tax ?? null);
      else setTax(null);
    } finally {
      setTaxLoading(false);
    }
  }, [billingPayload, addressLine1, city, isCanada, province]);

  useEffect(() => {
    if (service && !owned) void loadTax();
  }, [service, owned, loadTax]);

  async function startCheckout() {
    const payload = billingPayload();
    if (!payload || owned) return;
    setCheckingOut(true);
    try {
      const res = await fetch(`${API}/consultant/marketing/payment/checkout-session`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
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

  const canCheckout =
    !owned &&
    service &&
    service.price > 0 &&
    addressLine1.trim() &&
    city.trim() &&
    (!isCanada || province) &&
    !taxLoading &&
    !checkingOut;

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
                  : "Same secure checkout as your RCICMASTER subscription — billing address and tax calculated before Stripe."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-3xl font-bold">{fmtPrice(service.price, service.price_label)}</p>

              {!owned && (
                <>
                  <div className="space-y-3 rounded-lg border border-border/60 bg-muted/10 p-3">
                    <p className="text-sm font-medium">Billing address</p>

                    <div className="space-y-1.5">
                      <Label htmlFor="country">Country</Label>
                      <Select value={billingCountry} onValueChange={setBillingCountry}>
                        <SelectTrigger id="country" className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CA">Canada</SelectItem>
                          <SelectItem value="US">United States</SelectItem>
                          <SelectItem value="GB">United Kingdom</SelectItem>
                          <SelectItem value="IN">India</SelectItem>
                          <SelectItem value="OTHER">Outside Canada (other)</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-[11px] text-muted-foreground">
                        {isCanada
                          ? "Canadian GST/HST applies based on your province of supply."
                          : "No Canadian sales tax — recipient located outside Canada."}
                      </p>
                    </div>

                    <Input
                      placeholder="Street address"
                      value={addressLine1}
                      onChange={(e) => setAddressLine1(e.target.value)}
                    />
                    <Input
                      placeholder="Apartment, suite (optional)"
                      value={addressLine2}
                      onChange={(e) => setAddressLine2(e.target.value)}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
                      <Input placeholder="Postal / ZIP" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
                    </div>

                    {isCanada && (
                      <div className="space-y-1.5">
                        <Label htmlFor="province" className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          Province (place of supply)
                        </Label>
                        <Select value={province} onValueChange={setProvince} disabled={provinces.length === 0}>
                          <SelectTrigger id="province" className="w-full">
                            <SelectValue placeholder="Select province" />
                          </SelectTrigger>
                          <SelectContent>
                            {provinces.map((p) => (
                              <SelectItem key={p.code} value={p.code}>
                                {p.name} — {p.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {taxLoading ? (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Loader2 className="size-3 animate-spin" /> Calculating tax…
                    </p>
                  ) : tax ? (
                    <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span>{fmtPrice(tax.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>
                          Tax{tax.tax_label ? ` (${tax.tax_label})` : ""}
                        </span>
                        <span>{tax.tax_applicable === false ? "—" : fmtPrice(tax.total_tax)}</span>
                      </div>
                      {tax.disclaimer && (
                        <p className="text-[11px] text-muted-foreground pt-1">{tax.disclaimer}</p>
                      )}
                      <div className="flex justify-between font-semibold border-t pt-1">
                        <span>Total</span>
                        <span>{fmtPrice(tax.total)}</span>
                      </div>
                    </div>
                  ) : null}

                  <Button
                    className="w-full gap-2"
                    size="lg"
                    disabled={!canCheckout}
                    onClick={() => void startCheckout()}
                  >
                    {checkingOut ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4" />}
                    {checkingOut ? "Redirecting to Stripe…" : "Continue to Stripe"}
                  </Button>

                  <p className="text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1">
                    <Lock className="h-3 w-3" />
                    Payments secured by Stripe
                  </p>
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

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SubscriptionPackage } from "@/lib/subscription-packages";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

function fmtPrice(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 }).format(value);
}

function yearlySavings(monthly: number | null, yearly: number | null) {
  if (!monthly || !yearly || monthly <= 0) return null;
  const annualMonthly = monthly * 12;
  if (annualMonthly <= yearly) return null;
  return Math.round(((annualMonthly - yearly) / annualMonthly) * 100);
}

export function LandingPricing() {
  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/subscription-packages`, { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json) => setPackages(json.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  const popularId = packages.length > 1 ? packages[1]?.id ?? packages[0]?.id : packages[0]?.id;

  return (
    <section id="pricing" className="scroll-mt-24 bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c8102e]">Pricing</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-black sm:text-4xl">
            Plans for every practice size
          </h2>
          <p className="mt-4 text-muted-foreground">
            Transparent monthly or yearly plans. All packages include the consultant dashboard,
            client portal tools, and mobile app access.
          </p>
        </div>

        <div className="mx-auto mt-10 flex w-fit items-center gap-1 rounded-xl border border-border/80 bg-muted/40 p-1">
          {(["monthly", "yearly"] as const).map((cycle) => (
            <button
              key={cycle}
              type="button"
              onClick={() => setBilling(cycle)}
              className={cn(
                "rounded-lg px-5 py-2 text-sm font-semibold capitalize transition-colors",
                billing === cycle ? "bg-[#c8102e] text-white shadow-sm" : "text-neutral-600 hover:text-black",
              )}
            >
              {cycle}
              {cycle === "yearly" && (
                <span className="ml-1.5 text-xs font-medium text-[#c8102e]">Save more</span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-[#c8102e]" />
          </div>
        ) : packages.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">
            Pricing plans coming soon.{" "}
            <Link href="/register" className="font-medium text-[#c8102e] underline-offset-4 hover:underline">
              Register free
            </Link>{" "}
            to get started.
          </p>
        ) : (
          <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {packages.map((pkg) => {
              const price = billing === "yearly" ? pkg.yearly_price : pkg.monthly_price;
              const savings = billing === "yearly" ? yearlySavings(pkg.monthly_price, pkg.yearly_price) : null;
              const isPopular = pkg.id === popularId;
              const features = pkg.features ?? [];

              return (
                <div
                  key={pkg.id}
                  className={cn(
                    "relative flex flex-col rounded-2xl border bg-white p-7 shadow-sm transition-shadow hover:shadow-lg",
                    isPopular ? "rcx-pricing-popular" : "border-neutral-200",
                  )}
                >
                  {isPopular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#c8102e] px-3 py-1 text-xs font-semibold text-white shadow">
                      Most popular
                    </span>
                  )}

                  <div>
                    <h3 className="text-lg font-bold">{pkg.name}</h3>
                    {pkg.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{pkg.description}</p>
                    )}
                  </div>

                  <div className="mt-5 flex items-end gap-1">
                    <span className="text-4xl font-extrabold tracking-tight">{fmtPrice(price)}</span>
                    <span className="mb-1.5 text-sm text-muted-foreground">
                      /{billing === "yearly" ? "year" : "month"}
                    </span>
                  </div>

                  {savings != null && savings > 0 && (
                    <p className="mt-1 text-xs font-medium text-[#c8102e]">Save {savings}% vs monthly</p>
                  )}

                  {pkg.free_trial_days != null && pkg.free_trial_days > 0 && (
                    <div className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-[#c8102e]">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {pkg.free_trial_days}-day free trial
                    </div>
                  )}

                  {features.length > 0 && (
                    <ul className="mt-6 flex-1 space-y-2.5 border-t border-border/60 pt-6">
                      {features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#c8102e]" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}

                  <Button
                    className={cn("mt-6 w-full rounded-md", isPopular && "bg-[#c8102e] hover:bg-[#a00d24]")}
                    variant={isPopular ? "default" : "outline"}
                    asChild
                  >
                    <Link href="/register">Get started</Link>
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <p className="mx-auto mt-10 max-w-xl text-center text-xs text-muted-foreground">
          Secure payments · Cancel anytime · GST/HST applied at checkout · Mobile app included
        </p>
      </div>
    </section>
  );
}

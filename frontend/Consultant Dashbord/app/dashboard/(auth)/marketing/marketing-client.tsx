"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2, Megaphone, Globe, Share2, Target, ArrowRight, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type MarketingService = {
  id: number;
  slug: string;
  name: string;
  tagline: string | null;
  summary: string | null;
  features: string[];
  price: number;
  price_label: string;
  billing_type: string;
};

type Order = { service_slug: string; status: string };

const ICONS: Record<string, typeof Globe> = {
  "website-builder": Globe,
  "social-media": Share2,
  "google-ads": Target,
};

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function fmtPrice(price: number, label: string) {
  const formatted = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(price);
  return label ? `${formatted} ${label}` : formatted;
}

export function MarketingClient() {
  const [services, setServices] = useState<MarketingService[]>([]);
  const [purchased, setPurchased] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [svcRes, ordRes] = await Promise.all([
        fetch(`${API}/marketing-services`, { headers: authHeaders() }),
        fetch(`${API}/consultant/marketing/orders`, { headers: authHeaders() }),
      ]);
      const svcJson = await svcRes.json();
      const ordJson = await ordRes.json();
      if (!svcRes.ok) throw new Error(svcJson?.message ?? "Failed to load services.");
      setServices(svcJson.data ?? []);
      const slugs = new Set<string>(
        (ordJson.data ?? []).map((o: Order) => o.service_slug).filter(Boolean),
      );
      setPurchased(slugs);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load marketing services.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6 pb-10">
      <section className="rounded-2xl border border-border/70 bg-gradient-to-br from-background via-background to-violet-500/5 p-5 shadow-sm">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <span className="flex size-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-700">
            <Megaphone className="size-5" />
          </span>
          Marketing Services
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Grow your RCIC practice with websites, social media, and Google Ads — managed through WayToCanada.
          Pay online and our team will get you started.
        </p>
      </section>

      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="mr-2 size-5 animate-spin" /> Loading services…
        </div>
      ) : error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {services.map((svc) => {
            const Icon = ICONS[svc.slug] ?? Megaphone;
            const owned = purchased.has(svc.slug);
            return (
              <Card key={svc.id} className={cn("flex flex-col border-border/70", owned && "ring-1 ring-emerald-500/30")}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <span className="flex size-11 items-center justify-center rounded-xl bg-violet-500/10 text-violet-700">
                      <Icon className="size-5" />
                    </span>
                    {owned && (
                      <Badge className="gap-1 bg-emerald-600">
                        <CheckCircle2 className="size-3" /> Active
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg">{svc.name}</CardTitle>
                  <CardDescription>{svc.tagline ?? svc.summary}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <p className="line-clamp-3 text-sm text-muted-foreground">{svc.summary}</p>
                  {svc.features?.length > 0 && (
                    <ul className="space-y-1.5 text-xs text-muted-foreground">
                      {svc.features.slice(0, 3).map((f) => (
                        <li key={f} className="flex gap-2">
                          <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-emerald-600" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-auto space-y-3 border-t border-border/50 pt-4">
                    <p className="text-xl font-bold text-foreground">
                      {fmtPrice(svc.price, svc.price_label)}
                    </p>
                    <Button asChild className="w-full gap-1.5">
                      <Link href={`/dashboard/marketing/${svc.slug}`}>
                        Read more <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar, CheckCircle2, Clock, CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ClientActivityEvent } from "@/lib/client-journey";
import { CLIENT_API, clientAuthHeaders } from "@/lib/client-api";

type UpcomingMeeting = {
  id: number;
  title: string;
  scheduled_at: string;
  timezone: string;
  duration_minutes: number;
  invite_url: string;
  is_upcoming: boolean;
};

type UpcomingPayment = {
  id: number;
  title: string;
  amount: number;
  currency: string;
  pay_url: string;
  is_payable: boolean;
};

type TimelineEntry = {
  id: string;
  kind: "upcoming" | "past";
  label: string;
  at: string;
  href?: string;
  actionLabel?: string;
};

function fmtDate(iso: string, withTime = false) {
  const opts: Intl.DateTimeFormatOptions = withTime
    ? { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }
    : { month: "short", day: "numeric", year: "numeric" };
  return new Date(iso).toLocaleString("en-CA", opts);
}

function externalPath(url: string) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export function ClientCaseTimeline({
  milestones,
}: {
  milestones: ClientActivityEvent[];
}) {
  const [meetings, setMeetings] = useState<UpcomingMeeting[]>([]);
  const [payments, setPayments] = useState<UpcomingPayment[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const headers = clientAuthHeaders(false);

    Promise.all([
      fetch(`${CLIENT_API}/client/meetings`, { headers }),
      fetch(`${CLIENT_API}/client/payment-requests`, { headers }),
    ])
      .then(async ([meetRes, payRes]) => {
        const meetJson = meetRes.ok ? await meetRes.json() : { data: [] };
        const payJson = payRes.ok ? await payRes.json() : { data: [] };
        if (cancelled) return;
        setMeetings((meetJson.data ?? []).filter((m: UpcomingMeeting) => m.is_upcoming));
        setPayments((payJson.data ?? []).filter((p: UpcomingPayment) => p.is_payable));
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => { cancelled = true; };
  }, []);

  const upcoming = useMemo((): TimelineEntry[] => {
    const items: TimelineEntry[] = [];

    for (const m of meetings) {
      items.push({
        id: `meet-${m.id}`,
        kind: "upcoming",
        label: m.title,
        at: m.scheduled_at,
        href: externalPath(m.invite_url),
        actionLabel: "View meeting",
      });
    }

    for (const p of payments) {
      items.push({
        id: `pay-${p.id}`,
        kind: "upcoming",
        label: `Payment due: ${p.title}`,
        at: new Date().toISOString(),
        href: externalPath(p.pay_url),
        actionLabel: "Pay now",
      });
    }

    return items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  }, [meetings, payments]);

  const past = useMemo((): TimelineEntry[] => {
    return milestones
      .filter((m) => m.done && m.at)
      .map((m) => ({
        id: m.id,
        kind: "past" as const,
        label: m.label,
        at: m.at!,
      }))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [milestones]);

  const pending = milestones.filter((m) => !m.done);

  return (
    <div className="rounded-xl border bg-card p-5 space-y-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Case timeline
      </p>

      {loaded && upcoming.length > 0 && (
        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">Upcoming</p>
          <ul className="space-y-2">
            {upcoming.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 rounded-lg border border-blue-200/60 bg-blue-50/40 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-2">
                  {item.id.startsWith("meet-") ? (
                    <Calendar className="size-4 shrink-0 text-blue-700 mt-0.5" />
                  ) : (
                    <CreditCard className="size-4 shrink-0 text-amber-700 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {item.id.startsWith("meet-") ? fmtDate(item.at, true) : "Due now"}
                    </p>
                  </div>
                </div>
                {item.href && item.actionLabel && (
                  <Button size="sm" variant="outline" className="h-8 shrink-0 rounded-lg" asChild>
                    <Link href={item.href}>{item.actionLabel}</Link>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800">Completed</p>
          <ul className="space-y-0">
            {past.map((item, i) => (
              <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
                {i < past.length - 1 && (
                  <span className="absolute left-[15px] top-8 bottom-0 w-px bg-emerald-200" />
                )}
                <div className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700">
                  <CheckCircle2 className="size-4" />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{fmtDate(item.at)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pending.length > 0 && (
        <section className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">In progress</p>
          <ul className="space-y-2">
            {pending.map((m) => (
              <li key={m.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="size-3.5 shrink-0" />
                {m.label}
              </li>
            ))}
          </ul>
        </section>
      )}

      {loaded && upcoming.length === 0 && past.length === 0 && pending.length === 0 && (
        <p className="text-sm text-muted-foreground">Your case timeline will appear as you progress.</p>
      )}
    </div>
  );
}

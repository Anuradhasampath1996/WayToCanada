"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, Calendar, CheckCircle2, ClipboardList, CreditCard,
  FileText, FolderUp, Landmark, Loader2, MessageSquare, Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CLIENT_API, clientAuthHeaders } from "@/lib/client-api";
import { useClientJourney } from "@/context/client-journey-context";
import { caseManagementUnlocked, canAccessClientMessages } from "@/lib/client-journey";

type Tone = "warning" | "primary" | "info" | "success";

type ActionItem = {
  id: string;
  tone: Tone;
  title: string;
  description?: string;
  href?: string;
  buttonLabel: string;
  onAction?: () => Promise<void>;
  icon: React.ComponentType<{ className?: string }>;
};

const TONE_STYLES: Record<Tone, string> = {
  warning: "border-amber-200/80 bg-amber-50/40",
  primary: "border-primary/20 bg-primary/[0.04]",
  info: "border-blue-200/70 bg-blue-50/30",
  success: "border-emerald-200/70 bg-emerald-50/30",
};

function fmtMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function externalPath(url: string) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function fmtMeetingWhen(iso: string, timezone: string) {
  try {
    return new Date(iso).toLocaleString("en-CA", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timezone || undefined,
    });
  } catch {
    return new Date(iso).toLocaleString("en-CA");
  }
}

export function ClientActionCenter() {
  const {
    caseFile, verification, qStats, meta, applicationPackage,
  } = useClientJourney();

  const [dynamicItems, setDynamicItems] = useState<ActionItem[]>([]);
  const [loadingExtra, setLoadingExtra] = useState(true);

  const hasForms = (applicationPackage?.interactive_forms?.length ?? 0) > 0;
  const docsUnlocked = caseManagementUnlocked(caseFile, verification);

  const staticItems = useMemo((): ActionItem[] => {
    const items: ActionItem[] = [];

    if (qStats.pendingRefills > 0) {
      items.push({
        id: "refills",
        tone: "warning",
        title: `${qStats.pendingRefills} questionnaire correction${qStats.pendingRefills === 1 ? "" : "s"}`,
        description: "Your consultant flagged items to update in your profile.",
        href: "/user-dashboard/questionnaire",
        buttonLabel: "Fix now",
        icon: AlertTriangle,
      });
    } else if (!qStats.isSubmitted) {
      items.push({
        id: "questionnaire",
        tone: "primary",
        title: "Complete your questionnaire",
        description: "Fill in your profile so your consultant can assess eligibility.",
        href: "/user-dashboard/questionnaire",
        buttonLabel: "Open questionnaire",
        icon: ClipboardList,
      });
    }

    if (caseFile?.agreement_sent_at && !caseFile.agreement_signed_at) {
      items.push({
        id: "agreement",
        tone: "primary",
        title: "Sign your retainer agreement",
        description: "Review the terms and sign to move to the next stage.",
        href: "/user-dashboard/retainer-agreement",
        buttonLabel: "Sign agreement",
        icon: FileText,
      });
    }

    if (caseFile?.agreement_signed_at && hasForms && verification && !verification.all_submitted) {
      items.push({
        id: "forms",
        tone: "primary",
        title: "Complete application forms",
        description: `${verification.submitted_count}/${verification.total_forms} IRCC forms submitted.`,
        href: "/user-dashboard/application-forms",
        buttonLabel: "Continue forms",
        icon: FileText,
      });
    }

    if (docsUnlocked) {
      items.push({
        id: "documents",
        tone: "primary",
        title: "Upload case documents",
        description: "Your case hub is open — upload required documents and message your consultant.",
        href: "/user-dashboard/case-management",
        buttonLabel: "Open case hub",
        icon: FolderUp,
      });
    }

    if (meta.assessmentWaiting) {
      items.push({
        id: "assessment-wait",
        tone: "info",
        title: "Consultant is reviewing your profile",
        description: "Pathway confirmation is in progress — no action needed right now.",
        buttonLabel: "View status",
        href: "/user-dashboard",
        icon: ClipboardList,
      });
    }

    return items;
  }, [caseFile, verification, qStats, hasForms, docsUnlocked, meta.assessmentWaiting]);

  const loadExtras = useCallback(async () => {
    setLoadingExtra(true);
    try {
      const headers = clientAuthHeaders(false);
      const [payRes, meetRes, trustRes, unreadRes] = await Promise.all([
        fetch(`${CLIENT_API}/client/payment-requests`, { headers }),
        fetch(`${CLIENT_API}/client/meetings`, { headers }),
        fetch(`${CLIENT_API}/client/trust`, { headers }),
        canAccessClientMessages(caseFile)
          ? fetch(`${CLIENT_API}/client/messages/unread-count`, { headers })
          : Promise.resolve(null),
      ]);

      const extras: ActionItem[] = [];

      if (payRes.ok) {
        const payJson = await payRes.json();
        for (const p of (payJson.data ?? []).filter((x: { is_payable: boolean }) => x.is_payable)) {
          extras.push({
            id: `pay-${p.id}`,
            tone: "warning",
            title: `Payment due: ${p.title}`,
            description: fmtMoney(p.amount, p.currency),
            href: externalPath(p.pay_url),
            buttonLabel: "Pay now",
            icon: CreditCard,
          });
        }
      }

      if (meetRes.ok) {
        const meetJson = await meetRes.json();
        for (const m of (meetJson.data ?? []).filter((x: { is_upcoming: boolean }) => x.is_upcoming).slice(0, 3)) {
          extras.push({
            id: `meet-${m.id}`,
            tone: "info",
            title: m.title,
            description: fmtMeetingWhen(m.scheduled_at, m.timezone),
            href: externalPath(m.invite_url),
            buttonLabel: "View meeting",
            icon: Calendar,
          });
        }
      }

      if (trustRes.ok) {
        const trust = await trustRes.json();
        const pending = (trust.pending_invoices ?? []).filter(
          (i: { status: string }) => i.status === "pending_client_approval",
        );
        for (const inv of pending) {
          extras.push({
            id: `trust-${inv.id}`,
            tone: "warning",
            title: `Approve trust invoice: ${inv.milestone_label ?? inv.invoice_number}`,
            description: fmtMoney(inv.amount, inv.currency),
            buttonLabel: "Review",
            href: "/user-dashboard",
            icon: Landmark,
            onAction: async () => {
              await fetch(`${CLIENT_API}/client/trust/invoices/${inv.id}/approve`, {
                method: "POST",
                headers: clientAuthHeaders(false),
              });
              await loadExtras();
            },
          });
        }
      }

      if (unreadRes?.ok) {
        const unreadJson = await unreadRes.json();
        const count = unreadJson.count ?? 0;
        if (count > 0) {
          extras.push({
            id: "unread-messages",
            tone: "warning",
            title: `${count} new message${count === 1 ? "" : "s"} from your consultant`,
            description: "Read and reply when your case hub allows sending.",
            href: "/user-dashboard/messages",
            buttonLabel: "Open messages",
            icon: MessageSquare,
          });
        }
      }

      setDynamicItems(extras);
    } finally {
      setLoadingExtra(false);
    }
  }, [caseFile]);

  useEffect(() => {
    loadExtras();
  }, [loadExtras]);

  const items = useMemo(() => {
    const seen = new Set<string>();
    const merged: ActionItem[] = [];
    for (const item of [...staticItems, ...dynamicItems]) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(item);
    }
    return merged;
  }, [staticItems, dynamicItems]);

  const [acting, setActing] = useState<string | null>(null);

  if (loadingExtra && items.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading your action items…
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/30 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="size-5 shrink-0 text-emerald-600 mt-0.5" />
          <div>
            <p className="font-semibold">You&apos;re all caught up</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No pending tasks right now. Check back when your consultant sends updates.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      <div className="border-b bg-muted/30 px-5 py-3">
        <p className="text-sm font-semibold">
          {items.length} thing{items.length === 1 ? "" : "s"} need your attention
        </p>
      </div>
      <ul className="divide-y">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li
              key={item.id}
              className={cn("flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between", TONE_STYLES[item.tone])}
            >
              <div className="flex min-w-0 items-start gap-3">
                <Icon className="size-5 shrink-0 text-muted-foreground mt-0.5" />
                <div className="min-w-0">
                  <p className="font-medium text-sm">{item.title}</p>
                  {item.description && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                  )}
                </div>
              </div>
              {item.onAction ? (
                <Button
                  size="sm"
                  className="h-9 w-full shrink-0 rounded-lg sm:w-auto"
                  disabled={acting === item.id}
                  onClick={async () => {
                    setActing(item.id);
                    try {
                      await item.onAction?.();
                    } finally {
                      setActing(null);
                    }
                  }}
                >
                  {acting === item.id ? <Loader2 className="size-4 animate-spin" /> : item.buttonLabel}
                </Button>
              ) : item.href ? (
                <Button size="sm" className="h-9 w-full shrink-0 rounded-lg sm:w-auto" asChild>
                  <Link href={item.href}>
                    {item.id.startsWith("meet-") && <Video className="mr-1.5 size-3.5" />}
                    {item.buttonLabel}
                  </Link>
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div className="border-t bg-muted/20 px-5 py-2.5 flex flex-wrap gap-3 text-xs">
        <Link href="/user-dashboard/billing" className="text-primary hover:underline">Billing</Link>
        <span className="text-muted-foreground">·</span>
        <Link href="/user-dashboard/notifications" className="text-primary hover:underline">Notifications</Link>
      </div>
    </div>
  );
}

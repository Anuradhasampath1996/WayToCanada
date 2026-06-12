"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity, Loader2, User, Briefcase, Filter, Shield, ExternalLink, Download,
  FileText, MessageSquare, Calendar, CreditCard, GraduationCap, ClipboardList,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type ActivityLogEntry = {
  id: number;
  actor_type: "client" | "consultant" | "system";
  actor_name: string | null;
  event_type: string;
  title: string;
  description: string | null;
  ip_address: string | null;
  occurred_at: string;
  metadata: Record<string, unknown> | null;
};

type ActivityResponse = {
  client: { id: number; name: string; email: string; registered_at: string | null; invited_at: string | null };
  summary: { total_events: number; client_actions: number; consultant_actions: number };
  compliance_note: string;
  data: {
    data: ActivityLogEntry[];
    current_page: number;
    last_page: number;
    total: number;
  };
};

const CATEGORY_LABELS: Record<string, string> = {
  all: "All categories",
  onboarding: "Onboarding",
  questionnaire: "Questionnaire",
  pathway: "Pathway",
  agreement: "Agreement",
  forms: "Application forms",
  documents: "Documents",
  case: "Case pipeline",
  messages: "Messages",
  meetings: "Meetings",
  payments: "Payments",
  lms: "Learning (LMS)",
};

const ACTOR_LABELS: Record<string, string> = {
  all: "Everyone",
  client: "Client only",
  consultant: "Consultant only",
};

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : null;
  return {
    Accept: "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function categoryIcon(eventType: string) {
  if (eventType.includes("questionnaire")) return ClipboardList;
  if (eventType.includes("document")) return FileText;
  if (eventType.includes("message")) return MessageSquare;
  if (eventType.includes("meeting")) return Calendar;
  if (eventType.includes("payment")) return CreditCard;
  if (eventType.includes("lms")) return GraduationCap;
  if (eventType.includes("agreement") || eventType.includes("form")) return FileText;
  return Activity;
}

function actorBadge(type: string) {
  if (type === "client") return { label: "Client", className: "bg-sky-100 text-sky-800 border-sky-200" };
  if (type === "consultant") return { label: "Consultant", className: "bg-violet-100 text-violet-800 border-violet-200" };
  return { label: "System", className: "bg-muted text-muted-foreground" };
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ClientActivityReport({ clientId }: { clientId: number }) {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [summary, setSummary] = useState<ActivityResponse["summary"] | null>(null);
  const [complianceNote, setComplianceNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [actorFilter, setActorFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const filterParams = useCallback(() => {
    const params = new URLSearchParams();
    if (actorFilter !== "all") params.set("actor", actorFilter);
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    return params;
  }, [actorFilter, categoryFilter]);

  const downloadPdf = async () => {
    setDownloading(true);
    setDownloadError(null);
    try {
      const params = filterParams();
      const res = await fetch(
        `${API}/consultant/clients/${clientId}/activity-log/pdf?${params}`,
        { headers: authHeaders() },
      );
      if (!res.ok) {
        throw new Error("Failed to generate PDF.");
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="?([^";\n]+)"?/);
      const filename = match?.[1] ?? `client-activity-report-${clientId}.pdf`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError("Could not download PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), per_page: "30" });
    if (actorFilter !== "all") params.set("actor", actorFilter);
    if (categoryFilter !== "all") params.set("category", categoryFilter);

    const res = await fetch(`${API}/consultant/clients/${clientId}/activity-log?${params}`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const json: ActivityResponse = await res.json();
    setEntries(json.data?.data ?? []);
    setSummary(json.summary ?? null);
    setComplianceNote(json.compliance_note ?? "");
    setLastPage(json.data?.last_page ?? 1);
    setLoading(false);
  }, [clientId, page, actorFilter, categoryFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [actorFilter, categoryFilter]);

  return (
    <Card className="border-border/70 shadow-sm" id="client-activity-report">
      <CardHeader className="border-b border-border/50">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="size-5 text-emerald-600" />
              Client activity &amp; compliance report
            </CardTitle>
            <CardDescription className="mt-1 max-w-2xl">
              Full audit trail from client registration through every portal action. Download the PDF for a
              professional compliance record with consultant and client details — suitable for dispute resolution.
            </CardDescription>
          </div>
          {summary && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{summary.total_events} events</Badge>
                <Badge variant="outline" className="gap-1">
                  <User className="size-3" />
                  {summary.client_actions} client
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Briefcase className="size-3" />
                  {summary.consultant_actions} consultant
                </Badge>
              </div>
              <Button
                size="sm"
                className="h-8 gap-1.5 rounded-lg"
                onClick={downloadPdf}
                disabled={downloading || loading}
              >
                {downloading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                Download PDF
              </Button>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Filter className="size-4 text-muted-foreground" />
          <Select value={actorFilter} onValueChange={setActorFilter}>
            <SelectTrigger className="h-8 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ACTOR_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="h-8 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" className="h-8" onClick={() => load()}>
            Refresh
          </Button>
          {!summary && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5"
              onClick={downloadPdf}
              disabled={downloading || loading}
            >
              {downloading ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
              Download PDF
            </Button>
          )}
        </div>
        {downloadError && (
          <p className="mt-2 text-xs text-destructive">{downloadError}</p>
        )}
      </CardHeader>

      <CardContent className="pt-4">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 size-5 animate-spin" />
            Loading activity log…
          </div>
        ) : entries.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No activity recorded yet. Events will appear here as the client and consultant use the portal.
          </p>
        ) : (
          <ul className="space-y-0">
            {entries.map((entry, i) => {
              const Icon = categoryIcon(entry.event_type);
              const badge = actorBadge(entry.actor_type);
              return (
                <li key={entry.id} className="relative flex gap-3 pb-5 last:pb-0">
                  {i < entries.length - 1 && (
                    <span className="absolute left-[15px] top-8 bottom-0 w-px bg-border" />
                  )}
                  <div className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="size-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{entry.title}</p>
                      <span className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-medium", badge.className)}>
                        {badge.label}
                      </span>
                    </div>
                    {entry.description && (
                      <p className="mt-0.5 text-sm text-muted-foreground">{entry.description}</p>
                    )}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {fmtDateTime(entry.occurred_at)}
                      {entry.actor_name ? ` · ${entry.actor_name}` : ""}
                      {entry.ip_address ? ` · IP ${entry.ip_address}` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {lastPage > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-4">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">Page {page} of {lastPage}</span>
            <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        )}

        <div className="mt-6 rounded-lg border border-emerald-200/60 bg-emerald-50/50 p-4 text-xs text-emerald-900">
          <p className="font-medium">CICC professional conduct reference</p>
          <p className="mt-1 text-emerald-800/90">
            {complianceNote || "This report supports transparency and record-keeping obligations for regulated immigration consultants."}
          </p>
          <a
            href="https://college-ic.ca/protecting-the-public/code-of-professional-conduct"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline"
          >
            CICC Code of Professional Conduct
            <ExternalLink className="size-3" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

"use client";

import Link from "next/link";
import {
  CheckCircle2, Clock, FileText, FormInput, AlertCircle,
  ChevronRight, Briefcase,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface HubProgress {
  overall_percent: number;
  documents: { total: number; approved: number; pending: number; missing: number; rejected: number; percent: number };
  forms: { total: number; submitted: number; reviewed: number; complete: boolean };
  pipeline: { status: string; label: string; step: number; total_steps: number };
}

export interface HubRequirement {
  id: string;
  label: string;
  category: string;
  status: "missing" | "pending" | "approved" | "rejected" | "uploaded";
  checked?: boolean;
  submission?: { id: number; file_url: string; status: string } | null;
}

export interface HubIrccForm {
  code: string;
  name: string;
  type: string;
  status?: string;
  reviewed?: boolean;
}

function ProgressRing({ percent, size = 72 }: { percent: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={6} className="text-muted/30" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={6}
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
          className="text-primary transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold">{percent}%</span>
      </div>
    </div>
  );
}

function StatPill({ label, value, tone }: { label: string; value: string; tone: "green" | "amber" | "blue" }) {
  const colors = {
    green: "bg-green-50 border-green-200 text-green-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    blue:  "bg-blue-50 border-blue-200 text-blue-800",
  };
  return (
    <div className={cn("rounded-lg border px-3 py-2 text-center", colors[tone])}>
      <p className="text-lg font-bold leading-none">{value}</p>
      <p className="text-[10px] mt-1 opacity-80">{label}</p>
    </div>
  );
}

export function CaseHubProgressHeader({
  progress,
  pathway,
  packageLabel,
  pipelineLabel,
}: {
  progress: HubProgress;
  pathway: string | null;
  packageLabel?: string | null;
  pipelineLabel: string;
}) {
  return (
    <div className="rounded-xl border bg-gradient-to-br from-primary/5 via-background to-background p-5 mb-6">
      <div className="flex flex-wrap items-center gap-5">
        <ProgressRing percent={progress.overall_percent} />
        <div className="flex-1 min-w-[200px]">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Case Progress</p>
          <h2 className="text-lg font-bold mt-0.5">{pathway ?? "Immigration Case"}</h2>
          {packageLabel && <p className="text-xs text-muted-foreground mt-1">Package: {packageLabel}</p>}
          <Badge variant="outline" className="mt-2 text-xs">{pipelineLabel}</Badge>
        </div>
        <div className="grid grid-cols-3 gap-3 flex-1 min-w-[240px]">
          <StatPill label="Docs approved" value={`${progress.documents.approved}/${progress.documents.total}`} tone={progress.documents.percent >= 80 ? "green" : "amber"} />
          <StatPill label="Forms reviewed" value={progress.forms.total === 0 ? "N/A" : `${progress.forms.reviewed}/${progress.forms.total}`} tone={progress.forms.complete ? "green" : "blue"} />
          <StatPill label="Pending docs" value={String(progress.documents.pending + progress.documents.missing)} tone={progress.documents.pending + progress.documents.missing > 0 ? "amber" : "green"} />
        </div>
      </div>
    </div>
  );
}

const REQ_STATUS: Record<string, { label: string; className: string }> = {
  approved: { label: "Approved", className: "bg-green-50 text-green-700 border-green-200" },
  pending:  { label: "Under review", className: "bg-amber-50 text-amber-700 border-amber-200" },
  uploaded: { label: "Uploaded", className: "bg-blue-50 text-blue-700 border-blue-200" },
  rejected: { label: "Reupload needed", className: "bg-red-50 text-red-700 border-red-200" },
  missing:  { label: "Not uploaded", className: "bg-muted text-muted-foreground border-border" },
};

export function ClientRequirementsStatusGrid({ requirements }: { requirements: HubRequirement[] }) {
  const grouped = requirements.reduce<Record<string, HubRequirement[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 capitalize">
            {category.replace(/_/g, " ")}
          </p>
          <div className="space-y-2">
            {items.map((req) => {
              const st = REQ_STATUS[req.status] ?? REQ_STATUS.missing;
              return (
                <div key={req.id} className="flex items-center gap-3 rounded-lg border px-4 py-3 bg-card">
                  {req.status === "approved" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  ) : req.status === "missing" ? (
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                  )}
                  <span className="text-sm font-medium flex-1 min-w-0">{req.label}</span>
                  <Badge variant="outline" className={cn("text-[10px] shrink-0", st.className)}>{st.label}</Badge>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function IrccFormsList({ forms, pathway }: { forms: HubIrccForm[]; pathway: string | null }) {
  if (forms.length === 0) {
    return (
      <p className="text-sm text-muted-foreground italic py-2">
        No additional IRCC reference forms for this package.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {forms.map((form, i) => (
        <div key={`${form.code}-${i}`} className="flex items-center gap-3 rounded-lg border px-4 py-3">
          {form.type === "interactive" ? (
            <FormInput className="h-4 w-4 text-purple-600 shrink-0" />
          ) : (
            <FileText className="h-4 w-4 text-primary shrink-0" />
          )}
          <span className="text-sm font-mono font-medium text-primary shrink-0">{form.code}</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground flex-1 min-w-0">{form.name}</span>
          {form.type === "interactive" && (
            <Badge variant="outline" className="text-[10px] shrink-0">
              {form.reviewed ? "Reviewed" : form.status?.replace(/_/g, " ") ?? "Online form"}
            </Badge>
          )}
        </div>
      ))}
      {pathway && (
        <p className="text-xs text-muted-foreground pt-1">
          Pathway: <strong>{pathway}</strong>
        </p>
      )}
    </div>
  );
}

export function ClientHubNextActions({
  actions,
  onActionClick,
}: {
  actions: { label: string; tab: string; urgent?: boolean }[];
  onActionClick: (tab: string) => void;
}) {
  if (actions.length === 0) return null;

  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
      <p className="text-sm font-semibold flex items-center gap-2">
        <Briefcase className="h-4 w-4 text-primary" /> What to do next
      </p>
      <ul className="space-y-1">
        {actions.map((action, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => onActionClick(action.tab)}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-primary/10"
            >
              {action.urgent ? (
                <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
              <span className="font-medium">{action.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function CaseManagementLockedPanel({
  message,
  verification,
}: {
  message: string;
  verification?: {
    total_forms?: number;
    submitted_count?: number;
    reviewed_count?: number;
  } | null;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center max-w-lg mx-auto">
      <div className="rounded-full bg-amber-100 p-4 mb-4">
        <Clock className="h-10 w-10 text-amber-600" />
      </div>
      <h2 className="text-xl font-bold mb-2">Documents not unlocked yet</h2>
      <p className="text-sm text-muted-foreground mb-4">{message}</p>
      {verification && (verification.total_forms ?? 0) > 0 && (
        <p className="text-sm mb-4">
          Forms: <strong>{verification.submitted_count ?? 0}/{verification.total_forms}</strong> submitted
          {" · "}
          <strong>{verification.reviewed_count ?? 0}/{verification.total_forms}</strong> reviewed by consultant
        </p>
      )}
      <Button asChild>
        <Link href="/user-dashboard/application-forms">Go to Application Forms</Link>
      </Button>
    </div>
  );
}

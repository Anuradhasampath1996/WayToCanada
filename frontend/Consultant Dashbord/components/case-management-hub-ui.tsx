"use client";

import Link from "next/link";
import {
  CheckCircle2, Clock, FileText, FormInput, AlertCircle,
  ChevronRight, ExternalLink, Briefcase, ClipboardList,
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
  checked: boolean;
  submission?: { id: number; file_url: string; status: string } | null;
}

export interface HubIrccForm {
  code: string;
  name: string;
  type: string;
  status?: string;
  reviewed?: boolean;
}

export interface HubPackage {
  id: number;
  label: string;
  breadcrumb: string[];
  result?: { guide: string; checklist: string; forms: string[] } | null;
  documents: { id: number; label: string; file_url: string }[];
}

export function ProgressRing({ percent, size = 72 }: { percent: number; size?: number }) {
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
    <div className="mb-4 rounded-xl border bg-gradient-to-br from-primary/5 via-background to-background p-4 sm:mb-6 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
        <ProgressRing percent={progress.overall_percent} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Case Progress</p>
          <h2 className="mt-0.5 text-lg font-bold break-words">{pathway ?? "Immigration Case"}</h2>
          {packageLabel && (
            <p className="mt-1 text-xs text-muted-foreground">Package: {packageLabel}</p>
          )}
          <Badge variant="outline" className="mt-2 text-xs">{pipelineLabel}</Badge>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:min-w-[240px] sm:flex-1 sm:grid-cols-3">
          <StatPill label="Docs approved" value={`${progress.documents.approved}/${progress.documents.total}`} tone={progress.documents.percent >= 80 ? "green" : "amber"} />
          <StatPill label="Forms reviewed" value={progress.forms.total === 0 ? "N/A" : `${progress.forms.reviewed}/${progress.forms.total}`} tone={progress.forms.complete ? "green" : "blue"} />
          <StatPill label="Pending docs" value={String(progress.documents.pending + progress.documents.missing)} tone={progress.documents.pending + progress.documents.missing > 0 ? "amber" : "green"} />
        </div>
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

const REQ_STATUS: Record<string, { label: string; className: string }> = {
  approved: { label: "Approved", className: "bg-green-50 text-green-700 border-green-200" },
  pending:  { label: "Review", className: "bg-amber-50 text-amber-700 border-amber-200" },
  uploaded: { label: "Uploaded", className: "bg-blue-50 text-blue-700 border-blue-200" },
  rejected: { label: "Rejected", className: "bg-red-50 text-red-700 border-red-200" },
  missing:  { label: "Missing", className: "bg-muted text-muted-foreground border-border" },
};

export function DocumentRequirementsGrid({
  requirements,
  onReview,
  onViewPdf,
  buildSubmissionStreamUrl,
  consultantView = true,
  onToggleCheck,
  togglingCheckId,
}: {
  requirements: HubRequirement[];
  onReview?: (submissionId: number) => void;
  onViewPdf?: (title: string, streamUrl: string) => void;
  buildSubmissionStreamUrl?: (submissionId: number) => string;
  consultantView?: boolean;
  onToggleCheck?: (docId: string, checked: boolean) => void;
  togglingCheckId?: string | null;
}) {
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
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{req.label}</p>
                    {req.submission && (
                      <p className="text-xs text-muted-foreground truncate">{req.submission.file_url.split("/").pop()}</p>
                    )}
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] shrink-0", st.className)}>{st.label}</Badge>
                  {consultantView && onToggleCheck && (
                    <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground shrink-0 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={req.checked}
                        disabled={togglingCheckId === req.id}
                        onChange={(e) => onToggleCheck(req.id, e.target.checked)}
                        className="rounded border-input"
                      />
                      Verified
                    </label>
                  )}
                  {consultantView && !onToggleCheck && req.checked && (
                    <Badge variant="outline" className="text-[10px] shrink-0 bg-green-50">Checked</Badge>
                  )}
                  {req.submission && onReview && ["pending", "uploaded"].includes(req.status) && (
                    <Button size="sm" variant="outline" className="h-7 text-xs shrink-0" onClick={() => onReview(req.submission!.id)}>
                      Review
                    </Button>
                  )}
                  {req.submission && onViewPdf && buildSubmissionStreamUrl ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs shrink-0"
                      onClick={() => onViewPdf(req.label, buildSubmissionStreamUrl(req.submission!.id))}
                    >
                      View
                    </Button>
                  ) : req.submission ? (
                    <a href={req.submission.file_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                      <Button size="sm" variant="ghost" className="h-7 text-xs">View</Button>
                    </a>
                  ) : null}
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
      <p className="text-sm text-muted-foreground italic py-4">
        No IRCC forms configured. Assign an application package in Pathway Calculator.
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
          {form.type === "interactive" && form.status && (
            <Badge variant="outline" className="text-[10px] shrink-0 capitalize">
              {form.reviewed ? "Reviewed" : form.status.replace(/_/g, " ")}
            </Badge>
          )}
          {form.type !== "interactive" && (
            <a href="https://www.canada.ca/en/immigration-refugees-citizenship/services/application/application-forms-guides.html" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline shrink-0">
              IRCC ↗
            </a>
          )}
        </div>
      ))}
      {pathway && (
        <p className="text-xs text-muted-foreground pt-1">
          Pathway: <strong>{pathway}</strong>
          {forms.some((f) => f.type === "interactive") && " — online forms are filled in Application Forms tab."}
        </p>
      )}
    </div>
  );
}

export function CaseHubOverview({
  progress,
  pathway,
  package: pkg,
  irccForms,
  requirements,
  nextActions,
  onViewPdf,
  buildPackageDocStreamUrl,
  onActionClick,
}: {
  progress: HubProgress;
  pathway: string | null;
  package: HubPackage | null;
  irccForms: HubIrccForm[];
  requirements: HubRequirement[];
  nextActions: { label: string; tab?: string; href?: string; urgent?: boolean }[];
  onViewPdf?: (title: string, streamUrl: string) => void;
  buildPackageDocStreamUrl?: (documentId: number) => string;
  onActionClick?: (tab: string) => void;
}) {
  const missing = requirements.filter((r) => r.status === "missing").length;
  const pendingReview = requirements.filter((r) => r.status === "pending" || r.status === "uploaded").length;

  return (
    <div className="space-y-6">
      {/* Next actions */}
      {nextActions.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
          <p className="text-sm font-semibold flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" /> Next actions
          </p>
          <ul className="space-y-1.5">
            {nextActions.map((action, i) => (
              <li key={i}>
                {action.tab && onActionClick ? (
                  <button
                    type="button"
                    onClick={() => onActionClick(action.tab!)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-primary/10",
                      action.urgent && "text-amber-900",
                    )}
                  >
                    {action.urgent ? (
                      <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span className="font-medium">{action.label}</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 text-sm px-2 py-1">
                    {action.urgent ? (
                      <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )}
                    <span>{action.label}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Package resources */}
      {pkg && (
        <div className="rounded-xl border p-4 space-y-3">
          <p className="text-sm font-semibold flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            Application Package — {pkg.label}
          </p>
          <p className="text-xs text-muted-foreground">{pkg.breadcrumb.join(" › ")}</p>
          {pkg.result && (
            <div className="flex flex-wrap gap-2 text-xs">
              {pkg.result.guide && <Badge variant="secondary">Guide: {pkg.result.guide}</Badge>}
              {pkg.result.checklist && <Badge variant="secondary">Checklist: {pkg.result.checklist}</Badge>}
            </div>
          )}
          {pkg.documents.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground">IRCC reference PDFs</p>
              {pkg.documents.map((doc) => (
                onViewPdf && buildPackageDocStreamUrl ? (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => onViewPdf(doc.label, buildPackageDocStreamUrl(doc.id))}
                    className="flex items-center gap-2 text-sm text-primary hover:underline text-left"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> {doc.label}
                  </button>
                ) : (
                  <a key={doc.id} href={doc.file_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline">
                    <ExternalLink className="h-3.5 w-3.5" /> {doc.label}
                  </a>
                )
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick stats */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl border p-4">
          <p className="text-sm font-semibold mb-2">Documents</p>
          <p className="text-2xl font-bold text-primary">{progress.documents.approved}<span className="text-muted-foreground text-base font-normal">/{progress.documents.total}</span></p>
          <p className="text-xs text-muted-foreground mt-1">{missing} missing · {pendingReview} awaiting review</p>
        </div>
        <div className="rounded-xl border p-4">
          <p className="text-sm font-semibold mb-2">Application Forms</p>
          {progress.forms.total === 0 ? (
            <p className="text-sm text-muted-foreground">No interactive forms for this package</p>
          ) : (
            <>
              <p className="text-2xl font-bold text-primary">{progress.forms.reviewed}<span className="text-muted-foreground text-base font-normal">/{progress.forms.total}</span></p>
              <p className="text-xs text-muted-foreground mt-1">reviewed by consultant</p>
            </>
          )}
        </div>
      </div>

      {/* IRCC forms preview */}
      <div>
        <p className="text-sm font-semibold mb-3">Required IRCC Forms</p>
        <IrccFormsList forms={irccForms} pathway={pathway} />
      </div>
    </div>
  );
}

export function CaseHubLocked({
  title,
  message,
  backHref,
  backLabel = "Back to Workspace",
}: {
  title: string;
  message: string;
  backHref: string;
  backLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center max-w-md mx-auto">
      <FormInput className="h-12 w-12 text-muted-foreground/40" />
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button asChild>
        <Link href={backHref}>{backLabel}</Link>
      </Button>
    </div>
  );
}

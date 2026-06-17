"use client";

import type { ReactNode } from "react";
import {
  BarChart3,
  CheckCircle2,
  ChevronRight,
  FileText,
  Folder,
  HardDrive,
  Kanban,
  MessageSquare,
  ScanLine,
  Shield,
  Users,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";

function BrowserFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative mx-auto w-full max-w-xl transition-transform duration-500 hover:scale-[1.02]", className)}>
      <div className="landing-shimmer-border absolute -inset-[1px] rounded-[1.35rem] opacity-60" />
      <div className="relative overflow-hidden rounded-[1.3rem] border border-white/60 bg-card landing-card-glow">
        <div className="flex items-center gap-2 border-b border-border/60 bg-gradient-to-r from-muted/80 to-muted/40 px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/90 shadow-sm" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90 shadow-sm" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90 shadow-sm" />
          </div>
          <span className="ml-2 truncate rounded-md bg-background/80 px-2 py-0.5 text-[10px] text-muted-foreground sm:text-xs">
            consultant.waytocanada.ca
          </span>
        </div>
        <div className="bg-gradient-to-b from-background to-emerald-50/20 p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}

function MockWorkspace() {
  return (
    <BrowserFrame>
      <p className="text-xs font-medium text-muted-foreground">Client workspace</p>
      <div className="mt-3 grid gap-2">
        {["Pathway assessment", "Retainer agreement", "Forms review", "Case hub"].map((s, i) => (
          <div
            key={s}
            className={cn(
              "flex items-center justify-between rounded-xl border px-3 py-2.5 text-sm",
              i === 1 ? "border-emerald-500/40 bg-emerald-500/10" : "border-border/70",
            )}
          >
            <span className="font-medium">{s}</span>
            {i < 1 ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>
    </BrowserFrame>
  );
}

function MockPathway() {
  return (
    <BrowserFrame>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">CRS Score</p>
        <span className="text-2xl font-bold text-emerald-600">467</span>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-emerald-500 to-teal-500" />
      </div>
      <div className="mt-4 space-y-2">
        {["Express Entry — Eligible", "PNP Ontario — Achievable", "Study → PR — Review"].map((p) => (
          <div key={p} className="rounded-lg border border-border/70 px-3 py-2 text-xs">{p}</div>
        ))}
      </div>
    </BrowserFrame>
  );
}

function MockPipeline() {
  const cols = ["Signed", "Docs", "Review", "Submit"];
  return (
    <BrowserFrame>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Kanban className="h-4 w-4 text-emerald-600" /> Application board
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {cols.map((c, ci) => (
          <div key={c} className="rounded-lg bg-muted/50 p-1.5">
            <p className="mb-1.5 text-[9px] font-semibold uppercase text-muted-foreground">{c}</p>
            {Array.from({ length: ci === 1 ? 3 : 2 }).map((_, i) => (
              <div key={i} className="mb-1 rounded border border-border/60 bg-card px-1.5 py-1 text-[8px] leading-tight">
                Client {ci * 2 + i + 1}
              </div>
            ))}
          </div>
        ))}
      </div>
    </BrowserFrame>
  );
}

function MockStorage() {
  return (
    <BrowserFrame>
      <div className="flex items-center gap-2 text-sm font-semibold">
        <HardDrive className="h-4 w-4 text-emerald-600" /> My storage
      </div>
      <div className="mt-3 space-y-1 text-xs">
        {["Contracts", "Client scans", "invoice_march.pdf"].map((item, i) => (
          <div key={item} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/50">
            {i < 2 ? <Folder className="h-3.5 w-3.5 text-amber-500" /> : <FileText className="h-3.5 w-3.5 text-blue-500" />}
            <span>{item}</span>
          </div>
        ))}
      </div>
    </BrowserFrame>
  );
}

function MockGeneric({ icon: Icon, label, rows }: { icon: typeof Users; label: string; rows: string[] }) {
  return (
    <BrowserFrame>
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-emerald-600" /> {label}
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r} className="flex items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            {r}
          </div>
        ))}
      </div>
    </BrowserFrame>
  );
}

const VARIANT_MAP: Record<string, ReactNode> = {
  workspace: <MockWorkspace />,
  pathway: <MockPathway />,
  pipeline: <MockPipeline />,
  storage: <MockStorage />,
  retainer: <MockGeneric icon={FileText} label="Retainer agreement" rows={["Sent to client", "Awaiting signature", "Milestone 1 — Deposit"]} />,
  forms: <MockGeneric icon={FileText} label="Questionnaire" rows={["Personal details ✓", "Education ✓", "Work history — in review"]} />,
  documents: <MockGeneric icon={MessageSquare} label="Case hub" rows={["Passport uploaded", "Consultant approved", "New message from client"]} />,
  meetings: <MockGeneric icon={Video} label="Meetings & pay" rows={["Google Meet — Thu 2pm", "Payment link sent — $500", "Interac confirmed"]} />,
  trust: <MockGeneric icon={BarChart3} label="Trust ledger" rows={["Deposit $2,000", "Milestone invoice issued", "Client approved release"]} />,
  legislation: <MockGeneric icon={FileText} label="Legislation hub" rows={["IRPA — Immigration Act", "IRPR — Regulations", "Search: work permit"]} />,
  lms: <MockGeneric icon={Users} label="LMS courses" rows={["Express Entry 101 — 80%", "Quiz passed", "Homework submitted"]} />,
  ocr: <MockGeneric icon={ScanLine} label="OCR scan" rows={["Passport detected", "Name extracted", "DOB prefilled"]} />,
  profile: <MockGeneric icon={Shield} label="RCIC profile" rows={["CICC verified", "Subscription active", "Company logo set"]} />,
};

export function FeatureMediaMock({ variant }: { variant: string | null }) {
  const key = variant ?? "workspace";
  return <>{VARIANT_MAP[key] ?? VARIANT_MAP.workspace}</>;
}

export function FeatureMedia({
  mediaType,
  mediaUrl,
  mockVariant,
  alt,
}: {
  mediaType: string;
  mediaUrl: string | null;
  mockVariant: string | null;
  alt: string;
}) {
  if (mediaType === "image" || mediaType === "gif") {
    if (!mediaUrl) return <FeatureMediaMock variant={mockVariant} />;
    return (
      <div className="relative mx-auto w-full max-w-xl">
        <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-transparent blur-2xl" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mediaUrl}
          alt={alt}
          className="relative w-full rounded-2xl border border-border/80 shadow-2xl"
        />
      </div>
    );
  }

  if (mediaType === "video" && mediaUrl) {
    return (
      <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-border/80 shadow-2xl">
        <video src={mediaUrl} controls muted playsInline className="w-full bg-black" />
      </div>
    );
  }

  return <FeatureMediaMock variant={mockVariant} />;
}

"use client";

import { use, useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft, Award, Briefcase, Calculator,
  ChevronDown, ChevronRight, ChevronUp,
  CheckCircle2, XCircle, AlertCircle, Users,
  FileText, GraduationCap, Languages, Star,
  TrendingUp, Globe, ShieldCheck, ExternalLink, Loader2,
  Sparkles, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { WorkspaceSubpageHero } from "../workspace-subpage-hero";
import { INTAKE_WORKSPACE_TASKS } from "../workspace-flow-ui";
import { IrccFormExplorer } from "./ircc-form-explorer";
import { PossiblePathwaysCard } from "./possible-pathways-card";
import {
  HowItWorksCard,
  SimulationStatusBanner,
  WorkflowGuideCard,
  StepNavButtons,
} from "./pathway-calculator-shell";
import {
  calcCRS, calcFSW, getPathwayInsights, ieltsToCLB,
  DEF_PERSON, DEF_SPOUSE, EDU_LABELS,
  OFFICIAL_CRS_TOOL_URL,
  type PersonInput, type SpouseInput, type CRSBreakdown, type FSWBreakdown, type EducationLevel,
  type PathwayInsight,
} from "@/lib/crs-calculator";
import {
  mapQuestionnaireToCalculator, mergePersonInput, mergeSpouseInput,
} from "@/lib/questionnaire-crs-prefill";
import {
  calculateCrs, fetchCrsDraws, fetchCrsRules, savePathwayAssessment, toApiPayload,
  apiToBreakdown, apiToFsw, spouseToExtendedPerson, personToSpouseFields,
  type ExtendedPersonInput, type CrsRulesMeta, type CrsDraw, type CrsApiResult,
} from "@/lib/crs-api";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

const EXT_DEF_PERSON: ExtendedPersonInput = {
  ...DEF_PERSON,
  englishTestType: "ielts",
  frenchTestType: "none",
  frenchScores: { speaking: 0, listening: 0, reading: 0, writing: 0 },
  nocCode: "",
  nocTeer: "",
  nocTitle: "",
};

// ─── Input Components ────────────────────────────────────────────────────────

function NumInput({ label, value, onChange, min, max, step = 1 }: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number; step?: number;
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <input
        type="number" min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full rounded-xl border border-input/80 bg-muted/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  );
}

function SelectInput({ label, value, onChange, options }: {
  label: string; value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1 block">{label}</label>
      <select
        value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-xl border border-input/80 bg-muted/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <div
        onClick={() => onChange(!checked)}
        className={cn(
          "relative w-9 h-5 rounded-full transition-colors",
          checked ? "bg-primary" : "bg-muted border border-input"
        )}
      >
        <span className={cn(
          "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
          checked && "translate-x-4"
        )} />
      </div>
      <span className="text-sm">{label}</span>
    </label>
  );
}

function SectionCard({ title, icon: Icon, children, defaultOpen = true, hint }: {
  title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean; hint?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
      <button
        type="button"
        className="w-full flex items-center gap-3 border-b border-border/40 bg-gradient-to-r from-primary/[0.06] to-transparent px-4 py-3.5 text-left transition-colors hover:from-primary/[0.09]"
        onClick={() => setOpen(!open)}
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Icon className="size-4" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <span className="text-sm font-semibold block">{title}</span>
          {hint && !open && <span className="text-xs text-muted-foreground block truncate">{hint}</span>}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>
      {open && <div className="grid grid-cols-2 gap-3 border-t border-border/40 bg-muted/10 px-4 pb-4 pt-4 sm:grid-cols-3">{children}</div>}
    </div>
  );
}

// ─── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({ value, max, color = "bg-primary" }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="h-2 rounded-full bg-muted overflow-hidden">
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Person Input Form ────────────────────────────────────────────────────────

function PersonForm({ data, onChange, label }: {
  data: ExtendedPersonInput; onChange: (d: ExtendedPersonInput) => void; label: string;
}) {
  const set = <K extends keyof ExtendedPersonInput>(k: K, v: ExtendedPersonInput[K]) =>
    onChange({ ...data, [k]: v });
  const setIelts = (k: keyof ExtendedPersonInput["ielts"], v: number) =>
    onChange({ ...data, ielts: { ...data.ielts, [k]: v } });
  const setFrScore = (k: keyof NonNullable<ExtendedPersonInput["frenchScores"]>, v: number) =>
    onChange({ ...data, frenchScores: { ...(data.frenchScores ?? { speaking: 0, listening: 0, reading: 0, writing: 0 }), [k]: v } });
  const isCelpip = data.englishTestType === "celpip";
  const scoreMax = isCelpip ? 12 : 9;
  const scoreStep = isCelpip ? 1 : 0.5;

  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-foreground">{label}</p>
      <p className="text-xs text-muted-foreground -mt-1">
        Enter the client&apos;s profile below. When finished, click <strong>Calculate score</strong> in the sidebar.
      </p>

      <SectionCard title="Basic profile" icon={Users} hint="Age, education, Canadian study" defaultOpen>
        <NumInput label="Age" value={data.age} onChange={v => set("age", v)} min={16} max={60} />
        <div className="col-span-2">
          <SelectInput label="Education Level" value={data.education} onChange={v => set("education", v as EducationLevel)}
            options={Object.entries(EDU_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
        </div>
        <div className="col-span-3">
          <SelectInput label="Canadian Education" value={data.canadianEducation}
            onChange={v => set("canadianEducation", v as PersonInput["canadianEducation"])}
            options={[
              { value: "none", label: "None" },
              { value: "one_two_year", label: "1–2 year Canadian post-secondary" },
              { value: "three_plus", label: "3+ year Canadian post-secondary" },
            ]} />
        </div>
      </SectionCard>

      <SectionCard title="English test scores" icon={Languages} hint="IELTS or CELPIP-G" defaultOpen={false}>
        <div className="col-span-3">
          <SelectInput label="English test type" value={data.englishTestType ?? "ielts"}
            onChange={v => set("englishTestType", v as "ielts" | "celpip")}
            options={[
              { value: "ielts", label: "IELTS General Training" },
              { value: "celpip", label: "CELPIP-G (CLB = score)" },
            ]} />
        </div>
        <NumInput label="Speaking" value={data.ielts.speaking} onChange={v => setIelts("speaking", v)} min={0} max={scoreMax} step={scoreStep} />
        <NumInput label="Listening" value={data.ielts.listening} onChange={v => setIelts("listening", v)} min={0} max={scoreMax} step={scoreStep} />
        <NumInput label="Reading" value={data.ielts.reading} onChange={v => setIelts("reading", v)} min={0} max={scoreMax} step={scoreStep} />
        <NumInput label="Writing" value={data.ielts.writing} onChange={v => setIelts("writing", v)} min={0} max={scoreMax} step={scoreStep} />
        <div className="col-span-2">
          {!isCelpip && (() => {
            const clb = ieltsToCLB(data.ielts.speaking, data.ielts.listening, data.ielts.reading, data.ielts.writing);
            return (
              <div className="rounded-lg bg-primary/5 border p-2 text-xs">
                <p className="font-semibold text-primary mb-1">CLB Equivalent</p>
                <div className="grid grid-cols-4 gap-1">
                  {(["speaking","listening","reading","writing"] as const).map(k => (
                    <div key={k} className="text-center">
                      <p className="text-muted-foreground capitalize">{k.slice(0,4)}</p>
                      <p className="font-bold text-primary">{clb[k]}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          {isCelpip && (
            <p className="text-xs text-muted-foreground rounded-lg border p-2">CELPIP-G scores map 1:1 to CLB levels.</p>
          )}
        </div>
      </SectionCard>

      <SectionCard title="French test (optional)" icon={Globe} hint="TEF or TCF — bonus points" defaultOpen={false}>
        <div className="col-span-3">
          <SelectInput label="French test" value={data.frenchTestType ?? "none"}
            onChange={v => set("frenchTestType", v as ExtendedPersonInput["frenchTestType"])}
            options={[
              { value: "none", label: "No French test" },
              { value: "tef", label: "TEF Canada (enter raw scores)" },
              { value: "tcf", label: "TCF Canada (enter CLB levels)" },
            ]} />
        </div>
        {(data.frenchTestType === "tef" || data.frenchTestType === "tcf") && (
          <>
            <NumInput label="Speaking" value={data.frenchScores?.speaking ?? 0} onChange={v => setFrScore("speaking", v)} min={0} max={data.frenchTestType === "tcf" ? 12 : 450} step={1} />
            <NumInput label="Listening" value={data.frenchScores?.listening ?? 0} onChange={v => setFrScore("listening", v)} min={0} max={data.frenchTestType === "tcf" ? 12 : 360} step={1} />
            <NumInput label="Reading" value={data.frenchScores?.reading ?? 0} onChange={v => setFrScore("reading", v)} min={0} max={data.frenchTestType === "tcf" ? 12 : 300} step={1} />
            <NumInput label="Writing" value={data.frenchScores?.writing ?? 0} onChange={v => setFrScore("writing", v)} min={0} max={data.frenchTestType === "tcf" ? 12 : 450} step={1} />
          </>
        )}
      </SectionCard>

      <SectionCard title="Job & occupation (NOC)" icon={Briefcase} hint="NOC code, TEER, job title" defaultOpen={false}>
        <div className="col-span-3">
          <label className="text-xs text-muted-foreground mb-1 block">NOC code (5 digits)</label>
          <input value={data.nocCode ?? ""} onChange={e => set("nocCode", e.target.value.replace(/\D/g, "").slice(0, 5))}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" placeholder="e.g. 21231" />
        </div>
        <SelectInput label="TEER category" value={data.nocTeer === "" || data.nocTeer === undefined ? "none" : String(data.nocTeer)}
          onChange={v => set("nocTeer", v === "none" ? "" : parseInt(v, 10))}
          options={[{ value: "none", label: "Not set" }, ...[0,1,2,3,4,5].map(t => ({ value: String(t), label: `TEER ${t}` }))]} />
        <div className="col-span-3">
          <label className="text-xs text-muted-foreground mb-1 block">Job title</label>
          <input value={data.nocTitle ?? ""} onChange={e => set("nocTitle", e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm" placeholder="As listed in NOC" />
        </div>
      </SectionCard>

      <SectionCard title="Work experience" icon={Briefcase} hint="Canadian & foreign years" defaultOpen={false}>
        <NumInput label="Canadian WE (years)" value={data.canadianWorkExp} onChange={v => set("canadianWorkExp", v)} min={0} max={10} />
        <NumInput label="Foreign WE (years)" value={data.foreignWorkExp} onChange={v => set("foreignWorkExp", v)} min={0} max={15} />
      </SectionCard>

      <SectionCard title="Extra CRS points" icon={Star} hint="Job offer, PNP, sibling, trade cert" defaultOpen={false}>
        <div className="col-span-3">
          <SelectInput label="Valid job offer (LMIA or exempt)" value={data.jobOffer}
            onChange={v => set("jobOffer", v as PersonInput["jobOffer"])}
            options={[
              { value: "none", label: "No job offer" },
              { value: "noc00", label: "Senior management (NOC Major Group 00)" },
              { value: "noc_a_b", label: "Skilled occupation (TEER 0–3)" },
              { value: "noc_c_d", label: "Intermediate / labour (TEER 4–5)" },
            ]} />
          <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
            Since 25 Mar 2025, job offers no longer add CRS points. They may still count toward FSW arranged employment (+10 FSW pts) and work permit strategy.
          </p>
        </div>
        <div className="col-span-3 space-y-2.5">
          <Toggle label="Provincial Nomination (adds 600 CRS pts)" checked={data.provincialNomination} onChange={v => set("provincialNomination", v)} />
          <Toggle label="Sibling who is a Canadian citizen / PR (+15 pts)" checked={data.siblingInCanada} onChange={v => set("siblingInCanada", v)} />
          <Toggle label="Certificate of qualification in trade occupation" checked={data.certificateOfQualification} onChange={v => set("certificateOfQualification", v)} />
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Spouse Form ─────────────────────────────────────────────────────────────

function SpouseForm({ data, onChange }: { data: SpouseInput & { age?: number }; onChange: (d: SpouseInput & { age?: number }) => void }) {
  const set = <K extends keyof SpouseInput>(k: K, v: SpouseInput[K]) => onChange({ ...data, [k]: v });
  const setIelts = (k: keyof SpouseInput["ielts"], v: number) =>
    onChange({ ...data, ielts: { ...data.ielts, [k]: v } });

  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Spouse / Partner</p>
      <SectionCard title="Spouse Education &amp; Work" icon={GraduationCap}>
        <NumInput label="Age" value={data.age ?? 28} onChange={v => set("age", v)} min={16} max={60} />
        <div className="col-span-2">
          <SelectInput label="Education Level" value={data.education} onChange={v => set("education", v as EducationLevel)}
            options={Object.entries(EDU_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
        </div>
        <NumInput label="Canadian WE (years)" value={data.canadianWorkExp} onChange={v => set("canadianWorkExp", v)} min={0} max={10} />
      </SectionCard>
      <SectionCard title="Spouse English – IELTS" icon={Languages}>
        <NumInput label="Speaking" value={data.ielts.speaking} onChange={v => setIelts("speaking", v)} min={0} max={9} step={0.5} />
        <NumInput label="Listening" value={data.ielts.listening} onChange={v => setIelts("listening", v)} min={0} max={9} step={0.5} />
        <NumInput label="Reading" value={data.ielts.reading} onChange={v => setIelts("reading", v)} min={0} max={9} step={0.5} />
        <NumInput label="Writing" value={data.ielts.writing} onChange={v => setIelts("writing", v)} min={0} max={9} step={0.5} />
      </SectionCard>
    </div>
  );
}

// ─── Spouse Compare Modal ───────────────────────────────────────────────────

function ScoreSummaryCard({ crs, fsw, label }: { crs: CRSBreakdown; fsw: FSWBreakdown; label: string }) {
  const ringClass =
    crs.total >= 470 ? "border-green-400 bg-green-50" :
    crs.total >= 400 ? "border-blue-400 bg-blue-50"   :
    crs.total >= 300 ? "border-amber-400 bg-amber-50"  :
                       "border-rose-400 bg-rose-50";
  const numClass =
    crs.total >= 470 ? "text-green-600" : crs.total >= 400 ? "text-blue-600" :
    crs.total >= 300 ? "text-amber-600" : "text-rose-500";
  const barClass =
    crs.total >= 470 ? "bg-green-500" : crs.total >= 400 ? "bg-blue-500" :
    crs.total >= 300 ? "bg-amber-500" : "bg-rose-500";
  const badge =
    crs.total >= 470 ? "Excellent" : crs.total >= 400 ? "Strong" :
    crs.total >= 300 ? "Average"   : "Needs Work";

  return (
    <div className="space-y-3 flex-1 min-w-0">
      {/* Label */}
      <div className="text-center">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>

      {/* Big CRS ring */}
      <div className={cn("rounded-xl border-2 p-4 text-center", ringClass)}>
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className={cn("text-5xl font-black leading-none", numClass)}>{crs.total}</span>
          <span className="text-base text-muted-foreground">/1200</span>
        </div>
        <Badge variant="outline" className="text-xs mb-3">{badge}</Badge>
        <ScoreBar value={crs.total} max={1200} color={barClass} />
        <div className="grid grid-cols-3 gap-1.5 mt-3">
          {[
            { label: "Human Capital", value: crs.humanCapital,  max: 500 },
            { label: "Skill Transfer", value: crs.skillTransfer, max: 100 },
            { label: "Additional",    value: crs.additional,    max: 600 },
          ].map(r => (
            <div key={r.label} className="rounded-lg bg-white/70 p-1.5">
              <p className="text-[10px] text-muted-foreground leading-tight">{r.label}</p>
              <p className="text-sm font-bold">{r.value}</p>
              <p className="text-[9px] text-muted-foreground">/{r.max}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CLB grid */}
      <div className="rounded-xl border bg-white p-3">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">English CLB</p>
        <div className="grid grid-cols-4 gap-1">
          {(["speaking", "listening", "reading", "writing"] as const).map(k => {
            const v = crs.firstCLB[k];
            return (
              <div key={k} className={cn("rounded-md p-1.5 text-center border text-xs",
                v >= 9 ? "bg-green-50 border-green-200" : v >= 7 ? "bg-blue-50 border-blue-200" :
                v >= 5 ? "bg-amber-50 border-amber-200"  : "bg-rose-50 border-rose-200"
              )}>
                <p className="text-[8px] text-muted-foreground capitalize">{k.slice(0, 4)}</p>
                <p className={cn("text-xs font-extrabold",
                  v >= 9 ? "text-green-700" : v >= 7 ? "text-blue-700" :
                  v >= 5 ? "text-amber-700"  : "text-rose-700"
                )}>CLB{v}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* FSW */}
      <div className={cn("rounded-xl border p-3 flex items-center gap-2",
        fsw.eligible ? "bg-green-50 border-green-200" : "bg-rose-50 border-rose-200"
      )}>
        {fsw.eligible
          ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          : <XCircle      className="h-4 w-4 text-rose-500 shrink-0" />}
        <div>
          <p className="text-[11px] font-semibold">FSW 67-Point Test</p>
          <p className={cn("text-[10px]", fsw.eligible ? "text-green-700" : "text-rose-600")}>
            {fsw.total}/100 — {fsw.eligible ? "ELIGIBLE ✓" : "Not yet eligible"}
          </p>
        </div>
      </div>

      {/* Score rows */}
      <div className="rounded-xl border bg-white p-3 space-y-1.5">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Breakdown</p>
        {([
          { label: "Age",           value: crs.agePts,         max: 110 },
          { label: "Education",     value: crs.eduPts,         max: 150 },
          { label: "Language",      value: crs.firstLangTotal, max: 136 },
          { label: "Canadian WE",   value: crs.canWEPts,       max: 80  },
          { label: "Spouse",        value: crs.spousePts,      max: 40  },
          { label: "Skill Transfer", value: crs.skillTransfer, max: 100 },
          { label: "Additional",    value: crs.additional,     max: 600 },
        ] as const).map(row => (
          <div key={row.label}>
            <div className="flex justify-between text-[10px] mb-0.5">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-semibold">{row.value}<span className="text-muted-foreground font-normal">/{row.max}</span></span>
            </div>
            <ScoreBar value={row.value} max={row.max} />
          </div>
        ))}
      </div>
    </div>
  );
}

function SpouseCompareModal({
  open, onClose,
  mainCRS, mainFSW,
  spouseCRS, spouseFSW,
  onChoosePrincipal,
  saving,
}: {
  open: boolean; onClose: () => void;
  mainCRS: CRSBreakdown; mainFSW: FSWBreakdown;
  spouseCRS: CRSBreakdown; spouseFSW: FSWBreakdown;
  onChoosePrincipal: (who: "main" | "spouse") => void;
  saving?: boolean;
}) {
  if (!open) return null;

  const mainWins   = mainCRS.total >= spouseCRS.total;
  const difference = Math.abs(mainCRS.total - spouseCRS.total);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border bg-card shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 bg-card border-b">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Main applicant vs spouse — CRS comparison</h2>
              <p className="text-xs text-muted-foreground">
                Decide who should be the principal applicant on the Express Entry profile. Listing the person with the higher CRS score as the main applicant improves draw competitiveness.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </div>

        {/* Recommendation banner */}
        <div className={cn(
          "mx-6 mt-4 rounded-xl border p-3 flex items-center gap-3",
          mainWins ? "bg-blue-50 border-blue-200" : "bg-purple-50 border-purple-200"
        )}>
          <Award className={cn("h-5 w-5 shrink-0", mainWins ? "text-blue-600" : "text-purple-600")} />
          <div>
            <p className={cn("text-sm font-bold", mainWins ? "text-blue-800" : "text-purple-800")}>
              {mainWins ? "Main Applicant" : "Spouse"} has the higher CRS score
            </p>
            <p className={cn("text-xs", mainWins ? "text-blue-700" : "text-purple-700")}>
              Score difference: <strong>{difference} pts</strong> —{" "}
              {difference === 0
                ? "Both applicants have equal scores"
                : `Consider ${mainWins ? "keeping the main applicant" : "switching spouse as the main applicant"} for a better Express Entry result`}
            </p>
          </div>
        </div>

        {/* Side-by-side cards */}
        <div className="grid grid-cols-2 gap-4 p-6 pt-4">
          <ScoreSummaryCard crs={mainCRS} fsw={mainFSW} label="Main Applicant" />
          <ScoreSummaryCard crs={spouseCRS} fsw={spouseFSW} label="Spouse (as Main)" />
        </div>

        {/* Footer */}
        <div className="space-y-2 px-6 pb-4">
          <p className="text-center text-xs text-muted-foreground">
            Choose who will be the principal applicant on the Express Entry profile. This saves the simulation to the case file and continues to pathway review.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              variant={mainWins || mainCRS.total === spouseCRS.total ? "default" : "outline"}
              disabled={saving}
              onClick={() => onChoosePrincipal("main")}
            >
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Use client as principal
            </Button>
            <Button
              variant={!mainWins && mainCRS.total !== spouseCRS.total ? "default" : "outline"}
              disabled={saving}
              onClick={() => onChoosePrincipal("spouse")}
            >
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Use spouse as principal
            </Button>
          </div>
          <Button variant="ghost" onClick={onClose} className="w-full">
            Close without saving
          </Button>
        </div>
      </div>
    </div>
  );
}

function PrincipalApplicantBanner({
  principal,
  mainCrs,
  spouseCrs,
  onChange,
}: {
  principal: "main" | "spouse";
  mainCrs: number;
  spouseCrs: number;
  onChange: (who: "main" | "spouse") => void;
}) {
  const recommended = mainCrs >= spouseCrs ? "main" : "spouse";
  return (
    <div className="rounded-xl border border-violet-200/60 bg-violet-500/[0.06] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-violet-800">Principal applicant for this case</p>
      <p className="mt-1 text-sm text-violet-950">
        {principal === "main"
          ? `Client is principal (CRS ${mainCrs}) — spouse accompanies (CRS ${spouseCrs} if principal).`
          : `Spouse is principal (CRS ${spouseCrs}) — client accompanies (CRS ${mainCrs} if principal).`}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={principal === "main" ? "default" : "outline"}
          className="h-8 rounded-lg text-xs"
          onClick={() => onChange("main")}
        >
          Client as principal ({mainCrs})
        </Button>
        <Button
          size="sm"
          variant={principal === "spouse" ? "default" : "outline"}
          className="h-8 rounded-lg text-xs"
          onClick={() => onChange("spouse")}
        >
          Spouse as principal ({spouseCrs})
          {recommended === "spouse" && principal !== "spouse" && (
            <Badge className="ml-1.5 h-4 rounded px-1 text-[9px]">Higher CRS</Badge>
          )}
        </Button>
      </div>
    </div>
  );
}

// ─── Pathway insights (current + improvement scenarios) ─────────────────────

function pathwayShortName(pathway: string): string {
  if (pathway.includes("Federal Skilled Worker")) return "FSW (Express Entry)";
  if (pathway.includes("Canadian Experience")) return "CEC (Express Entry)";
  if (pathway.includes("Skilled Trades")) return "FST (Express Entry)";
  if (pathway.includes("Provincial Nominee")) return "PNP";
  if (pathway.includes("Study Permit")) return "Study → PR";
  if (pathway.includes("Work Permit")) return "Work → PR";
  if (pathway.includes("Family")) return "Family sponsorship";
  return pathway;
}

// ─── Live CRS Score Preview (Step 1 — right panel) ──────────────────────────

function LiveScorePreview({ clientId, crs, fsw, person, assignedPathway, onNext, hasSpouse, spouse, hasActiveSimulation }: {
  clientId: number;
  crs: CRSBreakdown; fsw: FSWBreakdown;
  person: PersonInput; assignedPathway: string | null;
  onNext?: () => void;
  hasSpouse?: boolean;
  spouse?: SpouseInput;
  hasActiveSimulation: boolean;
}) {
  const insights = getPathwayInsights(crs, fsw, person, hasSpouse ?? false, spouse);

  if (!hasActiveSimulation) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-5 text-center">
        <TrendingUp className="mx-auto size-7 text-muted-foreground/40" />
        <p className="mt-2 text-sm font-medium text-muted-foreground">Eligible pathways will show here</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          After you calculate the score, we&apos;ll list which immigration routes may fit this client.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PossiblePathwaysCard
        clientId={clientId}
        insights={insights}
        assignedPathway={assignedPathway}
        crsTotal={crs.total}
      />

      {onNext && (
        <Button onClick={onNext} className="w-full gap-2 rounded-xl">
          Continue to choose pathway
          <ChevronRight className="size-4" />
        </Button>
      )}
    </div>
  );
}

// ─── Step 2 — Score Detail Panel (left column) ───────────────────────────────

function ScoreDetailPanel({ crs, fsw }: { crs: CRSBreakdown; fsw: FSWBreakdown }) {
  const crsColor =
    crs.total >= 470 ? "bg-green-500" :
    crs.total >= 400 ? "bg-blue-500"  :
    crs.total >= 300 ? "bg-amber-500" : "bg-rose-500";
  const crsBadge =
    crs.total >= 470 ? "Excellent" : crs.total >= 400 ? "Strong" :
    crs.total >= 300 ? "Average"   : "Needs Work";

  return (
    <div className="space-y-4">
      {/* CRS Total */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">CRS Score</span>
          <Badge variant="outline" className={cn("text-xs",
            crs.total >= 470 ? "border-green-300 text-green-700" :
            crs.total >= 400 ? "border-blue-300 text-blue-700"   :
            crs.total >= 300 ? "border-amber-300 text-amber-700" :
                               "border-rose-300 text-rose-700"
          )}>{crsBadge}</Badge>
        </div>
        <div className="flex items-end gap-2 mb-2">
          <span className="text-4xl font-extrabold">{crs.total}</span>
          <span className="text-lg text-muted-foreground mb-1">/ 1200</span>
        </div>
        <ScoreBar value={crs.total} max={1200} color={crsColor} />
        <div className="grid grid-cols-3 gap-2 mt-3">
          {[
            { label: "Human Capital",  value: crs.humanCapital,  max: 500 },
            { label: "Skill Transfer", value: crs.skillTransfer, max: 100 },
            { label: "Additional",     value: crs.additional,    max: 600 },
          ].map(r => (
            <div key={r.label} className="rounded-lg bg-muted/40 p-2 text-center">
              <p className="text-[11px] text-muted-foreground">{r.label}</p>
              <p className="text-lg font-bold">{r.value}</p>
              <p className="text-[10px] text-muted-foreground">/ {r.max}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="rounded-xl border bg-card p-4 space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Detailed Breakdown</p>
        {[
          { label: "Age",                   value: crs.agePts,          max: 110 },
          { label: "Education",             value: crs.eduPts,          max: 150 },
          { label: "First language (ENG)",  value: crs.firstLangTotal,  max: 136 },
          { label: "Second language (FR)",  value: crs.secondLangTotal, max: 24  },
          { label: "Canadian work exp.",    value: crs.canWEPts,        max: 80  },
          { label: "Spouse factors",        value: crs.spousePts,       max: 40  },
          { label: "Skill transferability", value: crs.skillTransfer,   max: 100 },
          { label: "Additional points",     value: crs.additional,      max: 600 },
        ].map(row => (
          <div key={row.label}>
            <div className="flex justify-between text-xs mb-0.5">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-semibold">{row.value} <span className="text-muted-foreground font-normal">/ {row.max}</span></span>
            </div>
            <ScoreBar value={row.value} max={row.max} />
          </div>
        ))}
      </div>

      {/* CLB */}
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">English CLB Levels</p>
        <div className="grid grid-cols-4 gap-2">
          {(["speaking", "listening", "reading", "writing"] as const).map(k => {
            const v = crs.firstCLB[k];
            return (
              <div key={k} className={cn("rounded-lg p-2 text-center border",
                v >= 9 ? "bg-green-50 border-green-200" :
                v >= 7 ? "bg-blue-50 border-blue-200"   :
                v >= 5 ? "bg-amber-50 border-amber-200"  :
                         "bg-rose-50 border-rose-200"
              )}>
                <p className="text-[10px] capitalize text-muted-foreground">{k}</p>
                <p className={cn("text-xl font-extrabold",
                  v >= 9 ? "text-green-700" : v >= 7 ? "text-blue-700" :
                  v >= 5 ? "text-amber-700"  : "text-rose-700"
                )}>CLB {v}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* FSW */}
      <div className={cn("rounded-xl border p-4", fsw.eligible ? "bg-green-50 border-green-200" : "bg-rose-50 border-rose-200")}>
        <div className="flex items-center gap-2 mb-3">
          {fsw.eligible
            ? <CheckCircle2 className="h-5 w-5 text-green-600" />
            : <XCircle      className="h-5 w-5 text-rose-600" />}
          <div>
            <p className="text-sm font-semibold">Federal Skilled Worker — 67-Point Test</p>
            <p className={cn("text-xs", fsw.eligible ? "text-green-700" : "text-rose-700")}>
              Score: {fsw.total} / 100 — {fsw.eligible ? "ELIGIBLE ✓" : "NOT YET ELIGIBLE (need 67+)"}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          {[
            { l: "Language",     v: fsw.language,     m: 28 },
            { l: "Education",    v: fsw.education,    m: 25 },
            { l: "Experience",   v: fsw.experience,   m: 15 },
            { l: "Age",          v: fsw.age,          m: 12 },
            { l: "Job Offer",    v: fsw.arranged,     m: 10 },
            { l: "Adaptability", v: fsw.adaptability, m: 10 },
          ].map(r => (
            <div key={r.l} className="bg-white/70 rounded p-1.5 text-center">
              <p className="text-muted-foreground">{r.l}</p>
              <p className="font-bold">{r.v}<span className="text-muted-foreground font-normal">/{r.m}</span></p>
            </div>
          ))}
        </div>
      </div>

      {/* Improvement Tips */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">How to Improve the CRS Score</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
          {[
            { icon: Languages,     tip: "Improve IELTS to CLB 9+ in all bands — can add 50–80 pts" },
            { icon: Briefcase,     tip: "Gain Canadian work experience (1 yr = +35–40 pts)" },
            { icon: Award,         tip: "Provincial Nomination adds +600 pts — almost guarantees ITA" },
            { icon: Globe,         tip: "French skills (CLB 7+) can add up to 50 additional pts" },
            { icon: GraduationCap, tip: "Canadian post-secondary education adds 15–30 pts" },
            { icon: Star,          tip: "Valid job offer: FSW arranged employment (+10 FSW pts); no CRS bonus since Mar 2025" },
          ].map((t, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg bg-muted/40 p-2.5">
              <t.icon className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <span>{t.tip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Step 2 — Review summary & pathway assignment ───────────────────────────

function ReviewStatCard({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "neutral" | "good" | "warn" | "violet";
}) {
  const styles = {
    neutral: "border-border/70 bg-card",
    good: "border-emerald-200/60 bg-emerald-500/[0.05]",
    warn: "border-amber-200/60 bg-amber-500/[0.05]",
    violet: "border-violet-200/60 bg-violet-500/[0.05]",
  };
  const valueStyles = {
    neutral: "text-foreground",
    good: "text-emerald-700",
    warn: "text-amber-800",
    violet: "text-violet-700",
  };

  return (
    <div className={cn("min-w-0 rounded-xl border px-4 py-3.5", styles[tone])}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground leading-snug">{label}</p>
      <p className={cn("mt-1.5 text-xl font-bold tabular-nums leading-tight sm:text-2xl", valueStyles[tone])}>{value}</p>
      {sub && <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{sub}</p>}
    </div>
  );
}

function ReviewStepSummary({
  crs,
  fsw,
  assignedPathway,
  draws,
}: {
  crs: CRSBreakdown;
  fsw: FSWBreakdown;
  assignedPathway: string | null;
  draws: CrsDraw[];
}) {
  const latestDraw = draws[0];
  const drawCutoff = latestDraw?.minimum_crs_score;
  const vsDraw = drawCutoff != null ? crs.total - drawCutoff : null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <ReviewStatCard
        label="CRS score"
        value={String(crs.total)}
        sub={vsDraw != null ? `${vsDraw >= 0 ? "+" : ""}${vsDraw} vs latest draw (${drawCutoff})` : "Express Entry estimate"}
        tone={vsDraw != null && vsDraw >= 0 ? "good" : vsDraw != null ? "warn" : "violet"}
      />
      <ReviewStatCard
        label="Latest draw"
        value={drawCutoff != null ? String(drawCutoff) : "—"}
        sub={latestDraw ? `Draw #${latestDraw.draw_number}` : "No draw data"}
        tone="neutral"
      />
      <ReviewStatCard
        label="FSW minimum"
        value={`${fsw.total}/100`}
        sub={fsw.eligible ? "Passes 67-point test" : "Below 67 points"}
        tone={fsw.eligible ? "good" : "warn"}
      />
      <ReviewStatCard
        label="Assigned pathway"
        value={assignedPathway ? pathwayShortName(assignedPathway) : "None yet"}
        sub={assignedPathway ? "Saved to case file" : "Your choice below"}
        tone={assignedPathway ? "good" : "neutral"}
      />
    </div>
  );
}

const ALL_PATHWAY_OPTIONS = [
  "Express Entry – Federal Skilled Worker",
  "Express Entry – Canadian Experience Class",
  "Express Entry – Federal Skilled Trades",
  "Provincial Nominee Program",
  "Study Permit",
  "Work Permit",
  "Family Sponsorship",
] as const;

function PathwaySelectRow({
  row,
  isAssigned,
  isRecommended,
  assigning,
  onAssign,
  onClear,
  showClear,
  compact = false,
}: {
  row: PathwayInsight;
  isAssigned: boolean;
  isRecommended?: boolean;
  assigning: string | null;
  onAssign: (backendValue: string, displayName: string) => void;
  onClear?: () => void;
  showClear?: boolean;
  compact?: boolean;
}) {
  const isEligible = row.status === "eligible";
  const isLoading = assigning === row.backendValue;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3.5 transition-colors",
        isAssigned
          ? "border-emerald-200/70 bg-emerald-500/[0.06]"
          : "border-border/60 bg-background hover:border-border",
      )}
    >
      <div className="mt-0.5 shrink-0">
        {isAssigned ? (
          <CheckCircle2 className="size-5 text-emerald-600" />
        ) : row.status === "eligible" ? (
          <CheckCircle2 className="size-5 text-blue-500" />
        ) : row.status === "achievable" ? (
          <TrendingUp className="size-5 text-amber-600" />
        ) : (
          <AlertCircle className="size-5 text-muted-foreground" />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold leading-tight">{pathwayShortName(row.pathway)}</p>
          {isRecommended && !isAssigned && (
            <Badge className="h-5 rounded-md bg-violet-600 px-1.5 text-[10px] text-white">Recommended</Badge>
          )}
          {isAssigned && (
            <Badge variant="outline" className="h-5 rounded-md border-emerald-200/70 text-[10px] text-emerald-700">
              Selected
            </Badge>
          )}
          {!compact && row.status === "achievable" && (
            <Badge variant="outline" className="h-5 rounded-md border-amber-200/70 text-[10px] text-amber-800">
              After improvements
            </Badge>
          )}
          {!compact && row.status === "needs_work" && (
            <Badge variant="outline" className="h-5 rounded-md text-[10px] text-muted-foreground">
              Long-term
            </Badge>
          )}
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {row.improvement?.headline && row.status === "achievable"
            ? row.improvement.headline
            : row.notes}
        </p>
        {row.improvement?.projectedCrs != null && row.status === "achievable" && (
          <p className="text-xs font-medium text-amber-800">Projected CRS ~{row.improvement.projectedCrs}</p>
        )}
      </div>

      <div className="shrink-0">
        {isAssigned ? (
          showClear && onClear ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-lg text-xs"
              disabled={assigning === "__clear__"}
              onClick={onClear}
            >
              {assigning === "__clear__" ? <Loader2 className="size-3.5 animate-spin" /> : "Clear"}
            </Button>
          ) : (
            <span className="text-xs font-medium text-emerald-700">Assigned</span>
          )
        ) : (
          <Button
            size="sm"
            className={cn("h-8 rounded-lg text-xs", isRecommended && isEligible && "bg-violet-600 hover:bg-violet-700")}
            variant={isRecommended && isEligible ? "default" : "outline"}
            disabled={isLoading}
            onClick={() => onAssign(row.backendValue, row.pathway)}
          >
            {isLoading ? "Assigning…" : isEligible ? "Assign" : "Assign anyway"}
          </Button>
        )}
      </div>
    </div>
  );
}

function ConsultantPathwayPicker({
  assignedPathway,
  assigning,
  onAssign,
}: {
  assignedPathway: string | null;
  assigning: string | null;
  onAssign: (backendValue: string, displayName: string) => void;
}) {
  const [selected, setSelected] = useState<string>(ALL_PATHWAY_OPTIONS[0]);
  const [customPathway, setCustomPathway] = useState("");
  const useCustom = selected === "__custom__";
  const pendingValue = useCustom ? customPathway.trim() : selected;
  const isLoading = Boolean(pendingValue) && assigning === pendingValue;

  useEffect(() => {
    if (!assignedPathway) return;
    if ((ALL_PATHWAY_OPTIONS as readonly string[]).includes(assignedPathway)) {
      setSelected(assignedPathway);
      setCustomPathway("");
    } else {
      setSelected("__custom__");
      setCustomPathway(assignedPathway);
    }
  }, [assignedPathway]);

  return (
    <div className="rounded-xl border border-dashed border-primary/30 bg-primary/[0.03] p-4">
      <p className="text-sm font-semibold">Your choice — assign any pathway</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
        Suggestions above are based on the profile. As the consultant, you decide the final immigration route.
      </p>

      <div className="mt-4 space-y-3">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm outline-none focus:border-primary/50"
        >
          {ALL_PATHWAY_OPTIONS.map((p) => (
            <option key={p} value={p}>{pathwayShortName(p)}</option>
          ))}
          <option value="__custom__">Other pathway (type your own)</option>
        </select>

        {useCustom && (
          <input
            type="text"
            value={customPathway}
            onChange={(e) => setCustomPathway(e.target.value)}
            placeholder="e.g. Atlantic Immigration Program"
            maxLength={100}
            className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm outline-none focus:border-primary/50"
          />
        )}

        <Button
          className="w-full gap-2 rounded-xl"
          variant="outline"
          disabled={!pendingValue || isLoading || assignedPathway === pendingValue}
          onClick={() => onAssign(pendingValue, pendingValue)}
        >
          {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Award className="size-4" />}
          {assignedPathway === pendingValue ? "Already assigned" : "Assign selected pathway"}
        </Button>
      </div>
    </div>
  );
}

function PathwayAssignPanel({
  crs,
  fsw,
  person,
  assignedPathway,
  assigning,
  onAssign,
  onClear,
  insights: insightsOverride,
  hasSpouse,
  spouse,
}: {
  crs: CRSBreakdown;
  fsw: FSWBreakdown;
  person: PersonInput;
  assignedPathway: string | null;
  assigning: string | null;
  onAssign: (backendValue: string, displayName: string) => void;
  onClear?: () => void;
  insights?: PathwayInsight[];
  hasSpouse?: boolean;
  spouse?: SpouseInput;
}) {
  const [showFuture, setShowFuture] = useState(false);
  const insights = insightsOverride ?? getPathwayInsights(crs, fsw, person, hasSpouse ?? false, spouse);
  const ready = useMemo(() => insights.filter((i) => i.status === "eligible"), [insights]);
  const future = useMemo(
    () => insights.filter((i) => i.status === "achievable" || i.status === "needs_work"),
    [insights],
  );
  const recommendedId = ready[0]?.backendValue;

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
      <div className="border-b border-border/50 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Award className="size-4 text-violet-600" />
              Assign immigration pathway
            </h2>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Review suggested pathways below, or assign any route you believe is right for this client.
            </p>
          </div>
          {assignedPathway && (
            <Badge variant="outline" className="h-7 gap-1.5 rounded-lg border-emerald-200/70 bg-emerald-500/10 text-emerald-800">
              <CheckCircle2 className="size-3.5" />
              Pathway assigned
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-5 p-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Suggested · ready now · {ready.length}
            </p>
          </div>

          {ready.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-4 py-8 text-center">
              <p className="text-sm font-medium">No pathways are ready yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Review improvement options below or return to Step 1 to update the profile.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {ready.map((row) => (
                <PathwaySelectRow
                  key={row.backendValue}
                  row={row}
                  isAssigned={assignedPathway === row.backendValue}
                  isRecommended={row.backendValue === recommendedId}
                  assigning={assigning}
                  onAssign={onAssign}
                  onClear={onClear}
                  showClear={Boolean(onClear)}
                />
              ))}
            </div>
          )}
        </div>

        {future.length > 0 && (
          <div className="space-y-3 border-t border-border/50 pt-5">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-xl border border-border/60 bg-muted/10 px-4 py-3 text-left transition-colors hover:bg-muted/20"
              onClick={() => setShowFuture((v) => !v)}
            >
              <div>
                <p className="text-sm font-medium">Future &amp; long-term options</p>
                <p className="text-xs text-muted-foreground">{future.length} pathways need improvements or more planning</p>
              </div>
              {showFuture ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
            </button>

            {showFuture && (
              <div className="space-y-2">
                {future.map((row) => (
                  <PathwaySelectRow
                    key={row.backendValue}
                    row={row}
                    isAssigned={assignedPathway === row.backendValue}
                    assigning={assigning}
                    onAssign={onAssign}
                    onClear={onClear}
                    showClear={Boolean(onClear)}
                    compact
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <ConsultantPathwayPicker
          assignedPathway={assignedPathway}
          assigning={assigning}
          onAssign={onAssign}
        />
      </div>
    </div>
  );
}

function IrccVerifyCard({
  mainCrs,
  irccCrsScore,
  onIrccChange,
  rulesVersion,
}: {
  mainCrs: number;
  irccCrsScore: string;
  onIrccChange: (v: string) => void;
  rulesVersion?: string | null;
}) {
  const diff = irccCrsScore ? mainCrs - parseInt(irccCrsScore, 10) : null;
  const aligned = diff != null && Math.abs(diff) <= 5;

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="mb-4 space-y-1">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="size-4 text-blue-600" />
          IRCC score verification
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Cross-check this estimate with the{" "}
          <a href={OFFICIAL_CRS_TOOL_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline-offset-2 hover:underline">
            official IRCC CRS tool
          </a>
          .
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-violet-200/50 bg-violet-500/[0.05] p-4 text-center">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">This calculator</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-violet-700">{mainCrs}</p>
          {rulesVersion && <p className="mt-1 text-[11px] text-muted-foreground">Rules {rulesVersion}</p>}
        </div>
        <div className="rounded-xl border border-border/70 bg-muted/10 p-4 text-center">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">IRCC official</p>
          <input
            type="number"
            min={0}
            max={1200}
            value={irccCrsScore}
            onChange={(e) => onIrccChange(e.target.value)}
            className="mt-1 w-full border-0 bg-transparent text-center text-3xl font-bold tabular-nums outline-none placeholder:text-muted-foreground/40"
            placeholder="—"
          />
        </div>
      </div>

      {diff != null && !Number.isNaN(diff) && (
        <p className={cn("mt-3 text-center text-xs font-medium", aligned ? "text-emerald-700" : "text-amber-700")}>
          Difference: {diff > 0 ? "+" : ""}
          {diff} points{aligned ? " — aligned" : " — review inputs"}
        </p>
      )}
    </div>
  );
}

function AssessmentNotesCard({
  notes,
  onChange,
  onSave,
  saving,
  message,
}: {
  notes: string;
  onChange: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  message: string | null;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
      <div className="mb-4 space-y-1">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="size-4 text-primary" />
          Consultant assessment notes
        </p>
        <p className="text-xs text-muted-foreground">Private notes saved to the client case file.</p>
      </div>
      <textarea
        value={notes}
        onChange={(e) => onChange(e.target.value)}
        rows={6}
        className="w-full resize-y rounded-xl border border-input/80 bg-muted/10 px-3 py-2.5 text-sm leading-relaxed"
        placeholder="Summarize your recommendation, risks, and next steps for this client…"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" className="rounded-lg" onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : "Save notes"}
        </Button>
        {message && <span className="text-xs text-muted-foreground">{message}</span>}
      </div>
    </div>
  );
}

// ─── Accompanying spouse card (prominent toggle) ─────────────────────────────

function AccompanyingSpouseCard({
  enabled, onChange, onRunSimulation,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  onRunSimulation?: () => void;
}) {
  return (
    <div className={cn(
      "rounded-2xl border p-4 transition-all sm:p-5",
      enabled
        ? "border-violet-300/80 bg-gradient-to-br from-violet-500/10 via-background to-fuchsia-500/5 shadow-sm"
        : "border-border/70 bg-card hover:border-violet-200/80",
    )}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <div className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-xl transition-colors",
            enabled ? "bg-violet-600 text-white shadow-sm" : "bg-muted text-muted-foreground",
          )}>
            <Users className="size-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Accompanying spouse or partner</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {enabled
                ? "Spouse details are included in the score. Fill in the spouse section below, then use the comparison tool if you need to decide who should be the main applicant."
                : "Turn this on if your client is immigrating with a spouse or common-law partner."}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Switch
            checked={enabled}
            onCheckedChange={onChange}
            className="scale-110 data-[state=checked]:bg-violet-600"
            aria-label="Include accompanying spouse"
          />
          <span className={cn("text-[10px] font-semibold uppercase tracking-wide", enabled ? "text-violet-700" : "text-muted-foreground")}>
            {enabled ? "Active" : "Off"}
          </span>
        </div>
      </div>

      {enabled && onRunSimulation && (
        <div className="mt-4 flex flex-col gap-2 border-t border-violet-200/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-violet-900/80">
            Compare who should be the main applicant — only when both profiles are complete.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5 rounded-xl border-violet-300 bg-white/80 text-violet-900 hover:bg-violet-50"
            onClick={onRunSimulation}
          >
            <Users className="size-3.5" />
            Compare main vs spouse
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function PathwayCalculatorClient({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise);

  const [step,      setStep]      = useState<1 | 2 | 3>(1);
  const [main,      setMain]      = useState<ExtendedPersonInput>(EXT_DEF_PERSON);
  const [spouse,    setSpouse]    = useState<SpouseInput & { age?: number; englishTestType?: "ielts" | "celpip" }>({ ...DEF_SPOUSE, age: 28 });
  const [hasSpouse,         setHasSpouse]         = useState(false);
  const [principalApplicant, setPrincipalApplicant] = useState<"main" | "spouse">("main");
  const [showCompareModal,  setShowCompareModal]  = useState(false);
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);

  const [assignedPathway, setAssignedPathway] = useState<string | null>(null);
  const [assignedPackageId, setAssignedPackageId] = useState<number | null>(null);
  const [agreementSentAt, setAgreementSentAt] = useState<string | null>(null);
  const [assigning,       setAssigning]       = useState<string | null>(null);
  const [clientName,      setClientName]      = useState<string>("");
  const [prefillLoading,  setPrefillLoading]  = useState(false);
  const [prefillMessage,  setPrefillMessage]  = useState<string | null>(null);
  const [rulesMeta,       setRulesMeta]       = useState<CrsRulesMeta | null>(null);
  const [draws,           setDraws]           = useState<CrsDraw[]>([]);
  const [apiResult,       setApiResult]       = useState<CrsApiResult | null>(null);
  const [calcLoading,     setCalcLoading]     = useState(false);
  const [simulation, setSimulation] = useState<{
    result: CrsApiResult;
    inputKey: string;
    source: "questionnaire" | "manual";
  } | null>(null);
  const [assessmentNotes, setAssessmentNotes] = useState("");
  const [irccCrsScore,    setIrccCrsScore]    = useState<string>("");
  const [savingNotes,     setSavingNotes]     = useState(false);
  const [saveMessage,     setSaveMessage]     = useState<string | null>(null);

  function authHeaders(): Record<string, string> {
    const token =
      document.cookie.match(/wtc_consultant_token=([^;]+)/)?.[1] ??
      localStorage.getItem("wtc_consultant_token") ?? "";
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  }

  useEffect(() => {
    fetch(`${API}/consultant/clients/${id}/case-file`, {
      headers: authHeaders(),
    })
      .then(r => r.json())
      .then(data => {
        setAssignedPathway(data.case_file?.immigration_pathway ?? null);
        setAssignedPackageId(data.case_file?.assigned_ircc_category_id ?? null);
        setAgreementSentAt(data.case_file?.agreement_sent_at ?? null);
        setAssessmentNotes(data.case_file?.pathway_assessment_notes ?? "");
        if (data.case_file?.pathway_assessment_ircc_crs_score != null) {
          setIrccCrsScore(String(data.case_file.pathway_assessment_ircc_crs_score));
        }
        const snap = data.case_file?.pathway_assessment_snapshot as Record<string, unknown> | undefined;
        if (snap?.has_spouse) setHasSpouse(true);
        if (snap?.principal_applicant === "spouse" || snap?.principal_applicant === "main") {
          setPrincipalApplicant(snap.principal_applicant);
        }
        const c = data.client;
        if (c) setClientName(`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim());
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    fetchCrsRules().then(r => setRulesMeta(r.meta)).catch(() => {});
    fetchCrsDraws(8).then(setDraws).catch(() => []);
  }, []);

  const runSimulation = useCallback(async (
    source: "questionnaire" | "manual",
    overrides?: {
      main?: ExtendedPersonInput;
      spouse?: SpouseInput & { age?: number; englishTestType?: "ielts" | "celpip" };
      hasSpouse?: boolean;
      principal?: "main" | "spouse";
    },
  ) => {
    const m = overrides?.main ?? main;
    const s = overrides?.spouse ?? spouse;
    const hs = overrides?.hasSpouse ?? hasSpouse;
    const p = overrides?.principal ?? principalApplicant;
    setCalcLoading(true);
    try {
      const payload = toApiPayload(m, s, hs, p);
      const result = await calculateCrs(payload);
      setSimulation({ result, inputKey: JSON.stringify(payload), source });
      setApiResult(result);
    } catch {
      setSimulation(null);
      setApiResult(null);
    } finally {
      setCalcLoading(false);
    }
  }, [main, spouse, hasSpouse, principalApplicant]);

  const currentSimulationInputKey = useMemo(
    () => JSON.stringify(toApiPayload(main, spouse, hasSpouse, principalApplicant)),
    [main, spouse, hasSpouse, principalApplicant],
  );

  const simulationStale = Boolean(simulation && simulation.inputKey !== currentSimulationInputKey);
  const hasActiveSimulation = Boolean(simulation && !simulationStale);

  const scoreHeroMode: "empty" | "stale" | "active" = !simulation
    ? "empty"
    : simulationStale
      ? "stale"
      : "active";

  async function loadFromQuestionnaire() {
    setPrefillLoading(true);
    setPrefillMessage(null);
    try {
      const res = await fetch(`${API}/consultant/clients/${id}/questionnaire`, { headers: authHeaders() });
      if (!res.ok) throw new Error("No questionnaire found for this client.");
      const data = await res.json();
      const sub = data.submission;
      if (!sub) throw new Error("No questionnaire found for this client.");
      const mapped = mapQuestionnaireToCalculator({
        step1_data: sub.step1_data,
        main_data: sub.main_data,
        spouse_data: sub.spouse_data,
        step3_data: sub.step3_data,
      });
      if (mapped.filledFields.length === 0) {
        setPrefillMessage("Questionnaire exists but has no usable CRS fields yet. Enter scores manually, then run simulation.");
        return;
      }
      const nextMain = mergePersonInput(main, mapped.main);
      const nextSpouse = mergeSpouseInput(spouse, mapped.spouse);
      const nextHasSpouse = mapped.hasSpouse || hasSpouse;
      setMain(nextMain);
      setSpouse(nextSpouse);
      if (mapped.hasSpouse) setHasSpouse(true);
      await runSimulation("questionnaire", {
        main: nextMain,
        spouse: nextSpouse,
        hasSpouse: nextHasSpouse,
      });
      setPrefillMessage(
        `Loaded ${mapped.filledFields.length} field(s) and ran CRS simulation. Review values below — simulated result is not saved until you record it on the case file.`,
      );
    } catch (e) {
      setPrefillMessage(e instanceof Error ? e.message : "Could not load questionnaire.");
    } finally {
      setPrefillLoading(false);
    }
  }

  async function saveAssessment(principalOverride?: "main" | "spouse") {
    const token = localStorage.getItem("wtc_consultant_token") ?? "";
    if (!token) return;
    const principal = principalOverride ?? principalApplicant;
    const clientAsPrincipalCrs = calcCRS(main, hasSpouse, hasSpouse ? spouse : undefined).total;
    const spouseAsPrincipalCrs = calcCRS(spouseToExtendedPerson(spouse), false).total;
    setSavingNotes(true);
    setSaveMessage(null);
    try {
      const payload = toApiPayload(main, spouse, hasSpouse, principal);
      let crsScore = clientAsPrincipalCrs;
      if (hasActiveSimulation && simulation) {
        crsScore = simulation.result.crs.total;
      } else {
        try {
          const result = await calculateCrs(payload);
          crsScore = result.crs.total;
          setSimulation({ result, inputKey: JSON.stringify(payload), source: "manual" });
          setApiResult(result);
        } catch {
          crsScore = principal === "spouse" && hasSpouse ? spouseAsPrincipalCrs : clientAsPrincipalCrs;
        }
      }
      const snapshot = {
        ...payload,
        comparison: hasSpouse ? {
          client_as_principal_crs: clientAsPrincipalCrs,
          spouse_as_principal_crs: spouseAsPrincipalCrs,
          principal_applicant: principal,
          recommended: clientAsPrincipalCrs >= spouseAsPrincipalCrs ? "main" : "spouse",
        } : undefined,
      };
      await savePathwayAssessment(id, token, {
        notes: assessmentNotes,
        crs_score: crsScore,
        ircc_crs_score: irccCrsScore ? parseInt(irccCrsScore, 10) : undefined,
        rules_version: simulation?.result.rules_version ?? apiResult?.rules_version ?? rulesMeta?.version,
        assessment_snapshot: snapshot as Record<string, unknown>,
      });
      setPrincipalApplicant(principal);
      setSaveMessage("Simulation saved to case file.");
    } catch (e) {
      setSaveMessage(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSavingNotes(false);
    }
  }

  async function applyPrincipalAndContinue(who: "main" | "spouse") {
    setPrincipalApplicant(who);
    await saveAssessment(who);
    setShowCompareModal(false);
    setStep(2);
  }

  async function assignPathway(backendValue: string, displayName: string) {
    setAssigning(backendValue);
    try {
      const res = await fetch(
        `${API}/consultant/clients/${id}/case-file/select-pathway`,
        {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ immigration_pathway: backendValue }),
        }
      );
      if (res.ok) {
        setAssignedPathway(backendValue);
        setTimeout(() => setStep(3), 800);
      }
    } finally {
      setAssigning(null);
    }
  }

  async function clearPathway() {
    setAssigning("__clear__");
    try {
      const res = await fetch(
        `${API}/consultant/clients/${id}/case-file/select-pathway`,
        {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ immigration_pathway: null }),
        }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveMessage(typeof json.message === "string" ? json.message : "Could not clear pathway.");
        return;
      }
      setAssignedPathway(null);
      setAssignedPackageId(null);
      setSaveMessage(null);
      if (step === 3) setStep(2);
    } finally {
      setAssigning(null);
    }
  }

  const simulatedCrs = simulation ? apiToBreakdown(simulation.result.crs) : null;
  const simulatedFsw = simulation ? apiToFsw(simulation.result.fsw) : null;

  const spouseAsMain = spouseToExtendedPerson(spouse);
  const spouseCRS = calcCRS(spouseAsMain, false);
  const spouseFSW = calcFSW(spouseAsMain);

  const activeCRS = simulatedCrs ?? calcCRS(main, hasSpouse, hasSpouse ? spouse : undefined);
  const activeFSW = simulatedFsw ?? calcFSW(main);
  const activePerson: PersonInput = principalApplicant === "spouse" && hasSpouse ? spouseAsMain : main;
  const activeHasSpouse = hasSpouse;
  const activeSpouseForInsights =
    hasSpouse && principalApplicant === "spouse"
      ? personToSpouseFields(main)
      : hasSpouse
        ? spouse
        : undefined;
  const canClearPathway = !agreementSentAt;

  return (
    <div className="min-w-0 w-full space-y-5 overflow-x-hidden pb-6 sm:space-y-6">

      <WorkspaceSubpageHero
        profileId={id}
        stepLabel="Step 1 · Intake & pathway"
        title="Pathway calculator"
        description="Load your client's details, calculate their CRS score, and choose the right Canadian immigration pathway — all in three guided steps."
        illustration={INTAKE_WORKSPACE_TASKS[1].illustration}
        illustrationAlt={INTAKE_WORKSPACE_TASKS[1].illustrationAlt}
      >
        {assignedPathway && (
          <Badge variant="outline" className="h-8 gap-1.5 rounded-xl border-emerald-200/70 bg-emerald-500/10 px-3 text-emerald-800">
            <CheckCircle2 className="size-3.5" />
            {assignedPathway}
          </Badge>
        )}
        {clientName && (
          <Badge variant="outline" className="h-8 rounded-xl px-3 text-xs">
            {clientName}
          </Badge>
        )}
      </WorkspaceSubpageHero>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* ── Main workflow column ─────────────────────────────────────── */}
        <div className="min-w-0 space-y-5">
          <WorkflowGuideCard
            step={step}
            onStep={setStep}
            hasActiveSimulation={hasActiveSimulation}
            assignedPathway={assignedPathway}
          >
            <StepNavButtons
              step={step}
              hasActiveSimulation={hasActiveSimulation}
              assignedPathway={assignedPathway}
              onStep={setStep}
            />
          </WorkflowGuideCard>

          {step === 1 && (
            <>
              <HowItWorksCard
                onLoad={loadFromQuestionnaire}
                onSimulate={() => { void runSimulation("manual"); }}
                loadLoading={prefillLoading}
                simulateLoading={calcLoading}
                prefillMessage={prefillMessage}
                hasActiveSimulation={hasActiveSimulation}
              />

              <AccompanyingSpouseCard
                enabled={hasSpouse}
                onChange={(v) => {
                  setHasSpouse(v);
                  if (!v) setPrincipalApplicant("main");
                }}
                onRunSimulation={() => setShowCompareModal(true)}
              />

              <PersonForm data={main} onChange={setMain} label="Client profile" />

              {hasSpouse && (
                <div className="rounded-xl border border-violet-200/60 bg-violet-500/[0.04] p-4">
                  <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-violet-900">
                    <Users className="size-4 text-violet-600" />
                    Spouse or partner
                  </p>
                  <SpouseForm data={spouse} onChange={setSpouse} />
                </div>
              )}
            </>
          )}

          {step === 2 && !hasActiveSimulation && (
            <div className="rounded-2xl border border-amber-300/70 bg-amber-50/80 p-6 text-center">
              <AlertCircle className="mx-auto size-8 text-amber-700" />
              <p className="mt-3 text-sm font-semibold text-amber-950">
                {simulationStale ? "Score needs updating" : "Calculate a score first"}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-amber-900/90">
                {simulationStale
                  ? "You changed client details. Go back and calculate the score again."
                  : "Load the questionnaire or calculate the score in Step 1 before choosing a pathway."}
              </p>
              <Button className="mt-4 gap-2 rounded-xl" onClick={() => { setStep(1); void runSimulation("manual"); }} disabled={calcLoading}>
                {calcLoading ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4" />}
                Go to Step 1
              </Button>
            </div>
          )}

          {step === 2 && hasActiveSimulation && (
            <div className="space-y-6">
              <ReviewStepSummary crs={activeCRS} fsw={activeFSW} assignedPathway={assignedPathway} draws={draws} />

              {hasSpouse && (
                <PrincipalApplicantBanner
                  principal={principalApplicant}
                  mainCrs={calcCRS(main, true, spouse).total}
                  spouseCrs={spouseCRS.total}
                  onChange={setPrincipalApplicant}
                />
              )}

              <PathwayAssignPanel
                crs={activeCRS}
                fsw={activeFSW}
                person={activePerson}
                assignedPathway={assignedPathway}
                assigning={assigning}
                onAssign={assignPathway}
                onClear={canClearPathway ? clearPathway : undefined}
                hasSpouse={activeHasSpouse}
                spouse={activeSpouseForInsights}
              />

              <AssessmentNotesCard
                notes={assessmentNotes}
                onChange={setAssessmentNotes}
                onSave={saveAssessment}
                saving={savingNotes}
                message={saveMessage}
              />

              <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 border-b border-border/50 bg-muted/10 px-5 py-4 text-left transition-colors hover:bg-muted/20"
                  onClick={() => setShowScoreBreakdown(!showScoreBreakdown)}
                >
                  <div>
                    <p className="text-sm font-semibold">Detailed score breakdown</p>
                    <p className="text-xs text-muted-foreground">See how CRS points were calculated</p>
                  </div>
                  {showScoreBreakdown ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
                </button>
                {showScoreBreakdown && (
                  <div className="border-t border-border/50 p-5">
                    <ScoreDetailPanel crs={activeCRS} fsw={activeFSW} />
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              {assignedPathway && (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-200/70 bg-emerald-500/[0.08] px-4 py-3">
                  <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-emerald-900">Pathway assigned</p>
                    <p className="text-xs text-emerald-800">{assignedPathway}</p>
                  </div>
                  {canClearPathway && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 border-green-300 text-xs text-green-800 hover:bg-green-100"
                      disabled={assigning === "__clear__"}
                      onClick={clearPathway}
                    >
                      {assigning === "__clear__" ? <Loader2 className="h-3 w-3 animate-spin" /> : <><X className="mr-1 h-3 w-3" />Clear</>}
                    </Button>
                  )}
                </div>
              )}
              <IrccFormExplorer
                clientProfileId={id}
                assignedCategoryId={assignedPackageId}
                onAssigned={setAssignedPackageId}
              />
              <div className="flex justify-end">
                <Link href={`/dashboard/clients/${id}/workspace`}>
                  <Button variant="outline" className="gap-2 rounded-xl">
                    Back to Intake &amp; pathway
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* ── Sticky results sidebar ───────────────────────────────────── */}
        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <SimulationStatusBanner
            mode={scoreHeroMode}
            crsTotal={hasActiveSimulation ? activeCRS.total : undefined}
            source={simulation?.source}
            fswTotal={hasActiveSimulation ? activeFSW.total : undefined}
            fswEligible={hasActiveSimulation ? activeFSW.eligible : undefined}
            drawCutoff={draws[0]?.minimum_crs_score ?? null}
            vsDraw={
              hasActiveSimulation && draws[0]?.minimum_crs_score != null
                ? activeCRS.total - draws[0].minimum_crs_score
                : null
            }
          />

          {step === 1 && (
            <LiveScorePreview
              clientId={Number(id)}
              crs={activeCRS}
              fsw={activeFSW}
              person={activePerson}
              assignedPathway={assignedPathway}
              hasSpouse={activeHasSpouse}
              spouse={activeSpouseForInsights}
              hasActiveSimulation={hasActiveSimulation}
              onNext={hasActiveSimulation ? () => setStep(2) : undefined}
            />
          )}

          {step === 2 && hasActiveSimulation && (
            <>
              <IrccVerifyCard
                mainCrs={activeCRS.total}
                irccCrsScore={irccCrsScore}
                onIrccChange={setIrccCrsScore}
                rulesVersion={simulation?.result.rules_version ?? rulesMeta?.version}
              />
              <div className="rounded-xl border border-amber-200/60 bg-amber-500/[0.05] px-4 py-3">
                <p className="flex items-start gap-2 text-xs text-amber-900">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  Confirm final scores with the official IRCC tool before advising your client.
                </p>
              </div>
            </>
          )}

          {step === 1 && !hasActiveSimulation && (
            <Button
              className="w-full gap-2 rounded-xl"
              onClick={() => { void runSimulation("manual"); }}
              disabled={calcLoading || prefillLoading}
            >
              {calcLoading ? <Loader2 className="size-4 animate-spin" /> : <Calculator className="size-4" />}
              Calculate score
            </Button>
          )}
        </aside>
      </div>

      <SpouseCompareModal
        open={showCompareModal && hasSpouse}
        onClose={() => setShowCompareModal(false)}
        mainCRS={calcCRS(main, true, spouse)} mainFSW={calcFSW(main)}
        spouseCRS={spouseCRS} spouseFSW={spouseFSW}
        onChoosePrincipal={(who) => void applyPrincipalAndContinue(who)}
        saving={savingNotes}
      />

    </div>
  );
}
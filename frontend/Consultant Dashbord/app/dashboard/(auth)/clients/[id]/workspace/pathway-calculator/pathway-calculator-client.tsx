"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Award, Briefcase, Calculator,
  ChevronDown, ChevronRight, ChevronUp,
  CheckCircle2, XCircle, AlertCircle, Users,
  FileText, GraduationCap, Languages, Star,
  TrendingUp, Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { IrccFormExplorer } from "./ircc-form-explorer";

// ─── Types ─────────────────────────────────────────────────────────────────────

type EducationLevel =
  | "none" | "secondary" | "one_year" | "two_year"
  | "bachelors" | "two_or_more" | "masters" | "doctoral";

interface LangCLB { speaking: number; listening: number; reading: number; writing: number; }

interface PersonInput {
  age: number;
  education: EducationLevel;
  canadianEducation: "none" | "one_two_year" | "three_plus";
  // IELTS scores → converted to CLB
  ielts: { speaking: number; listening: number; reading: number; writing: number };
  // French (TEF/TCF as CLB directly, 0 = none)
  frenchCLB: { speaking: number; listening: number; reading: number; writing: number };
  canadianWorkExp: number;   // years
  foreignWorkExp: number;    // years
  jobOffer: "none" | "noc00" | "noc_a_b" | "noc_c_d";
  provincialNomination: boolean;
  siblingInCanada: boolean;
  certificateOfQualification: boolean;
}

interface SpouseInput {
  education: EducationLevel;
  ielts: { speaking: number; listening: number; reading: number; writing: number };
  canadianWorkExp: number;
}

// ─── Scoring Tables ─────────────────────────────────────────────────────────

function ieltsToCLB(s: number, l: number, r: number, w: number): LangCLB {
  return {
    speaking: speakCLB(s),
    listening: listenCLB(l),
    reading: readCLB(r),
    writing: writeCLB(w),
  };
}
function speakCLB(v: number): number {
  if (v >= 7.5) return 10; if (v >= 7.0) return 9; if (v >= 6.5) return 8;
  if (v >= 6.0) return 7;  if (v >= 5.5) return 6; if (v >= 5.0) return 5;
  if (v >= 4.5) return 4;  return 0;
}
function listenCLB(v: number): number {
  if (v >= 8.5) return 10; if (v >= 8.0) return 9; if (v >= 7.5) return 8;
  if (v >= 6.0) return 7;  if (v >= 5.5) return 6; if (v >= 5.0) return 5;
  if (v >= 4.5) return 4;  return 0;
}
function readCLB(v: number): number {
  if (v >= 8.0) return 10; if (v >= 7.0) return 9; if (v >= 6.5) return 8;
  if (v >= 6.0) return 7;  if (v >= 5.0) return 6; if (v >= 4.0) return 5;
  if (v >= 3.5) return 4;  return 0;
}
function writeCLB(v: number): number {
  if (v >= 7.5) return 10; if (v >= 7.0) return 9; if (v >= 6.5) return 8;
  if (v >= 6.0) return 7;  if (v >= 5.5) return 6; if (v >= 5.0) return 5;
  if (v >= 4.0) return 4;  return 0;
}

// CRS Age Points
function crsAge(age: number, hasSpouse: boolean): number {
  const t: Record<number, [number, number]> = {
    17: [0, 0], 18: [99, 90], 19: [105, 95],
  };
  if (age <= 17) return 0;
  if (age <= 19) return hasSpouse ? t[age][1] : t[age][0];
  if (age <= 29) return hasSpouse ? 100 : 110;
  const noSpouse = [105, 99, 94, 88, 83, 77, 72, 66, 61, 55, 50, 39, 28, 17, 6, 0];
  const withSpouse = [100, 95, 90, 85, 80, 75, 70, 65, 60, 55, 50, 39, 28, 17, 6, 0];
  const idx = Math.min(age - 30, 15);
  return hasSpouse ? withSpouse[idx] : noSpouse[idx];
}

// CRS Education Points
function crsEdu(level: EducationLevel, hasSpouse: boolean): number {
  const table: Record<EducationLevel, [number, number]> = {
    none:        [0,   0],
    secondary:   [30,  28],
    one_year:    [90,  84],
    two_year:    [98,  91],
    bachelors:   [120, 112],
    two_or_more: [128, 119],
    masters:     [135, 126],
    doctoral:    [150, 140],
  };
  return hasSpouse ? table[level][1] : table[level][0];
}

// CRS First Language Points (per CLB level, per skill)
function firstLangPts(clb: number, hasSpouse: boolean): number {
  if (clb <= 4)  return 0;
  if (clb === 5) return 6;
  if (clb === 6) return hasSpouse ? 8  : 9;
  if (clb === 7) return hasSpouse ? 16 : 17;
  if (clb === 8) return hasSpouse ? 22 : 23;
  if (clb === 9) return hasSpouse ? 29 : 31;
  return hasSpouse ? 32 : 34; // CLB 10+
}

// CRS Second Language Points (per CLB per skill)
function secondLangPts(clb: number, hasSpouse: boolean): number {
  if (clb <= 4)  return 0;
  if (clb <= 6)  return 1;
  if (clb <= 8)  return hasSpouse ? 3 : 3;
  return hasSpouse ? 4 : 6; // CLB 9+
}

// CRS Canadian Work Experience Points
function crsCanWE(years: number, hasSpouse: boolean): number {
  if (years <= 0) return 0;
  const noSpouse  = [0, 40, 53, 64, 72, 80];
  const withSpouse = [0, 35, 46, 56, 63, 70];
  const idx = Math.min(years, 5);
  return hasSpouse ? withSpouse[idx] : noSpouse[idx];
}

// Spouse factors
function spouseEduPts(level: EducationLevel): number {
  const t: Record<EducationLevel, number> = {
    none: 0, secondary: 2, one_year: 6, two_year: 7,
    bachelors: 8, two_or_more: 9, masters: 10, doctoral: 10,
  };
  return t[level];
}
function spouseLangPts(clb: number): number {
  if (clb <= 4) return 0; if (clb <= 6) return 1; if (clb <= 8) return 3; return 5;
}
function spouseCanWEPts(years: number): number {
  const t = [0, 5, 7, 8, 9, 10];
  return t[Math.min(years, 5)];
}

// Skill Transferability
function calcSkillTransfer(
  edu: EducationLevel, firstCLB: LangCLB, canWE: number, foreignWE: number,
  certOfQual: boolean
): number {
  const hasDegree = !["none", "secondary"].includes(edu);
  const firstAvgCLB = Math.min(...Object.values(firstCLB));
  const clb7 = firstAvgCLB >= 7;
  const clb9 = firstAvgCLB >= 9;
  let pts = 0;

  // Group A: Education + Language
  if (hasDegree) {
    if (clb9) pts += 50; else if (clb7) pts += 25;
  }
  // Group B: Education + Canadian WE
  if (hasDegree && canWE >= 1) {
    pts += canWE >= 2 ? 50 : 25;
  }
  // Group C: Foreign WE + Language
  if (foreignWE >= 1) {
    const fwe3 = foreignWE >= 3;
    if (clb9) pts += fwe3 ? 50 : 25; else if (clb7) pts += fwe3 ? 25 : 13;
  }
  // Group D: Foreign WE + Canadian WE
  if (foreignWE >= 1 && canWE >= 1) {
    const fwe3 = foreignWE >= 3; const cwe2 = canWE >= 2;
    if (fwe3 && cwe2) pts += 50; else if (fwe3 || cwe2) pts += 25; else pts += 13;
  }
  // Group E: Certificate of qualification + Language
  if (certOfQual) {
    if (clb7) pts += 50; else if (firstAvgCLB >= 5) pts += 25;
  }

  return Math.min(pts, 100);
}

// Additional Points
function calcAdditional(
  siblingCA: boolean, frCLB: LangCLB, canadianEdu: "none" | "one_two_year" | "three_plus",
  jobOffer: string, pn: boolean, firstCLB: LangCLB
): number {
  let pts = 0;
  if (siblingCA) pts += 15;
  const frMin = Math.min(...Object.values(frCLB));
  const enMin = Math.min(...Object.values(firstCLB));
  if (frMin >= 7 && enMin < 5)  pts += 50;
  else if (frMin >= 7)          pts += 50;
  else if (frMin >= 5)          pts += 25;
  if (canadianEdu === "three_plus")  pts += 30;
  else if (canadianEdu === "one_two_year") pts += 15;
  if (pn) pts += 600;
  else {
    if (jobOffer === "noc00")    pts += 200;
    else if (jobOffer === "noc_a_b") pts += 50;
  }
  return pts;
}

// ─── CRS Full Score ─────────────────────────────────────────────────────────

interface CRSBreakdown {
  humanCapital: number;
  skillTransfer: number;
  additional: number;
  total: number;
  // sub-details
  agePts: number;
  eduPts: number;
  firstLangTotal: number;
  secondLangTotal: number;
  canWEPts: number;
  spousePts: number;
  firstCLB: LangCLB;
}

function calcCRS(
  p: PersonInput,
  hasSpouse: boolean,
  spouse?: SpouseInput
): CRSBreakdown {
  const firstCLB = ieltsToCLB(p.ielts.speaking, p.ielts.listening, p.ielts.reading, p.ielts.writing);
  const frCLB    = p.frenchCLB;

  const agePts     = crsAge(p.age, hasSpouse);
  const eduPts     = crsEdu(p.education, hasSpouse);
  const firstLangTotal =
    firstLangPts(firstCLB.speaking,  hasSpouse) +
    firstLangPts(firstCLB.listening, hasSpouse) +
    firstLangPts(firstCLB.reading,   hasSpouse) +
    firstLangPts(firstCLB.writing,   hasSpouse);
  const secondLangTotal =
    secondLangPts(frCLB.speaking,  hasSpouse) +
    secondLangPts(frCLB.listening, hasSpouse) +
    secondLangPts(frCLB.reading,   hasSpouse) +
    secondLangPts(frCLB.writing,   hasSpouse);
  const canWEPts = crsCanWE(p.canadianWorkExp, hasSpouse);

  let spousePts = 0;
  if (hasSpouse && spouse) {
    const spCLB = ieltsToCLB(spouse.ielts.speaking, spouse.ielts.listening, spouse.ielts.reading, spouse.ielts.writing);
    spousePts =
      spouseEduPts(spouse.education) +
      spouseLangPts(spCLB.speaking) + spouseLangPts(spCLB.listening) +
      spouseLangPts(spCLB.reading)  + spouseLangPts(spCLB.writing) +
      spouseCanWEPts(spouse.canadianWorkExp);
  }

  const humanCapital = agePts + eduPts + firstLangTotal + secondLangTotal + canWEPts + spousePts;
  const skillTransfer = calcSkillTransfer(p.education, firstCLB, p.canadianWorkExp, p.foreignWorkExp, p.certificateOfQualification);
  const additional    = calcAdditional(p.siblingInCanada, frCLB, p.canadianEducation, p.jobOffer, p.provincialNomination, firstCLB);

  return {
    humanCapital, skillTransfer, additional,
    total: humanCapital + skillTransfer + additional,
    agePts, eduPts, firstLangTotal, secondLangTotal, canWEPts, spousePts, firstCLB,
  };
}

// ─── FSW 67-Point Test ────────────────────────────────────────────────────────

interface FSWBreakdown {
  language: number; education: number; experience: number;
  age: number; arranged: number; adaptability: number;
  total: number; eligible: boolean;
}

function calcFSW(p: PersonInput): FSWBreakdown {
  const clb = ieltsToCLB(p.ielts.speaking, p.ielts.listening, p.ielts.reading, p.ielts.writing);
  const avgCLB = (clb.speaking + clb.listening + clb.reading + clb.writing) / 4;

  // Language (max 28)
  let language = 0;
  if (avgCLB >= 9) language = 24; else if (avgCLB >= 8) language = 20;
  else if (avgCLB >= 7) language = 16; else if (avgCLB >= 6) language = 8;
  else if (avgCLB >= 5) language = 4; else if (avgCLB >= 4) language = 2;
  // French bonus (up to 4 more)
  const frMin = Math.min(...Object.values(p.frenchCLB));
  if (frMin >= 5) language = Math.min(28, language + 4);

  // Education (max 25)
  const eduMap: Record<EducationLevel, number> = {
    none: 0, secondary: 5, one_year: 15, two_year: 19,
    bachelors: 21, two_or_more: 22, masters: 23, doctoral: 25,
  };
  const education = eduMap[p.education];

  // Experience (max 15)
  const expMap = [0, 9, 11, 13, 15, 15];
  const experience = expMap[Math.min(p.foreignWorkExp + p.canadianWorkExp, 5)];

  // Age (max 12)
  let age = 0;
  if (p.age >= 18 && p.age <= 35) age = 12;
  else if (p.age === 36 || p.age === 16) age = 11;
  else if (p.age === 37 || p.age === 17) age = 10;
  else if (p.age === 38) age = 9; else if (p.age === 39) age = 8;
  else if (p.age === 40) age = 7; else if (p.age === 41) age = 6;
  else if (p.age === 42) age = 5; else if (p.age === 43) age = 4;
  else if (p.age === 44) age = 3; else if (p.age === 45) age = 2;

  // Arranged employment (max 10)
  const arranged = p.jobOffer !== "none" ? 10 : 0;

  // Adaptability (max 10) — simplified
  let adaptability = 0;
  if (p.canadianWorkExp >= 1) adaptability += 5;
  if (p.siblingInCanada) adaptability += 5;
  adaptability = Math.min(adaptability, 10);

  const total = language + education + experience + age + arranged + adaptability;
  return { language, education, experience, age, arranged, adaptability, total, eligible: total >= 67 };
}

// ─── Pathway Eligibility ────────────────────────────────────────────────────

function getPathwayRecs(crs: CRSBreakdown, fsw: FSWBreakdown, p: PersonInput): {
  pathway: string; backendValue: string; eligible: boolean; notes: string; color: string
}[] {
  const clb = crs.firstCLB;
  const minCLB = Math.min(clb.speaking, clb.listening, clb.reading, clb.writing);

  return [
    {
      pathway: "Express Entry – Federal Skilled Worker",
      backendValue: "Express Entry – Federal Skilled Worker",
      eligible: fsw.eligible && minCLB >= 7 && p.foreignWorkExp >= 1,
      notes: fsw.eligible
        ? `FSW score ${fsw.total}/100 ✓ | CRS ${crs.total} pts`
        : `FSW score ${fsw.total}/100 — needs 67+`,
      color: "green",
    },
    {
      pathway: "Express Entry – Canadian Experience Class",
      backendValue: "Express Entry – Canadian Experience Class",
      eligible: p.canadianWorkExp >= 1 && minCLB >= 7,
      notes: p.canadianWorkExp >= 1 ? `${p.canadianWorkExp} yr Canadian WE ✓ | CLB ${minCLB}` : "Needs ≥1 yr Canadian work experience",
      color: "green",
    },
    {
      pathway: "Express Entry – Federal Skilled Trades",
      backendValue: "Express Entry – Federal Skilled Trades",
      eligible: p.certificateOfQualification && minCLB >= 5,
      notes: p.certificateOfQualification ? "Certificate of qualification ✓" : "Needs trade certificate",
      color: "blue",
    },
    {
      pathway: "Provincial Nominee Program (General)",
      backendValue: "Provincial Nominee Program",
      eligible: crs.total >= 300,
      notes: crs.total >= 300 ? `CRS ${crs.total} — competitive for PNP streams` : `CRS ${crs.total} — strengthen profile first`,
      color: "orange",
    },
    {
      pathway: "Study Permit → PR",
      backendValue: "Study Permit",
      eligible: p.age <= 35,
      notes: p.age <= 35 ? "Age-eligible; study leads to PGWP & CEC" : "Path still possible but less optimal",
      color: "blue",
    },
    {
      pathway: "Work Permit → PR",
      backendValue: "Work Permit",
      eligible: p.foreignWorkExp >= 1,
      notes: p.foreignWorkExp >= 1 ? "Foreign WE ✓ — PGWP or LMIA work permit route" : "Requires job offer or work experience",
      color: "blue",
    },
    {
      pathway: "Family Sponsorship",
      backendValue: "Family Sponsorship",
      eligible: false,
      notes: "Requires a Canadian citizen / PR sponsor",
      color: "gray",
    },
  ];
}

// ─── Education label helper ──────────────────────────────────────────────────

const EDU_LABELS: Record<EducationLevel, string> = {
  none:        "Less than secondary",
  secondary:   "Secondary school diploma",
  one_year:    "1-year post-secondary",
  two_year:    "2-year post-secondary",
  bachelors:   "Bachelor's degree (3+ yr)",
  two_or_more: "Two+ degrees (one 3+ yr)",
  masters:     "Master's / Professional",
  doctoral:    "Doctoral (PhD)",
};

// ─── Default inputs ──────────────────────────────────────────────────────────

const DEF_PERSON: PersonInput = {
  age: 28, education: "bachelors", canadianEducation: "none",
  ielts: { speaking: 6.5, listening: 7.5, reading: 6.5, writing: 6.5 },
  frenchCLB: { speaking: 0, listening: 0, reading: 0, writing: 0 },
  canadianWorkExp: 0, foreignWorkExp: 3,
  jobOffer: "none", provincialNomination: false,
  siblingInCanada: false, certificateOfQualification: false,
};
const DEF_SPOUSE: SpouseInput = {
  education: "bachelors",
  ielts: { speaking: 6.0, listening: 6.0, reading: 6.0, writing: 6.0 },
  canadianWorkExp: 0,
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
        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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

function SectionCard({ title, icon: Icon, children, defaultOpen = true }: {
  title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border bg-card">
      <button
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left"
        onClick={() => setOpen(!open)}
      >
        <Icon className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-semibold flex-1">{title}</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 gap-3">{children}</div>}
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
  data: PersonInput; onChange: (d: PersonInput) => void; label: string;
}) {
  const set = <K extends keyof PersonInput>(k: K, v: PersonInput[K]) =>
    onChange({ ...data, [k]: v });
  const setIelts = (k: keyof PersonInput["ielts"], v: number) =>
    onChange({ ...data, ielts: { ...data.ielts, [k]: v } });
  const setFr = (k: keyof PersonInput["frenchCLB"], v: number) =>
    onChange({ ...data, frenchCLB: { ...data.frenchCLB, [k]: v } });

  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-muted-foreground uppercase tracking-wide">{label}</p>

      <SectionCard title="Personal" icon={Users}>
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

      <SectionCard title="English – IELTS Scores" icon={Languages}>
        <NumInput label="Speaking" value={data.ielts.speaking} onChange={v => setIelts("speaking", v)} min={0} max={9} step={0.5} />
        <NumInput label="Listening" value={data.ielts.listening} onChange={v => setIelts("listening", v)} min={0} max={9} step={0.5} />
        <NumInput label="Reading" value={data.ielts.reading} onChange={v => setIelts("reading", v)} min={0} max={9} step={0.5} />
        <NumInput label="Writing" value={data.ielts.writing} onChange={v => setIelts("writing", v)} min={0} max={9} step={0.5} />
        <div className="col-span-2">
          {(() => {
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
        </div>
      </SectionCard>

      <SectionCard title="French – CLB Levels (optional)" icon={Globe} defaultOpen={false}>
        <NumInput label="Speaking CLB" value={data.frenchCLB.speaking} onChange={v => setFr("speaking", v)} min={0} max={12} />
        <NumInput label="Listening CLB" value={data.frenchCLB.listening} onChange={v => setFr("listening", v)} min={0} max={12} />
        <NumInput label="Reading CLB" value={data.frenchCLB.reading} onChange={v => setFr("reading", v)} min={0} max={12} />
        <NumInput label="Writing CLB" value={data.frenchCLB.writing} onChange={v => setFr("writing", v)} min={0} max={12} />
      </SectionCard>

      <SectionCard title="Work Experience" icon={Briefcase}>
        <NumInput label="Canadian WE (years)" value={data.canadianWorkExp} onChange={v => set("canadianWorkExp", v)} min={0} max={10} />
        <NumInput label="Foreign WE (years)" value={data.foreignWorkExp} onChange={v => set("foreignWorkExp", v)} min={0} max={15} />
      </SectionCard>

      <SectionCard title="Additional Factors" icon={Star} defaultOpen={false}>
        <div className="col-span-3">
          <SelectInput label="Job Offer (LMIA-approved)" value={data.jobOffer}
            onChange={v => set("jobOffer", v as PersonInput["jobOffer"])}
            options={[
              { value: "none", label: "No job offer" },
              { value: "noc00", label: "Senior manager / Director (NOC 00) – +200 pts" },
              { value: "noc_a_b", label: "NOC TEER 1, 2 or 3 – +50 pts" },
              { value: "noc_c_d", label: "NOC TEER 4 or 5" },
            ]} />
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

function SpouseForm({ data, onChange }: { data: SpouseInput; onChange: (d: SpouseInput) => void }) {
  const set = <K extends keyof SpouseInput>(k: K, v: SpouseInput[K]) => onChange({ ...data, [k]: v });
  const setIelts = (k: keyof SpouseInput["ielts"], v: number) =>
    onChange({ ...data, ielts: { ...data.ielts, [k]: v } });

  return (
    <div className="space-y-3">
      <p className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Spouse / Partner</p>
      <SectionCard title="Spouse Education &amp; Work" icon={GraduationCap}>
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
}: {
  open: boolean; onClose: () => void;
  mainCRS: CRSBreakdown; mainFSW: FSWBreakdown;
  spouseCRS: CRSBreakdown; spouseFSW: FSWBreakdown;
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
              <h2 className="text-sm font-bold">Side-by-Side Score Comparison</h2>
              <p className="text-xs text-muted-foreground">Who should apply as the main applicant?</p>
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
        <div className="px-6 pb-4">
          <Button onClick={onClose} className="w-full">
            Close Comparison
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Live CRS Score Preview (Step 1 — right panel) ──────────────────────────

function LiveScorePreview({ crs, fsw, person, assignedPathway }: {
  crs: CRSBreakdown; fsw: FSWBreakdown;
  person: PersonInput; assignedPathway: string | null;
}) {
  const recs = getPathwayRecs(crs, fsw, person);
  const eligible = recs.filter(r => r.eligible);
  const ringClass =
    crs.total >= 470 ? "border-green-300 bg-green-50"  :
    crs.total >= 400 ? "border-blue-300 bg-blue-50"    :
    crs.total >= 300 ? "border-amber-300 bg-amber-50"  :
                       "border-rose-300 bg-rose-50";
  const numClass =
    crs.total >= 470 ? "text-green-600" :
    crs.total >= 400 ? "text-blue-600"  :
    crs.total >= 300 ? "text-amber-600" :
                       "text-rose-500";
  const barClass =
    crs.total >= 470 ? "bg-green-500" :
    crs.total >= 400 ? "bg-blue-500"  :
    crs.total >= 300 ? "bg-amber-500" :
                       "bg-rose-500";
  const scoreLabel =
    crs.total >= 470 ? "Excellent" :
    crs.total >= 400 ? "Strong"    :
    crs.total >= 300 ? "Average"   : "Needs Work";

  return (
    <div className="space-y-3 sticky top-4">
      {/* Big CRS Score */}
      <div className={cn("rounded-xl border-2 p-5", ringClass)}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">CRS Score</p>
          <Badge variant="outline" className="text-xs">{scoreLabel}</Badge>
        </div>
        <div className="flex items-end gap-2 mb-3">
          <span className={cn("text-5xl font-black leading-none", numClass)}>{crs.total}</span>
          <span className="text-lg text-muted-foreground pb-1">/ 1,200</span>
        </div>
        <ScoreBar value={crs.total} max={1200} color={barClass} />
        <div className="grid grid-cols-3 gap-2 mt-3 text-center">
          {[
            { label: "Human Capital", value: crs.humanCapital,  max: 500 },
            { label: "Skill Transfer", value: crs.skillTransfer, max: 100 },
            { label: "Additional",    value: crs.additional,    max: 600 },
          ].map(r => (
            <div key={r.label} className="rounded-lg bg-white/60 p-1.5">
              <p className="text-[10px] text-muted-foreground leading-tight">{r.label}</p>
              <p className="text-base font-bold">{r.value}</p>
              <p className="text-[9px] text-muted-foreground">/{r.max}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CLB Grid */}
      <div className="rounded-xl border bg-card p-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">English CLB</p>
        <div className="grid grid-cols-4 gap-1.5">
          {(["speaking", "listening", "reading", "writing"] as const).map(k => {
            const v = crs.firstCLB[k];
            return (
              <div key={k} className={cn("rounded-md p-1.5 text-center border",
                v >= 9 ? "bg-green-50 border-green-200" :
                v >= 7 ? "bg-blue-50 border-blue-200"   :
                v >= 5 ? "bg-amber-50 border-amber-200"  :
                         "bg-rose-50 border-rose-200"
              )}>
                <p className="text-[9px] text-muted-foreground capitalize">{k.slice(0, 4)}</p>
                <p className={cn("text-sm font-extrabold",
                  v >= 9 ? "text-green-700" : v >= 7 ? "text-blue-700" :
                  v >= 5 ? "text-amber-700"  : "text-rose-700"
                )}>CLB{v}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* FSW Quick */}
      <div className={cn("rounded-xl border p-3 flex items-center gap-3",
        fsw.eligible ? "bg-green-50 border-green-200" : "bg-rose-50 border-rose-200"
      )}>
        {fsw.eligible
          ? <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          : <XCircle      className="h-4 w-4 text-rose-500 shrink-0" />}
        <div>
          <p className="text-xs font-semibold">FSW 67-Point Test</p>
          <p className={cn("text-xs", fsw.eligible ? "text-green-700" : "text-rose-600")}>
            {fsw.total}/100 — {fsw.eligible ? "ELIGIBLE ✓" : "Needs 67+ (not yet eligible)"}
          </p>
        </div>
      </div>

      {/* Pathway Eligibility Preview */}
      <div className="rounded-xl border bg-card p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Pathway Eligibility</p>
          <Badge variant="outline" className="text-xs">{eligible.length} eligible</Badge>
        </div>
        <div className="space-y-1">
          {recs.map(r => (
            <div key={r.pathway} className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs",
              r.eligible ? "bg-green-50" : "bg-muted/30"
            )}>
              {r.eligible
                ? <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                : <AlertCircle  className="h-3 w-3 text-muted-foreground shrink-0" />}
              <span className={cn("flex-1 truncate",
                r.eligible ? "text-green-800 font-medium" : "text-muted-foreground"
              )}>{r.pathway}</span>
              {r.backendValue === assignedPathway && (
                <Badge className="bg-green-600 text-white text-[9px] py-0 px-1 h-3.5">✓</Badge>
              )}
            </div>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center px-2">
        Live preview — updates as you type
      </p>
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
            { icon: Star,          tip: "LMIA job offer: +50 (NOC A/B) or +200 (NOC 00)" },
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

// ─── Step 2 — Pathway Assignment Panel (right column) ────────────────────────

function PathwayAssignPanel({ crs, fsw, person, assignedPathway, assigning, onAssign }: {
  crs: CRSBreakdown; fsw: FSWBreakdown; person: PersonInput;
  assignedPathway: string | null; assigning: string | null;
  onAssign: (backendValue: string, displayName: string) => void;
}) {
  const recs = getPathwayRecs(crs, fsw, person);
  return (
    <div className="rounded-xl border bg-card overflow-hidden sticky top-4">
      <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b">
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-primary" />
          <p className="text-sm font-semibold">Assign Pathway to Client</p>
        </div>
        {assignedPathway && (
          <Badge variant="outline" className="border-green-400 text-green-700 text-xs gap-1">
            <CheckCircle2 className="h-3 w-3" />Assigned
          </Badge>
        )}
      </div>

      {assignedPathway && (
        <div className="px-4 py-2.5 bg-green-50 border-b border-green-100 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-green-800">Currently Assigned</p>
            <p className="text-xs text-green-700">{assignedPathway}</p>
          </div>
        </div>
      )}

      <div className="divide-y">
        {recs.map((r, idx) => {
          const isAssigned = assignedPathway === r.backendValue;
          const isBest     = idx === 0 && r.eligible;
          const isLoading  = assigning === r.backendValue;
          return (
            <div key={r.pathway} className={cn(
              "flex items-center gap-3 px-4 py-3 text-sm",
              isAssigned ? "bg-green-50" :
              isBest     ? "bg-blue-50/60" :
              r.eligible ? "bg-white"      : "bg-muted/20"
            )}>
              <div className="shrink-0">
                {isAssigned
                  ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                  : r.eligible
                    ? <CheckCircle2 className="h-4 w-4 text-blue-500" />
                    : <AlertCircle  className="h-4 w-4 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className={cn("text-xs font-semibold leading-tight",
                    isAssigned ? "text-green-800" :
                    r.eligible ? "text-foreground" : "text-muted-foreground"
                  )}>{r.pathway}</p>
                  {isBest && !isAssigned && (
                    <Badge className="bg-blue-600 text-white text-[9px] py-0 px-1 h-3.5">Best</Badge>
                  )}
                  {!r.eligible && (
                    <Badge variant="outline" className="text-[9px] py-0 px-1 h-3.5 text-muted-foreground">Not Eligible</Badge>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{r.notes}</p>
              </div>
              <div className="shrink-0">
                {isAssigned ? (
                  <span className="text-[10px] font-semibold text-green-700">✓</span>
                ) : (
                  <Button
                    size="sm"
                    variant={isBest ? "default" : "outline"}
                    className={cn("h-6 text-[10px] px-2", isBest ? "bg-blue-600 hover:bg-blue-700 text-white" : "")}
                    disabled={isLoading}
                    onClick={() => onAssign(r.backendValue, r.pathway)}
                  >
                    {isLoading ? "…" : isBest ? "Assign Best" : "Assign"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step Indicator Bar ───────────────────────────────────────────────────────

const STEPS = [
  { num: 1, title: "CRS Calculator",      subtitle: "Enter applicant profile",  icon: Calculator },
  { num: 2, title: "Pathway Results",     subtitle: "Review scores & assign",   icon: Award      },
  { num: 3, title: "IRCC Forms & Guides", subtitle: "Find required documents",  icon: FileText   },
] as const;

function StepBar({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="flex items-start">
      {STEPS.map((step, idx) => {
        const done   = step.num < current;
        const active = step.num === current;
        const Icon   = step.icon;
        return (
          <div key={step.num} className="flex items-start flex-1">
            <div className="flex flex-col items-center gap-2 flex-1">
              <div className={cn(
                "flex items-center justify-center h-10 w-10 rounded-full border-2 transition-all shrink-0",
                done   ? "bg-primary border-primary text-primary-foreground" :
                active ? "bg-primary/10 border-primary text-primary"        :
                         "bg-background border-border text-muted-foreground"
              )}>
                {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
              </div>
              <div className="text-center">
                <p className={cn("text-xs font-bold",
                  active ? "text-primary"    :
                  done   ? "text-foreground" : "text-muted-foreground"
                )}>{step.title}</p>
                <p className="text-[10px] text-muted-foreground hidden sm:block">{step.subtitle}</p>
              </div>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={cn(
                "h-0.5 flex-1 mt-5 mx-2",
                step.num < current ? "bg-primary" : "bg-border"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function PathwayCalculatorClient({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise);

  const [step,      setStep]      = useState<1 | 2 | 3>(1);
  const [main,      setMain]      = useState<PersonInput>(DEF_PERSON);
  const [spouse,    setSpouse]    = useState<SpouseInput>(DEF_SPOUSE);
  const [hasSpouse,         setHasSpouse]         = useState(false);
  const [compare,           setCompare]           = useState(false);
  const [showCompareModal,  setShowCompareModal]  = useState(false);

  const [assignedPathway, setAssignedPathway] = useState<string | null>(null);
  const [assignedPackageId, setAssignedPackageId] = useState<number | null>(null);
  const [assigning,       setAssigning]       = useState<string | null>(null);
  const [clientName,      setClientName]      = useState<string>("");

  function authHeaders(): Record<string, string> {
    const token =
      document.cookie.match(/wtc_consultant_token=([^;]+)/)?.[1] ??
      localStorage.getItem("wtc_consultant_token") ?? "";
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  }

  useEffect(() => {
    fetch(`http://127.0.0.1:8000/api/v1/consultant/clients/${id}/case-file`, {
      headers: authHeaders(),
    })
      .then(r => r.json())
      .then(data => {
        setAssignedPathway(data.case_file?.immigration_pathway ?? null);
        setAssignedPackageId(data.case_file?.assigned_ircc_category_id ?? null);
        const c = data.client;
        if (c) setClientName(`${c.first_name ?? ""} ${c.last_name ?? ""}`.trim());
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function assignPathway(backendValue: string, displayName: string) {
    setAssigning(backendValue);
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/v1/consultant/clients/${id}/case-file/select-pathway`,
        {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ immigration_pathway: backendValue }),
        }
      );
      if (res.ok) {
        setAssignedPathway(backendValue);
        // Auto-advance to IRCC forms after a brief moment
        setTimeout(() => setStep(3), 800);
      }
    } finally {
      setAssigning(null);
    }
  }

  const mainCRS = calcCRS(main, hasSpouse, hasSpouse ? spouse : undefined);
  const mainFSW = calcFSW(main);

  const spouseAsMain: PersonInput = {
    age: 28, education: spouse.education, canadianEducation: "none",
    ielts: spouse.ielts,
    frenchCLB: { speaking: 0, listening: 0, reading: 0, writing: 0 },
    canadianWorkExp: spouse.canadianWorkExp,
    foreignWorkExp: 0, jobOffer: "none",
    provincialNomination: false, siblingInCanada: false, certificateOfQualification: false,
  };
  const spouseCRS = calcCRS(spouseAsMain, false);
  const spouseFSW = calcFSW(spouseAsMain);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">

      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/dashboard/clients/${id}/workspace`}>
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
            <ArrowLeft className="h-4 w-4" />Back
          </Button>
        </Link>
        <div className="h-7 w-px bg-border" />
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Calculator className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-bold leading-none">Pathway Calculator</h1>
            {clientName && <p className="text-xs text-muted-foreground mt-0.5">{clientName}</p>}
          </div>
        </div>
        {assignedPathway && (
          <Badge variant="outline" className="ml-auto border-green-400 text-green-700 gap-1.5 hidden sm:flex">
            <CheckCircle2 className="h-3 w-3" />
            {assignedPathway}
          </Badge>
        )}
      </div>

      {/* ── Step Indicator + Navigation ───────────────────────────────────── */}
      <div className="rounded-xl border bg-card px-6 py-5 mb-6">
        <StepBar current={step} />

        <div className="mt-5 pt-4 border-t flex items-center justify-between gap-4">
          {/* Step 1 controls */}
          {step === 1 && (
            <>
              <div className="flex items-center gap-4 flex-wrap">
                <Toggle
                  label="Has accompanying spouse"
                  checked={hasSpouse}
                  onChange={v => {
                    setHasSpouse(v);
                    if (v) setShowCompareModal(true);
                  }}
                />
                {hasSpouse && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-7"
                    onClick={() => setShowCompareModal(true)}
                  >
                    <Users className="h-3.5 w-3.5" />
                    Compare Scores
                  </Button>
                )}
                {hasSpouse && <Toggle label="Show spouse column below" checked={compare} onChange={setCompare} />}
              </div>
              <Button onClick={() => setStep(2)} className="gap-2 shrink-0">
                View Full Results & Assign Pathway
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          {/* Step 2 controls */}
          {step === 2 && (
            <>
              <Button variant="outline" onClick={() => setStep(1)} className="gap-2">
                <ArrowLeft className="h-4 w-4" />Back to Calculator
              </Button>
              <Button onClick={() => setStep(3)} className="gap-2">
                Continue to IRCC Forms
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          {/* Step 3 controls */}
          {step === 3 && (
            <>
              <Button variant="outline" onClick={() => setStep(2)} className="gap-2">
                <ArrowLeft className="h-4 w-4" />Back to Pathway Results
              </Button>
              <Link href={`/dashboard/clients/${id}/workspace`}>
                <Button variant="outline" className="gap-2">
                  Done — Back to Workspace
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* ── Step 1: CRS Calculator ─────────────────────────────────────────── */}
      {step === 1 && (
        <div className={cn(
          "grid gap-6",
          compare && hasSpouse ? "grid-cols-1 xl:grid-cols-5" : "grid-cols-1 xl:grid-cols-5"
        )}>
          {/* Forms */}
          <div className={cn(compare && hasSpouse ? "xl:col-span-2" : "xl:col-span-3")}>
            <PersonForm data={main} onChange={setMain} label="Main Applicant" />
            {hasSpouse && (
              <div className="mt-4">
                <SpouseForm data={spouse} onChange={setSpouse} />
              </div>
            )}
          </div>

          {/* Live Preview — main */}
          <div className={cn(compare && hasSpouse ? "xl:col-span-1" : "xl:col-span-2")}>
            <LiveScorePreview
              crs={mainCRS} fsw={mainFSW} person={main}
              assignedPathway={assignedPathway}
            />
          </div>

          {/* Live Preview — spouse comparison */}
          {compare && hasSpouse && (
            <div className="xl:col-span-2">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3 text-center">
                Spouse as Main Applicant
              </p>
              <LiveScorePreview
                crs={spouseCRS} fsw={spouseFSW} person={spouseAsMain}
                assignedPathway={assignedPathway}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Pathway Results + Assignment ──────────────────────────── */}
      {step === 2 && (
        <div className={cn(
          "grid gap-6",
          compare && hasSpouse ? "grid-cols-1 xl:grid-cols-3" : "grid-cols-1 xl:grid-cols-5"
        )}>
          {/* Left: full score detail */}
          <div className={cn(compare && hasSpouse ? "xl:col-span-1" : "xl:col-span-3")}>
            <ScoreDetailPanel crs={mainCRS} fsw={mainFSW} />
          </div>

          {/* Right: pathway assignment */}
          <div className={cn(compare && hasSpouse ? "xl:col-span-1" : "xl:col-span-2")}>
            <PathwayAssignPanel
              crs={mainCRS} fsw={mainFSW} person={main}
              assignedPathway={assignedPathway}
              assigning={assigning}
              onAssign={assignPathway}
            />
          </div>

          {/* Comparison column */}
          {compare && hasSpouse && (
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3 text-center">
                If Spouse as Main
              </p>
              <PathwayAssignPanel
                crs={spouseCRS} fsw={spouseFSW} person={spouseAsMain}
                assignedPathway={assignedPathway}
                assigning={assigning}
                onAssign={assignPathway}
              />
            </div>
          )}

          {/* Disclaimer */}
          <div className={cn(
            "rounded-xl border bg-amber-50 border-amber-200 p-4",
            compare && hasSpouse ? "xl:col-span-3" : "xl:col-span-5"
          )}>
            <div className="flex gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-xs text-amber-800">
                <p className="font-semibold">Important Disclaimer</p>
                <p className="mt-0.5">
                  This calculator is for indicative purposes only. CRS cut-off scores change with every
                  Express Entry draw. Always verify using the official{" "}
                  <a
                    href="https://www.canada.ca/en/immigration-refugees-citizenship/services/come-canada-tool.html"
                    target="_blank" rel="noopener noreferrer" className="underline"
                  >
                    IRCC Come to Canada tool
                  </a>.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: IRCC Forms & Guides ───────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-4">
          {assignedPathway && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">Pathway Assigned</p>
                <p className="text-xs text-green-700">
                  {assignedPathway} — Now find the required IRCC forms &amp; guides below
                </p>
              </div>
            </div>
          )}
          <IrccFormExplorer
            clientProfileId={id}
            assignedCategoryId={assignedPackageId}
            onAssigned={setAssignedPackageId}
          />
        </div>
      )}

      {/* ── Spouse Compare Modal ─────────────────────────────────────────── */}
      <SpouseCompareModal
        open={showCompareModal && hasSpouse}
        onClose={() => setShowCompareModal(false)}
        mainCRS={mainCRS}     mainFSW={mainFSW}
        spouseCRS={spouseCRS} spouseFSW={spouseFSW}
      />

    </div>
  );
}
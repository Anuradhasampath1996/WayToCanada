/**
 * Indicative CRS / FSW scoring for consultant pre-assessment.
 * Always cross-check with IRCC's official tool before advising clients:
 * https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score.html
 *
 * CRS job-offer points removed effective 2025-03-25 (still relevant for FSW arranged employment).
 */

export type EducationLevel =
  | "none" | "secondary" | "one_year" | "two_year"
  | "bachelors" | "two_or_more" | "masters" | "doctoral";

export interface LangCLB { speaking: number; listening: number; reading: number; writing: number; }

export interface PersonInput {
  age: number;
  education: EducationLevel;
  canadianEducation: "none" | "one_two_year" | "three_plus";
  ielts: { speaking: number; listening: number; reading: number; writing: number };
  frenchCLB: LangCLB;
  canadianWorkExp: number;
  foreignWorkExp: number;
  jobOffer: "none" | "noc00" | "noc_a_b" | "noc_c_d";
  provincialNomination: boolean;
  siblingInCanada: boolean;
  certificateOfQualification: boolean;
}

export interface SpouseInput {
  age?: number;
  education: EducationLevel;
  ielts: { speaking: number; listening: number; reading: number; writing: number };
  canadianWorkExp: number;
}

export interface CRSBreakdown {
  humanCapital: number;
  skillTransfer: number;
  additional: number;
  total: number;
  agePts: number;
  eduPts: number;
  firstLangTotal: number;
  secondLangTotal: number;
  canWEPts: number;
  spousePts: number;
  firstCLB: LangCLB;
}

export interface FSWBreakdown {
  language: number; education: number; experience: number;
  age: number; arranged: number; adaptability: number;
  total: number; eligible: boolean;
}

export const OFFICIAL_CRS_TOOL_URL =
  "https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score.html";

export const RCIC_COMPETENCIES_URL =
  "https://college-ic.ca/licensee-obligations/standards-of-professional-conduct-and-competence/essential-competencies-for-rcic-practice";

/** Reference only — verify latest draws on IRCC open data / news releases. */
export const RECENT_DRAW_REFERENCE = {
  updated: "2026-06",
  notes: "Cut-offs vary by draw type (general, PNP, category-based). Use IRCC's official CRS tool before final advice.",
  examples: [
    { type: "General / all-program", range: "480 – 540+", note: "Varies each draw" },
    { type: "Category-based (e.g. healthcare, trades)", range: "350 – 480+", note: "Often lower than general" },
    { type: "Provincial Nominee (with 600 bonus)", range: "Any CRS + nomination", note: "Nomination adds 600 CRS pts" },
  ],
};

export function ieltsToCLB(s: number, l: number, r: number, w: number): LangCLB {
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

function firstLangPts(clb: number, hasSpouse: boolean): number {
  if (clb <= 4)  return 0;
  if (clb === 5) return 6;
  if (clb === 6) return hasSpouse ? 8  : 9;
  if (clb === 7) return hasSpouse ? 16 : 17;
  if (clb === 8) return hasSpouse ? 22 : 23;
  if (clb === 9) return hasSpouse ? 29 : 31;
  return hasSpouse ? 32 : 34;
}

function secondLangPts(clb: number, hasSpouse: boolean): number {
  if (clb <= 4)  return 0;
  if (clb <= 6)  return 1;
  if (clb <= 8)  return 3;
  return hasSpouse ? 4 : 6;
}

function crsCanWE(years: number, hasSpouse: boolean): number {
  if (years <= 0) return 0;
  const noSpouse  = [0, 40, 53, 64, 72, 80];
  const withSpouse = [0, 35, 46, 56, 63, 70];
  const idx = Math.min(Math.floor(years), 5);
  return hasSpouse ? withSpouse[idx] : noSpouse[idx];
}

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
  return t[Math.min(Math.floor(years), 5)];
}

function calcSkillTransfer(
  edu: EducationLevel, firstCLB: LangCLB, canWE: number, foreignWE: number,
  certOfQual: boolean
): number {
  const hasDegree = !["none", "secondary"].includes(edu);
  const firstMinCLB = Math.min(...Object.values(firstCLB));
  const clb7 = firstMinCLB >= 7;
  const clb9 = firstMinCLB >= 9;
  let pts = 0;

  if (hasDegree) {
    if (clb9) pts += 50; else if (clb7) pts += 25;
  }
  if (hasDegree && canWE >= 1) {
    pts += canWE >= 2 ? 50 : 25;
  }
  if (foreignWE >= 1) {
    const fwe3 = foreignWE >= 3;
    if (clb9) pts += fwe3 ? 50 : 25; else if (clb7) pts += fwe3 ? 25 : 13;
  }
  if (foreignWE >= 1 && canWE >= 1) {
    const fwe3 = foreignWE >= 3; const cwe2 = canWE >= 2;
    if (fwe3 && cwe2) pts += 50; else if (fwe3 || cwe2) pts += 25; else pts += 13;
  }
  if (certOfQual) {
    if (clb7) pts += 50; else if (firstMinCLB >= 5) pts += 25;
  }

  return Math.min(pts, 100);
}

/** CRS additional points — job offers excluded since 2025-03-25. */
function calcAdditional(
  siblingCA: boolean, frCLB: LangCLB, canadianEdu: PersonInput["canadianEducation"],
  pn: boolean, firstCLB: LangCLB
): number {
  let pts = 0;
  if (siblingCA) pts += 15;
  const frMin = Math.min(...Object.values(frCLB));
  const enMin = Math.min(...Object.values(firstCLB));
  if (frMin >= 7 && enMin < 5) pts += 50;
  else if (frMin >= 7) pts += 50;
  else if (frMin >= 5) pts += 25;
  if (canadianEdu === "three_plus") pts += 30;
  else if (canadianEdu === "one_two_year") pts += 15;
  if (pn) pts += 600;
  return pts;
}

export function calcCRS(
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
  const additional    = calcAdditional(p.siblingInCanada, frCLB, p.canadianEducation, p.provincialNomination, firstCLB);

  return {
    humanCapital, skillTransfer, additional,
    total: humanCapital + skillTransfer + additional,
    agePts, eduPts, firstLangTotal, secondLangTotal, canWEPts, spousePts, firstCLB,
  };
}

export function calcFSW(p: PersonInput): FSWBreakdown {
  const clb = ieltsToCLB(p.ielts.speaking, p.ielts.listening, p.ielts.reading, p.ielts.writing);
  const avgCLB = (clb.speaking + clb.listening + clb.reading + clb.writing) / 4;

  let language = 0;
  if (avgCLB >= 9) language = 24; else if (avgCLB >= 8) language = 20;
  else if (avgCLB >= 7) language = 16; else if (avgCLB >= 6) language = 8;
  else if (avgCLB >= 5) language = 4; else if (avgCLB >= 4) language = 2;
  const frMin = Math.min(...Object.values(p.frenchCLB));
  if (frMin >= 5) language = Math.min(28, language + 4);

  const eduMap: Record<EducationLevel, number> = {
    none: 0, secondary: 5, one_year: 15, two_year: 19,
    bachelors: 21, two_or_more: 22, masters: 23, doctoral: 25,
  };
  const education = eduMap[p.education];

  const expMap = [0, 9, 11, 13, 15, 15];
  const experience = expMap[Math.min(Math.floor(p.foreignWorkExp + p.canadianWorkExp), 5)];

  let age = 0;
  if (p.age >= 18 && p.age <= 35) age = 12;
  else if (p.age === 36) age = 11;
  else if (p.age === 37) age = 10;
  else if (p.age === 38) age = 9; else if (p.age === 39) age = 8;
  else if (p.age === 40) age = 7; else if (p.age === 41) age = 6;
  else if (p.age === 42) age = 5; else if (p.age === 43) age = 4;
  else if (p.age === 44) age = 3; else if (p.age === 45) age = 2;

  const arranged = p.jobOffer !== "none" ? 10 : 0;

  let adaptability = 0;
  if (p.canadianWorkExp >= 1) adaptability += 5;
  if (p.siblingInCanada) adaptability += 5;
  adaptability = Math.min(adaptability, 10);

  const total = language + education + experience + age + arranged + adaptability;
  return { language, education, experience, age, arranged, adaptability, total, eligible: total >= 67 };
}

export function getPathwayRecs(crs: CRSBreakdown, fsw: FSWBreakdown, p: PersonInput): {
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
        ? `FSW ${fsw.total}/100 ✓ | CRS ${crs.total} (verify on IRCC tool)`
        : `FSW ${fsw.total}/100 — needs 67+`,
      color: "green",
    },
    {
      pathway: "Express Entry – Canadian Experience Class",
      backendValue: "Express Entry – Canadian Experience Class",
      eligible: p.canadianWorkExp >= 1 && minCLB >= 7,
      notes: p.canadianWorkExp >= 1 ? `${p.canadianWorkExp} yr Canadian WE ✓ | min CLB ${minCLB}` : "Needs ≥1 yr skilled Canadian work",
      color: "green",
    },
    {
      pathway: "Express Entry – Federal Skilled Trades",
      backendValue: "Express Entry – Federal Skilled Trades",
      eligible: p.certificateOfQualification && minCLB >= 5,
      notes: p.certificateOfQualification ? "Trade certificate ✓ — confirm CLB 5/4 per skill" : "Needs certificate of qualification",
      color: "blue",
    },
    {
      pathway: "Provincial Nominee Program (General)",
      backendValue: "Provincial Nominee Program",
      eligible: crs.total >= 300,
      notes: crs.total >= 300 ? `CRS ${crs.total} — explore province-specific streams` : `CRS ${crs.total} — strengthen profile or consider study/work routes`,
      color: "orange",
    },
    {
      pathway: "Study Permit → PR",
      backendValue: "Study Permit",
      eligible: p.age <= 35,
      notes: p.age <= 35 ? "Age-friendly; PGWP → CEC route possible" : "Still possible via study + PGWP",
      color: "blue",
    },
    {
      pathway: "Work Permit → PR",
      backendValue: "Work Permit",
      eligible: p.foreignWorkExp >= 1 || p.jobOffer !== "none",
      notes: p.jobOffer !== "none" ? "Job offer may support work permit (no CRS bonus since Mar 2025)" : "LMIA / open work permit routes",
      color: "blue",
    },
    {
      pathway: "Family Sponsorship",
      backendValue: "Family Sponsorship",
      eligible: false,
      notes: "Requires eligible Canadian citizen / PR sponsor",
      color: "gray",
    },
  ];
}

// ─── Pathway improvement insights ────────────────────────────────────────────

export type PathwayStatus = "eligible" | "achievable" | "needs_work" | "not_applicable";

export interface PathwayImprovement {
  headline: string;
  actions: string[];
  projectedCrs?: number;
}

export interface PathwayInsight {
  pathway: string;
  backendValue: string;
  eligible: boolean;
  status: PathwayStatus;
  notes: string;
  color: string;
  improvement?: PathwayImprovement;
}

const MIN_IELTS_FOR_CLB: Record<number, PersonInput["ielts"]> = {
  5: { speaking: 5.0, listening: 5.0, reading: 4.0, writing: 5.0 },
  6: { speaking: 5.5, listening: 5.5, reading: 5.0, writing: 5.5 },
  7: { speaking: 6.0, listening: 6.0, reading: 6.0, writing: 6.0 },
  8: { speaking: 6.5, listening: 7.5, reading: 6.5, writing: 6.5 },
  9: { speaking: 7.0, listening: 8.0, reading: 7.0, writing: 7.0 },
};

function bumpIeltsToCLB(p: PersonInput, targetCLB: number): PersonInput {
  const min = MIN_IELTS_FOR_CLB[targetCLB] ?? MIN_IELTS_FOR_CLB[7];
  return {
    ...p,
    ielts: {
      speaking:  Math.max(p.ielts.speaking,  min.speaking),
      listening: Math.max(p.ielts.listening, min.listening),
      reading:   Math.max(p.ielts.reading,   min.reading),
      writing:   Math.max(p.ielts.writing,   min.writing),
    },
  };
}

const IMPROVEMENT_SCENARIOS: { label: string; apply: (p: PersonInput) => PersonInput }[] = [
  { label: "Improve English to CLB 7 in all bands", apply: p => bumpIeltsToCLB(p, 7) },
  { label: "Improve English to CLB 9 in all bands", apply: p => bumpIeltsToCLB(p, 9) },
  { label: "Gain 1 year of Canadian skilled work", apply: p => ({ ...p, canadianWorkExp: Math.max(1, p.canadianWorkExp) }) },
  { label: "Document 1+ year of foreign skilled work", apply: p => ({ ...p, foreignWorkExp: Math.max(1, p.foreignWorkExp) }) },
  { label: "Obtain a trade certificate of qualification", apply: p => ({ ...p, certificateOfQualification: true }) },
  { label: "Add French at CLB 7+ (CRS bonus points)", apply: p => ({ ...p, frenchCLB: { speaking: 7, listening: 7, reading: 7, writing: 7 } }) },
  { label: "Secure a skilled job offer (work permit route)", apply: p => ({ ...p, jobOffer: "noc_a_b" as const }) },
  { label: "Complete Canadian post-secondary study (1–2 yr)", apply: p => ({ ...p, canadianEducation: p.canadianEducation === "none" ? "one_two_year" : p.canadianEducation }) },
];

function isPathwayEligible(backendValue: string, crs: CRSBreakdown, fsw: FSWBreakdown, p: PersonInput): boolean {
  const minCLB = Math.min(crs.firstCLB.speaking, crs.firstCLB.listening, crs.firstCLB.reading, crs.firstCLB.writing);
  switch (backendValue) {
    case "Express Entry – Federal Skilled Worker":
      return fsw.eligible && minCLB >= 7 && p.foreignWorkExp >= 1;
    case "Express Entry – Canadian Experience Class":
      return p.canadianWorkExp >= 1 && minCLB >= 7;
    case "Express Entry – Federal Skilled Trades":
      return p.certificateOfQualification && minCLB >= 5;
    case "Provincial Nominee Program":
      return crs.total >= 300;
    case "Study Permit":
      return p.age <= 35;
    case "Work Permit":
      return p.foreignWorkExp >= 1 || p.jobOffer !== "none";
    default:
      return false;
  }
}

function findImprovementPlan(
  backendValue: string,
  person: PersonInput,
  hasSpouse: boolean,
  spouse?: SpouseInput
): PathwayImprovement | undefined {
  const baseCrs = calcCRS(person, hasSpouse, spouse);
  const baseFsw = calcFSW(person);
  if (isPathwayEligible(backendValue, baseCrs, baseFsw, person)) return undefined;
  if (backendValue === "Family Sponsorship") return undefined;

  type Candidate = { actions: string[]; projectedCrs: number; count: number };
  const candidates: Candidate[] = [];

  const consider = (actions: string[], modified: PersonInput) => {
    const crs = calcCRS(modified, hasSpouse, spouse);
    const fsw = calcFSW(modified);
    if (!isPathwayEligible(backendValue, crs, fsw, modified)) return;
    candidates.push({ actions, projectedCrs: crs.total, count: actions.length });
  };

  for (const scenario of IMPROVEMENT_SCENARIOS) {
    consider([scenario.label], scenario.apply(person));
  }

  for (let i = 0; i < IMPROVEMENT_SCENARIOS.length; i++) {
    for (let j = i + 1; j < IMPROVEMENT_SCENARIOS.length; j++) {
      const a = IMPROVEMENT_SCENARIOS[i];
      const b = IMPROVEMENT_SCENARIOS[j];
      consider([a.label, b.label], b.apply(a.apply(person)));
    }
  }

  candidates.sort((x, y) => x.count - y.count || y.projectedCrs - x.projectedCrs);
  const best = candidates[0];

  if (best) {
    return {
      headline: best.count === 1 ? "Could qualify with this improvement" : "Could qualify after these changes",
      actions: best.actions,
      projectedCrs: best.projectedCrs,
    };
  }

  // Pathway-specific guidance when no simulated scenario clears the bar
  const minCLB = Math.min(baseCrs.firstCLB.speaking, baseCrs.firstCLB.listening, baseCrs.firstCLB.reading, baseCrs.firstCLB.writing);
  const gap300 = Math.max(0, 300 - baseCrs.total);

  switch (backendValue) {
    case "Express Entry – Federal Skilled Worker": {
      const actions: string[] = [];
      if (person.foreignWorkExp < 1) actions.push("Need 1+ year of skilled foreign work experience");
      if (minCLB < 7) actions.push(`Raise English to CLB 7+ (now min CLB ${minCLB})`);
      if (!baseFsw.eligible) actions.push(`Raise FSW score by ${67 - baseFsw.total} pts (now ${baseFsw.total}/100)`);
      if (actions.length) return { headline: "Major profile gaps — long-term plan needed", actions };
      break;
    }
    case "Express Entry – Canadian Experience Class":
      return {
        headline: "Typically needs Canadian work + language",
        actions: [
          person.canadianWorkExp < 1 ? "Gain 1+ year skilled work in Canada" : "Maintain skilled Canadian employment",
          minCLB < 7 ? `Improve English to CLB 7+ (now min CLB ${minCLB})` : "Keep CLB 7+ in all bands",
        ],
      };
    case "Provincial Nominee Program":
      return {
        headline: gap300 > 0 ? `Raise CRS by ~${gap300}+ points for stronger PNP options` : "Explore province-specific streams and job market",
        actions: [
          "Improve IELTS toward CLB 9 in all bands",
          "Gain Canadian work experience or French CLB 7+",
          "Research PNP streams aligned with NOC / region",
        ],
        projectedCrs: baseCrs.total,
      };
    case "Study Permit":
      return person.age > 35
        ? { headline: "Less common after 35 — still possible via study + PGWP", actions: ["Consider shorter programs or spouse open work permit routes"] }
        : undefined;
    default:
      break;
  }

  return undefined;
}

export function getPathwayInsights(
  crs: CRSBreakdown,
  fsw: FSWBreakdown,
  person: PersonInput,
  hasSpouse = false,
  spouse?: SpouseInput
): PathwayInsight[] {
  return getPathwayRecs(crs, fsw, person).map(rec => {
    if (rec.eligible) {
      return { ...rec, status: "eligible" as const };
    }
    if (rec.backendValue === "Family Sponsorship") {
      return { ...rec, status: "not_applicable" as const };
    }
    const improvement = findImprovementPlan(rec.backendValue, person, hasSpouse, spouse);
    if (improvement) {
      return {
        ...rec,
        status: "achievable" as const,
        improvement,
        notes: improvement.actions.slice(0, 2).join(" · "),
      };
    }
    return { ...rec, status: "needs_work" as const };
  });
}

export const EDU_LABELS: Record<EducationLevel, string> = {
  none:        "Less than secondary",
  secondary:   "Secondary school diploma",
  one_year:    "1-year post-secondary",
  two_year:    "2-year post-secondary",
  bachelors:   "Bachelor's degree (3+ yr)",
  two_or_more: "Two+ degrees (one 3+ yr)",
  masters:     "Master's / Professional",
  doctoral:    "Doctoral (PhD)",
};

export const DEF_PERSON: PersonInput = {
  age: 28, education: "bachelors", canadianEducation: "none",
  ielts: { speaking: 6.5, listening: 7.5, reading: 6.5, writing: 6.5 },
  frenchCLB: { speaking: 0, listening: 0, reading: 0, writing: 0 },
  canadianWorkExp: 0, foreignWorkExp: 3,
  jobOffer: "none", provincialNomination: false,
  siblingInCanada: false, certificateOfQualification: false,
};

export const DEF_SPOUSE: SpouseInput = {
  education: "bachelors",
  ielts: { speaking: 6.0, listening: 6.0, reading: 6.0, writing: 6.0 },
  canadianWorkExp: 0,
};

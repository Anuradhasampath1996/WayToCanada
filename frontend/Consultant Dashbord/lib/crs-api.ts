import type { PersonInput, SpouseInput } from "./crs-calculator";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

export type CrsRulesMeta = {
  version: string;
  effective_date: string;
  source_url: string;
  official_tool: string;
  changelog?: string;
  policies?: Record<string, unknown>;
  last_synced_at?: string | null;
};

export type CrsDraw = {
  id: number;
  draw_number: number;
  draw_date: string;
  draw_name: string | null;
  minimum_crs_score: number | null;
  invitations_issued: number | null;
  round_type: string | null;
};

export type CrsApiResult = {
  rules_version: string;
  crs: {
    human_capital: number;
    skill_transfer: number;
    additional: number;
    total: number;
    age_pts: number;
    edu_pts: number;
    first_lang_total: number;
    second_lang_total: number;
    can_we_pts: number;
    spouse_pts: number;
    first_clb: { speaking: number; listening: number; reading: number; writing: number };
  };
  fsw: {
    language: number; education: number; experience: number;
    age: number; arranged: number; adaptability: number;
    total: number; eligible: boolean;
  };
  pathways: {
    pathway: string;
    backend_value: string;
    eligible: boolean;
    notes: string;
  }[];
};

export type ExtendedPersonInput = PersonInput & {
  englishTestType?: "ielts" | "celpip";
  frenchTestType?: "none" | "tef" | "tcf";
  frenchScores?: { speaking: number; listening: number; reading: number; writing: number };
  nocCode?: string;
  nocTeer?: number | "";
  nocTitle?: string;
  tradeCertificate?: boolean;
  provincialNominationInterest?: boolean;
};

export function spouseToExtendedPerson(
  spouse: SpouseInput & { age?: number; englishTestType?: "ielts" | "celpip" },
): ExtendedPersonInput {
  return {
    age: spouse.age ?? 28,
    education: spouse.education,
    canadianEducation: "none",
    ielts: spouse.ielts,
    englishTestType: spouse.englishTestType ?? "ielts",
    frenchTestType: "none",
    frenchScores: { speaking: 0, listening: 0, reading: 0, writing: 0 },
    frenchCLB: { speaking: 0, listening: 0, reading: 0, writing: 0 },
    canadianWorkExp: spouse.canadianWorkExp,
    foreignWorkExp: 0,
    jobOffer: "none",
    provincialNomination: false,
    siblingInCanada: false,
    certificateOfQualification: false,
    nocCode: "",
    nocTeer: "",
    nocTitle: "",
  };
}

export function personToSpouseFields(
  person: ExtendedPersonInput,
): SpouseInput & { age?: number; englishTestType?: "ielts" | "celpip" } {
  return {
    age: person.age,
    education: person.education,
    ielts: person.ielts,
    canadianWorkExp: person.canadianWorkExp,
    englishTestType: person.englishTestType,
  };
}

function mapMainToApi(main: ExtendedPersonInput): Record<string, unknown> {
  return {
    age: main.age,
    education: main.education,
    canadian_education: main.canadianEducation,
    english_test_type: main.englishTestType ?? "ielts",
    english_scores: main.ielts,
    french_test_type: main.frenchTestType ?? (Math.max(...Object.values(main.frenchCLB)) > 0 ? "tef" : "none"),
    french_clb: main.frenchCLB,
    french_scores: main.frenchScores,
    canadian_work_years: main.canadianWorkExp,
    foreign_work_years: main.foreignWorkExp,
    job_offer: main.jobOffer,
    provincial_nomination: main.provincialNomination,
    sibling_in_canada: main.siblingInCanada,
    trade_certificate: main.tradeCertificate ?? main.certificateOfQualification,
  };
}

function mapSpouseToApi(
  spouse: SpouseInput & { englishTestType?: "ielts" | "celpip" },
): Record<string, unknown> {
  return {
    education: spouse.education,
    english_test_type: spouse.englishTestType ?? "ielts",
    english_scores: spouse.ielts,
    canadian_work_years: spouse.canadianWorkExp,
  };
}

export function toApiPayload(
  main: ExtendedPersonInput,
  spouse: SpouseInput & { age?: number; englishTestType?: "ielts" | "celpip" },
  hasSpouse: boolean,
  principalApplicant: "main" | "spouse" = "main",
): Record<string, unknown> {
  const spouseAsPrincipal = hasSpouse && principalApplicant === "spouse";
  const principalPerson = spouseAsPrincipal ? spouseToExtendedPerson(spouse) : main;
  const accompanyingSpouse = spouseAsPrincipal ? personToSpouseFields(main) : spouse;

  return {
    has_spouse: hasSpouse,
    principal_applicant: hasSpouse ? principalApplicant : "main",
    main: mapMainToApi(principalPerson),
    spouse: hasSpouse ? mapSpouseToApi(accompanyingSpouse) : undefined,
    noc: {
      code: principalPerson.nocCode ?? main.nocCode ?? "",
      teer: principalPerson.nocTeer === "" ? null : principalPerson.nocTeer ?? main.nocTeer,
      title: principalPerson.nocTitle ?? main.nocTitle ?? "",
    },
  };
}

/** Map API CRS result to legacy CRSBreakdown shape used by UI components. */
export function apiToBreakdown(r: CrsApiResult["crs"]) {
  return {
    humanCapital: r.human_capital,
    skillTransfer: r.skill_transfer,
    additional: r.additional,
    total: r.total,
    agePts: r.age_pts,
    eduPts: r.edu_pts,
    firstLangTotal: r.first_lang_total,
    secondLangTotal: r.second_lang_total,
    canWEPts: r.can_we_pts,
    spousePts: r.spouse_pts,
    firstCLB: r.first_clb,
  };
}

export async function fetchCrsRules(): Promise<{ meta: CrsRulesMeta; rules: Record<string, unknown> }> {
  const res = await fetch(`${API}/crs/rules`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Failed to load CRS rules");
  return res.json();
}

export async function calculateCrs(payload: Record<string, unknown>): Promise<CrsApiResult> {
  const res = await fetch(`${API}/crs/calculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("CRS calculation failed");
  return res.json();
}

export async function fetchCrsDraws(limit = 8): Promise<CrsDraw[]> {
  const res = await fetch(`${API}/crs/draws?limit=${limit}`, { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const json = await res.json();
  return json.data ?? [];
}

export async function savePathwayAssessment(
  profileId: string,
  token: string,
  data: {
    notes?: string;
    crs_score?: number;
    ircc_crs_score?: number;
    rules_version?: string;
    assessment_snapshot?: Record<string, unknown>;
  },
): Promise<void> {
  const res = await fetch(`${API}/consultant/clients/${profileId}/case-file/pathway-assessment`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      notes: data.notes,
      crs_score: data.crs_score,
      ircc_crs_score: data.ircc_crs_score,
      rules_version: data.rules_version,
      assessment_snapshot: data.assessment_snapshot,
    }),
  });
  if (!res.ok) throw new Error("Failed to save assessment");
}

/** Map API FSW result to legacy FSWBreakdown shape. */
export function apiToFsw(r: CrsApiResult["fsw"]): import("./crs-calculator").FSWBreakdown {
  return {
    language: r.language,
    education: r.education,
    experience: r.experience,
    age: r.age,
    arranged: r.arranged,
    adaptability: r.adaptability,
    total: r.total,
    eligible: r.eligible,
  };
}

export function apiToPathwayRecs(pathways: CrsApiResult["pathways"]) {
  return pathways.map(p => ({
    pathway: p.pathway,
    backendValue: p.backend_value,
    eligible: p.eligible,
    notes: p.notes,
    color: p.eligible ? "green" : "gray",
  }));
}

export async function triggerCrsSync(token: string): Promise<CrsRulesMeta> {
  const res = await fetch(`${API}/crs/sync`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error("CRS sync failed");
  const json = await res.json();
  return json.meta;
}

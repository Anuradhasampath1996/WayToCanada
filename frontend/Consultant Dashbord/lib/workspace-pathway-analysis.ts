import type { PathwayInsight } from "./crs-calculator";
import type { CrsDraw } from "./crs-api";

export interface QuestionnaireGap {
  id: string;
  label: string;
  severity: "error" | "warn";
}

/** Rough IRCC settlement funds minimums (CAD) — verify current IRCC table before client advice. */
const SETTLEMENT_MIN_CAD: Record<number, number> = {
  1: 14500,
  2: 18000,
  3: 22200,
  4: 26900,
  5: 30500,
  6: 34400,
  7: 38200,
};

export function pathwayShortName(pathway: string): string {
  if (pathway.includes("Federal Skilled Worker")) return "FSW";
  if (pathway.includes("Canadian Experience")) return "CEC";
  if (pathway.includes("Skilled Trades")) return "FST";
  if (pathway.includes("Provincial Nominee")) return "PNP";
  if (pathway.includes("Study Permit")) return "Study → PR";
  if (pathway.includes("Work Permit")) return "Work → PR";
  if (pathway.includes("Family")) return "Family";
  return pathway;
}

export function getQuestionnaireGaps(
  step1: Record<string, unknown>,
  main: Record<string, unknown>,
  spouse: Record<string, unknown>,
): { gaps: QuestionnaireGap[]; complete: number; total: number } {
  const married = String(step1.married ?? "").toLowerCase() === "yes";

  type Check = { ok: boolean; id: string; label: string; severity: QuestionnaireGap["severity"] };
  const checks: Check[] = [
    { ok: !!main.dob, id: "dob", label: "Main applicant — date of birth", severity: "error" },
    { ok: (main.educationLevels as unknown[])?.length > 0, id: "edu", label: "Main applicant — education level", severity: "error" },
    {
      ok: String(main.languageTest ?? "") === "yes" && Object.values((main.scores as object) ?? {}).some(Boolean),
      id: "english",
      label: "Main applicant — English test scores",
      severity: "error",
    },
    { ok: !!main.workExperience, id: "fwe", label: "Main applicant — foreign work experience", severity: "error" },
    { ok: !!main.intendedNocCode, id: "noc", label: "Main applicant — target NOC code", severity: "warn" },
    {
      ok: main.canadianWork === "yes" || main.canadianWork === "no",
      id: "cwe",
      label: "Main applicant — Canadian work (yes/no)",
      severity: "warn",
    },
  ];

  if (married) {
    checks.push(
      { ok: !!spouse.dob, id: "sp-dob", label: "Spouse — date of birth", severity: "error" },
      {
        ok: (spouse.educationLevels as unknown[])?.length > 0,
        id: "sp-edu",
        label: "Spouse — education level",
        severity: "warn",
      },
      {
        ok: String(spouse.languageTest ?? "") === "yes" && Object.values((spouse.scores as object) ?? {}).some(Boolean),
        id: "sp-english",
        label: "Spouse — English test scores",
        severity: "warn",
      },
    );
  }

  const gaps = checks.filter(c => !c.ok).map(({ id, label, severity }) => ({ id, label, severity }));
  const total = checks.length;
  const complete = checks.filter(c => c.ok).length;
  return { gaps, complete, total };
}

export function getInadmissibilityFlags(step3: Record<string, unknown>): { level: "warn" | "info"; text: string }[] {
  const flags: { level: "warn" | "info"; text: string }[] = [];
  if (String(step3.hasCriminalRecord ?? "") === "yes") {
    flags.push({ level: "warn", text: "Criminal record disclosed — review admissibility before recommending a pathway." });
  }
  if (String(step3.hasVisaRefusal ?? "") === "yes") {
    flags.push({ level: "warn", text: "Previous visa refusal — document details and restoration strategy may be required." });
  }
  if (String(step3.hasMedicalCondition ?? "") === "yes") {
    flags.push({ level: "warn", text: "Medical condition disclosed — may require medical exam / MMI review." });
  }
  if (String(step3.hasJobOffer ?? "").startsWith("yes") && String(step3.hasJobOffer) !== "no") {
    flags.push({ level: "info", text: "Job offer / LMIA indicated in assessment — confirm NOC and employer validity." });
  }
  return flags;
}

export function checkSettlementFunds(
  step1: Record<string, unknown>,
  main: Record<string, unknown>,
): { ok: boolean; message: string } | null {
  const funds = parseFloat(String(main.settlementFunds ?? "").replace(/,/g, ""));
  if (!Number.isFinite(funds) || funds <= 0) return null;

  const children = String(step1.dependentChildren ?? "0");
  const childN = children === "4+" ? 4 : parseInt(children, 10) || 0;
  const familySize = 1 + (String(step1.married ?? "") === "yes" ? 1 : 0) + childN;
  const min = SETTLEMENT_MIN_CAD[Math.min(familySize, 7)] ?? SETTLEMENT_MIN_CAD[7];

  if (funds < min) {
    return {
      ok: false,
      message: `Settlement funds ~CAD ${funds.toLocaleString()} may be below rough minimum ~CAD ${min.toLocaleString()} for family size ${familySize}. Verify IRCC proof-of-funds table.`,
    };
  }
  return { ok: true, message: `Settlement funds appear adequate vs rough minimum (~CAD ${min.toLocaleString()}).` };
}

export function getCategoryDrawHint(nocCode: string, draws: CrsDraw[]): string | null {
  if (!nocCode || draws.length === 0) return null;
  const categoryDraws = draws.filter(d =>
    d.round_type && /category|health|stem|trade|french|agriculture|transport/i.test(d.round_type),
  );
  if (categoryDraws.length === 0) return null;
  const latest = categoryDraws[0];
  return `Recent category-based draw (#${latest.draw_number}): CRS ${latest.minimum_crs_score ?? "—"} (${latest.round_type}). Client NOC ${nocCode} — verify category eligibility on IRCC.`;
}

export function buildImprovementRoadmap(achievable: PathwayInsight[]): string[] {
  return achievable.slice(0, 3).flatMap(p =>
    (p.improvement?.actions ?? []).slice(0, 2).map(a => `${pathwayShortName(p.pathway)}: ${a}`),
  );
}

export function buildRecommendationLetter(params: {
  clientName: string;
  consultantName: string;
  crsTotal: number;
  irccCrs?: number | null;
  latestDrawCutoff?: number | null;
  assignedPathway: string | null;
  readyPathways: PathwayInsight[];
  achievablePathways: PathwayInsight[];
  rationale: string;
  clientGoals: string;
}): string {
  const {
    clientName, consultantName, crsTotal, irccCrs, latestDrawCutoff,
    assignedPathway, readyPathways, achievablePathways, rationale, clientGoals,
  } = params;

  const lines: string[] = [
    `Pathway Assessment Summary`,
    `Client: ${clientName}`,
    `Prepared by: ${consultantName}`,
    ``,
    `Estimated CRS score: ${crsTotal}${irccCrs != null ? ` (IRCC official tool: ${irccCrs})` : ""}`,
  ];

  if (latestDrawCutoff != null) {
    const diff = crsTotal - latestDrawCutoff;
    lines.push(`Latest Express Entry draw cut-off: ${latestDrawCutoff} (${diff >= 0 ? `${diff} points above` : `${Math.abs(diff)} points below`})`);
  }

  lines.push(``);

  if (assignedPathway) {
    lines.push(`Recommended pathway: ${assignedPathway}`);
  } else if (readyPathways[0]) {
    lines.push(`Recommended pathway: ${readyPathways[0].pathway}`);
  }

  if (readyPathways.length > 0) {
    lines.push(``, `Pathways eligible now:`, ...readyPathways.map(p => `  • ${p.pathway}`));
  }

  if (achievablePathways.length > 0) {
    lines.push(``, `Pathways possible after profile improvements:`);
    for (const p of achievablePathways.slice(0, 3)) {
      lines.push(`  • ${p.pathway}`);
      for (const a of p.improvement?.actions ?? []) lines.push(`      – ${a}`);
    }
  }

  if (clientGoals.trim()) {
    lines.push(``, `Client goals: ${clientGoals.trim()}`);
  }

  if (rationale.trim()) {
    lines.push(``, `Consultant rationale:`, rationale.trim());
  }

  lines.push(
    ``,
    `This summary is for preliminary guidance only. Final eligibility must be confirmed using IRCC's official tools and current program requirements.`,
  );

  return lines.join("\n");
}
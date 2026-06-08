import type { PersonInput, SpouseInput } from "./crs-calculator";
import type { ExtendedPersonInput } from "./crs-api";

type ScoreSet = { listening?: string | number; reading?: string | number; writing?: string | number; speaking?: string | number };

interface QuestionnairePayload {
  step1_data?: Record<string, unknown> | null;
  main_data?: Record<string, unknown> | null;
  spouse_data?: Record<string, unknown> | null;
  step3_data?: Record<string, unknown> | null;
}

function parseNum(v: unknown): number {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function scoresToIelts(scores: unknown): ExtendedPersonInput["ielts"] {
  const s = (scores ?? {}) as ScoreSet;
  return {
    speaking: parseNum(s.speaking),
    listening: parseNum(s.listening),
    reading: parseNum(s.reading),
    writing: parseNum(s.writing),
  };
}

function hasAnyScore(scores: ExtendedPersonInput["ielts"]): boolean {
  return !!(scores.speaking || scores.listening || scores.reading || scores.writing);
}

function ageFromDob(dob: unknown): number | null {
  if (!dob) return null;
  const d = new Date(String(dob));
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
  return age >= 16 && age <= 60 ? age : null;
}

function mapEducation(levels: unknown): ExtendedPersonInput["education"] {
  const arr = Array.isArray(levels) ? levels.map(String) : [];
  if (arr.includes("phd")) return "doctoral";
  if (arr.includes("masters")) return "masters";
  if (arr.includes("bachelors")) return "bachelors";
  if (arr.includes("diploma")) return "two_year";
  if (arr.includes("al")) return "secondary";
  if (arr.length >= 2) return "two_or_more";
  if (arr.length === 1) return "bachelors";
  return "secondary";
}

function mapForeignWE(value: unknown): number {
  switch (String(value ?? "")) {
    case "3_or_more": return 3;
    case "1_to_2": return 2;
    default: return 0;
  }
}

function mapStep3TotalExp(value: unknown): number {
  switch (String(value ?? "")) {
    case "10_plus":
    case "6_9":
    case "3_5":
      return 3;
    case "1_2":
      return 2;
    default:
      return 0;
  }
}

function mapSpouseExpYears(value: unknown): number {
  switch (String(value ?? "")) {
    case "6_plus":
    case "3_5":
      return 3;
    case "1_2":
      return 2;
    default:
      return 0;
  }
}

function mapCanadianWE(yesNo: unknown, start?: unknown, end?: unknown): number {
  if (String(yesNo ?? "").toLowerCase() !== "yes") return 0;
  const startDate = start ? new Date(String(start)) : null;
  const endDate = end ? new Date(String(end)) : new Date();
  if (startDate && !Number.isNaN(startDate.getTime())) {
    const years = (endDate.getTime() - startDate.getTime()) / (365.25 * 24 * 3600 * 1000);
    return Math.max(1, Math.min(5, Math.round(years)));
  }
  return 1;
}

function mapCanadianStudy(studied: unknown, start?: unknown, end?: unknown): ExtendedPersonInput["canadianEducation"] {
  if (String(studied ?? "").toLowerCase() !== "yes") return "none";
  const startDate = start ? new Date(String(start)) : null;
  const endDate = end ? new Date(String(end)) : null;
  if (startDate && endDate && !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
    const years = (endDate.getTime() - startDate.getTime()) / (365.25 * 24 * 3600 * 1000);
    return years >= 3 ? "three_plus" : "one_two_year";
  }
  return "one_two_year";
}

function applyMainEnglish(
  mainPartial: Partial<ExtendedPersonInput>,
  filled: string[],
  testTypeRaw: unknown,
  scoresRaw: unknown,
  labelPrefix = "",
) {
  const testType = String(testTypeRaw ?? "ielts").toLowerCase();
  mainPartial.englishTestType = testType === "celpip" ? "celpip" : "ielts";
  const ielts = scoresToIelts(scoresRaw);
  if (hasAnyScore(ielts)) {
    mainPartial.ielts = ielts;
    filled.push(`${labelPrefix}${mainPartial.englishTestType.toUpperCase()} scores`.trim());
  }
}

function applyFrench(
  target: Partial<ExtendedPersonInput>,
  filled: string[],
  taken: unknown,
  typeRaw: unknown,
  scoresRaw: unknown,
  labelPrefix = "",
) {
  if (String(taken ?? "").toLowerCase() !== "yes") return;
  const ft = String(typeRaw ?? "tef").toLowerCase();
  target.frenchTestType = ft === "tcf" ? "tcf" : "tef";
  target.frenchScores = {
    speaking: parseNum((scoresRaw as ScoreSet)?.speaking),
    listening: parseNum((scoresRaw as ScoreSet)?.listening),
    reading: parseNum((scoresRaw as ScoreSet)?.reading),
    writing: parseNum((scoresRaw as ScoreSet)?.writing),
  };
  filled.push(`${labelPrefix}French test`.trim());
}

export function mapQuestionnaireToCalculator(data: QuestionnairePayload): {
  main: Partial<ExtendedPersonInput>;
  spouse: Partial<SpouseInput & { englishTestType?: "ielts" | "celpip" }>;
  hasSpouse: boolean;
  filledFields: string[];
} {
  const step1 = data.step1_data ?? {};
  const main = data.main_data ?? {};
  const spouse = data.spouse_data ?? {};
  const step3 = data.step3_data ?? {};
  const filled: string[] = [];

  const mainPartial: Partial<ExtendedPersonInput> = {};
  const spousePartial: Partial<SpouseInput & { englishTestType?: "ielts" | "celpip" }> = {};

  const age = ageFromDob(main.dob ?? main.passportDob);
  if (age !== null) { mainPartial.age = age; filled.push("Age"); }

  if (main.educationLevels) {
    mainPartial.education = mapEducation(main.educationLevels);
    filled.push("Education");
  } else if ((step3.eduLevels as unknown[])?.length) {
    mainPartial.education = mapEducation(step3.eduLevels);
    filled.push("Education (assessment step)");
  }

  mainPartial.canadianEducation = mapCanadianStudy(main.studiedInCanada, main.canadaStudyStart, main.canadaStudyEnd);
  if (mainPartial.canadianEducation !== "none") filled.push("Canadian study");

  if (String(main.languageTest ?? "").toLowerCase() === "yes" || main.scores) {
    applyMainEnglish(mainPartial, filled, main.languageTestType, main.scores);
  } else if (String(step3.intlTestTaken ?? "").toLowerCase() === "yes") {
    applyMainEnglish(mainPartial, filled, step3.intlTestType, step3.intlTestScores, "Assessment ");
  }

  applyFrench(mainPartial, filled, main.frenchTestTaken, main.frenchTestType, main.frenchScores);

  mainPartial.foreignWorkExp = mapForeignWE(main.workExperience);
  if (mainPartial.foreignWorkExp === 0) {
    mainPartial.foreignWorkExp = mapStep3TotalExp(step3.totalExpYears);
    if (mainPartial.foreignWorkExp > 0) filled.push("Foreign work (assessment step)");
  } else {
    filled.push("Foreign work");
  }

  mainPartial.canadianWorkExp = mapCanadianWE(main.canadianWork, main.canadianWorkStart, main.canadianWorkEnd);
  if (mainPartial.canadianWorkExp > 0) filled.push("Canadian work");

  if (String(main.canadianRelatives ?? "").toLowerCase() === "yes") {
    mainPartial.siblingInCanada = true;
    filled.push("Sibling in Canada");
  }

  if (String(main.jobOffer ?? "").toLowerCase() === "yes") {
    mainPartial.jobOffer = "noc_a_b";
    filled.push("Job offer");
  } else {
    const step3Offer = String(step3.hasJobOffer ?? "");
    if (step3Offer.startsWith("yes")) {
      mainPartial.jobOffer = "noc_a_b";
      filled.push("Job offer (assessment step)");
    }
  }

  if (main.intendedNocCode) {
    mainPartial.nocCode = String(main.intendedNocCode);
    filled.push("NOC code");
  }
  if (main.intendedNocTeer !== undefined && main.intendedNocTeer !== "") {
    mainPartial.nocTeer = parseInt(String(main.intendedNocTeer), 10);
    filled.push("NOC TEER");
  }
  if (main.intendedNocTitle) {
    mainPartial.nocTitle = String(main.intendedNocTitle);
  }

  if (String(main.tradeCertificate ?? "").toLowerCase() === "yes") {
    mainPartial.tradeCertificate = true;
    mainPartial.certificateOfQualification = true;
    filled.push("Trade certificate");
  }

  if (String(main.provincialNomination ?? "").toLowerCase() === "yes") {
    mainPartial.provincialNomination = true;
    filled.push("Provincial nomination (+600 CRS)");
  }

  if (String(main.provincialNominationInterest ?? "").toLowerCase() === "yes") {
    mainPartial.provincialNominationInterest = true;
    filled.push("PNP interest");
  }

  const hasSpouse = String(step1.married ?? "").toLowerCase() === "yes";
  if (hasSpouse && spouse && Object.keys(spouse).length > 0) {
    if (spouse.educationLevels && (spouse.educationLevels as unknown[]).length > 0) {
      spousePartial.education = mapEducation(spouse.educationLevels);
      filled.push("Spouse education");
    } else if (step3.spouseEduLevel) {
      spousePartial.education = mapEducation([step3.spouseEduLevel]);
      filled.push("Spouse education (assessment step)");
    }

    const spTestType = String(spouse.languageTestType ?? "ielts").toLowerCase();
    spousePartial.englishTestType = spTestType === "celpip" ? "celpip" : "ielts";
    const spIelts = scoresToIelts(spouse.scores);
    if (hasAnyScore(spIelts)) {
      spousePartial.ielts = spIelts;
      filled.push(`Spouse ${spousePartial.englishTestType.toUpperCase()}`);
    }

    spousePartial.canadianWorkExp = mapCanadianWE(spouse.canadianWork, spouse.canadianWorkStart, spouse.canadianWorkEnd);
    if (spousePartial.canadianWorkExp > 0) filled.push("Spouse Canadian work");

    if (mapSpouseExpYears(step3.spouseExpYears) > 0 && !spousePartial.canadianWorkExp) {
      // Informational for spouse-as-main scenarios; stored in notes context only via filled field
      filled.push("Spouse foreign work (assessment step)");
    }
  }

  return { main: mainPartial, spouse: spousePartial, hasSpouse, filledFields: filled };
}

export function mergePersonInput(base: ExtendedPersonInput, partial: Partial<ExtendedPersonInput>): ExtendedPersonInput {
  return {
    ...base,
    ...partial,
    ielts: partial.ielts ? { ...base.ielts, ...partial.ielts } : base.ielts,
    frenchCLB: partial.frenchCLB ? { ...base.frenchCLB, ...partial.frenchCLB } : base.frenchCLB,
    frenchScores: partial.frenchScores ? { ...base.frenchScores, ...partial.frenchScores } : base.frenchScores,
  };
}

export function mergeSpouseInput(
  base: SpouseInput,
  partial: Partial<SpouseInput & { englishTestType?: "ielts" | "celpip" }>,
): SpouseInput & { englishTestType?: "ielts" | "celpip" } {
  return {
    ...base,
    ...partial,
    ielts: partial.ielts ? { ...base.ielts, ...partial.ielts } : base.ielts,
  };
}

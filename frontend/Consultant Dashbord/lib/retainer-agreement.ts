export type AgreementCurrency = "CAD" | "USD";
export type AgreementSectionKey =
  | "parties"
  | "scope"
  | "fees"
  | "governmentFees"
  | "clientObligations"
  | "consultantObligations"
  | "outcome"
  | "termination"
  | "privacy"
  | "refund"
  | "regulatory"
  | "general"
  | "custom";

export interface AgreementConfig {
  totalFee: number;
  currency: AgreementCurrency;
  milestone1Pct: number;
  milestone1Label: string;
  milestone2Pct: number;
  milestone2Label: string;
  milestone3Pct: number;
  milestone3Label: string;
  docDeadlineDays: number;
  refundPolicy: string;
  customClauses: string;
  consultantLicenseNo: string;
  clientName: string;
  clientEmail: string;
  consultantName: string;
  pathway: string;
  scopeDescription: string;
  taxEnabled: boolean;
  taxProvince: string;
  taxLabel: string;
  taxRate: number;
  clientDetails?: ClientAgreementDetails;
  sectionEdits?: Partial<Record<AgreementSectionKey, string>>;
}

export const DEFAULT_AGREEMENT_CONFIG: AgreementConfig = {
  totalFee: 3000,
  currency: "CAD",
  milestone1Pct: 30,
  milestone1Label: "Upon signing this agreement (Retainer Fee)",
  milestone2Pct: 40,
  milestone2Label: "Upon receiving an ITA, provincial nomination, or equivalent approval",
  milestone3Pct: 30,
  milestone3Label: "Before final application submission to IRCC",
  docDeadlineDays: 14,
  refundPolicy:
    "The retainer fee (Milestone 1) is non-refundable once work has commenced. " +
    "Milestones 2 and 3 are not payable if the corresponding government action does not occur. " +
    "No refund will be issued if the application is refused due to fraudulent documents provided by the client.",
  customClauses: "",
  consultantLicenseNo: "",
  clientName: "",
  clientEmail: "",
  consultantName: "",
  pathway: "",
  scopeDescription: "",
  taxEnabled: false,
  taxProvince: "",
  taxLabel: "GST/HST",
  taxRate: 0,
  sectionEdits: {},
};

export const PATHWAY_TEMPLATES: Record<string, { fee: number; description: string }> = {
  "Express Entry – Federal Skilled Worker": {
    fee: 3500,
    description:
      "Express Entry profile creation, FSW eligibility assessment, CRS optimization, monitoring draws, and full PR application submission.",
  },
  "Express Entry – Canadian Experience Class": {
    fee: 3000,
    description:
      "CEC eligibility assessment, Express Entry profile, CRS optimization, and full PR application submission.",
  },
  "Express Entry – Federal Skilled Trades": {
    fee: 3200,
    description:
      "FST eligibility assessment, trade certification verification, Express Entry profile, and PR application.",
  },
  "Provincial Nominee Program": {
    fee: 4000,
    description:
      "Provincial stream identification, PNP application preparation, nomination support, and subsequent PR application.",
  },
  "Study Permit": {
    fee: 1500,
    description:
      "DLI selection guidance, study permit application preparation, submission, and response handling.",
  },
  "Work Permit": {
    fee: 2000,
    description:
      "LMIA or LMIA-exempt work permit assessment, application preparation, submission, and response handling.",
  },
  "Family Sponsorship": {
    fee: 3500,
    description:
      "Sponsorship eligibility assessment, undertaking and sponsorship application preparation, and submission.",
  },
};

/** Resolve retainer defaults from catalog label and/or pathway_code. */
export function resolvePathwayTemplate(
  pathwayLabel: string | null | undefined,
  pathwayCode?: string | null,
): { fee: number; description: string; key: string } | null {
  const label = (pathwayLabel ?? "").trim();
  if (label && PATHWAY_TEMPLATES[label]) {
    return { ...PATHWAY_TEMPLATES[label], key: label };
  }

  const code = (pathwayCode ?? "").trim();
  if (code === "ee.fsw") {
    return { ...PATHWAY_TEMPLATES["Express Entry – Federal Skilled Worker"], key: "Express Entry – Federal Skilled Worker" };
  }
  if (code === "ee.cec" || code.startsWith("ee.category")) {
    return { ...PATHWAY_TEMPLATES["Express Entry – Canadian Experience Class"], key: "Express Entry – Canadian Experience Class" };
  }
  if (code === "ee.fst") {
    return { ...PATHWAY_TEMPLATES["Express Entry – Federal Skilled Trades"], key: "Express Entry – Federal Skilled Trades" };
  }
  if (code === "pnp" || code.startsWith("pnp.") || code.startsWith("pilot.")) {
    return {
      fee: code.startsWith("pilot.rcip") || code.startsWith("pilot.fcip") ? 4000 : code.startsWith("pilot.aip") ? 3800 : 4000,
      description: label
        ? `${label} — stream matching, nomination/community recommendation, and PR pathway support.`
        : PATHWAY_TEMPLATES["Provincial Nominee Program"].description,
      key: "Provincial Nominee Program",
    };
  }
  if (code.startsWith("quebec")) {
    const fee = code === "quebec.business" ? 5500 : code === "quebec.peq" ? 4200 : 4500;
    return {
      fee,
      description: label
        ? `${label} — Quebec selection (CSQ) and federal PR application support.`
        : "Quebec selection (CSQ) and federal PR application support.",
      key: "Quebec Immigration",
    };
  }
  if (code.startsWith("business")) {
    const fee =
      code === "business.startup" ? 6500 : code === "business.self-employed" ? 5500 : code === "business.caregiver" ? 4000 : 6000;
    return {
      fee,
      description: label
        ? `${label} — eligibility, documentation, and IRCC application support.`
        : "Federal business immigration assessment and PR application support.",
      key: "Business Immigration",
    };
  }
  if (code.startsWith("family")) {
    const fee = code === "family.pgp" ? 3000 : code === "family.child" ? 2200 : 2800;
    return {
      fee,
      description: label
        ? `${label} — sponsorship forms, evidence, and IRCC submission.`
        : PATHWAY_TEMPLATES["Family Sponsorship"].description,
      key: "Family Sponsorship",
    };
  }
  if (code === "study") {
    return { ...PATHWAY_TEMPLATES["Study Permit"], key: "Study Permit" };
  }
  if (code === "work") {
    return { ...PATHWAY_TEMPLATES["Work Permit"], key: "Work Permit" };
  }
  if (code === "visitor" || code.startsWith("visitor.")) {
    return {
      fee: code === "visitor.super" ? 1800 : 1200,
      description: label
        ? `${label} — eligibility, supporting documents, and IRCC submission.`
        : "Temporary resident visa assessment and IRCC submission.",
      key: code === "visitor.super" ? "Super Visa (Parents and Grandparents)" : "Visitor Visa (TRV)",
    };
  }
  if (code === "citizenship" || code.startsWith("citizenship.")) {
    return {
      fee: code === "citizenship.proof" ? 1500 : 2500,
      description: label
        ? `${label} — eligibility, documentation, and IRCC filing.`
        : "Citizenship application preparation and IRCC submission.",
      key: code === "citizenship.proof" ? "Proof of Citizenship Certificate" : "Canadian Citizenship (Grant)",
    };
  }
  if (code === "pr_card") {
    return {
      fee: 1200,
      description: label
        ? `${label} — forms, supporting evidence, and IRCC submission.`
        : "PR card renewal or replacement support.",
      key: "PR Card Renew / Replace",
    };
  }

  const lower = label.toLowerCase();
  if (lower.includes("express entry") || lower.includes("ee category")) {
    return { ...PATHWAY_TEMPLATES["Express Entry – Canadian Experience Class"], key: "Express Entry – Canadian Experience Class" };
  }
  if (lower.includes("nominee") || lower.includes("pnp") || lower.includes("aaip") || lower.includes("oinp") || lower.includes("sinp")) {
    return {
      fee: 4000,
      description: `${label} — provincial nomination and PR pathway support.`,
      key: "Provincial Nominee Program",
    };
  }
  if (lower.includes("quebec") || lower.includes("pstq") || lower.includes("peq") || lower.includes("arrima")) {
    return {
      fee: 4500,
      description: `${label} — Quebec selection (CSQ) and federal PR application support.`,
      key: "Quebec Immigration",
    };
  }
  if (lower.includes("start-up") || lower.includes("startup") || lower.includes("self-employed") || lower.includes("caregiver")) {
    return {
      fee: lower.includes("start") ? 6500 : 5500,
      description: `${label} — eligibility, documentation, and IRCC application support.`,
      key: "Business Immigration",
    };
  }
  if (lower.includes("family") || lower.includes("sponsor") || lower.includes("spouse") || lower.includes("parent")) {
    return { ...PATHWAY_TEMPLATES["Family Sponsorship"], key: "Family Sponsorship" };
  }
  if (lower.includes("study")) {
    return { ...PATHWAY_TEMPLATES["Study Permit"], key: "Study Permit" };
  }
  if (lower.includes("super visa")) {
    return {
      fee: 1800,
      description: `${label} — eligibility, insurance, invitation, and IRCC submission.`,
      key: "Super Visa (Parents and Grandparents)",
    };
  }
  if (lower.includes("visitor") || lower.includes("trv")) {
    return {
      fee: 1200,
      description: `${label} — temporary resident visa assessment and IRCC submission.`,
      key: "Visitor Visa (TRV)",
    };
  }
  if (lower.includes("work permit") || lower === "work permit") {
    return { ...PATHWAY_TEMPLATES["Work Permit"], key: "Work Permit" };
  }

  return null;
}

export function formatAgreementCurrency(amount: number, currency: AgreementCurrency = "CAD") {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(amount);
}

export function milestoneAmounts(config: AgreementConfig) {
  const m1 = Math.round(config.totalFee * config.milestone1Pct / 100);
  const m2 = Math.round(config.totalFee * config.milestone2Pct / 100);
  const m3 = config.totalFee - m1 - m2;
  return { m1, m2, m3 };
}

export function agreementTaxAmount(config: AgreementConfig): number {
  return agreementTaxForAmount(config, config.totalFee);
}

export function agreementTaxForAmount(config: AgreementConfig, amount: number): number {
  if (!config.taxEnabled || config.taxRate <= 0) return 0;
  return Math.round(amount * config.taxRate) / 100;
}

export function agreementGrandTotal(config: AgreementConfig): number {
  return config.totalFee + agreementTaxAmount(config);
}

export function isHtmlEmpty(html: string): boolean {
  return !html || html.replace(/<[^>]*>/g, "").trim() === "";
}

export function resolveAgreementConfig(
  stored: Partial<AgreementConfig> | null | undefined,
  fallback: Partial<AgreementConfig> = {},
): AgreementConfig {
  const merged = { ...DEFAULT_AGREEMENT_CONFIG, ...stored, ...fallback };
  if (!merged.totalFee || merged.totalFee <= 0) {
    merged.totalFee = DEFAULT_AGREEMENT_CONFIG.totalFee;
  }
  return merged;
}

export function configFromCaseFile(caseFile: {
  immigration_pathway?: string | null;
  agreement_fee?: number | null;
  agreement_notes?: string | null;
  agreement_config?: Partial<AgreementConfig> | null;
} | null): AgreementConfig {
  if (!caseFile) return { ...DEFAULT_AGREEMENT_CONFIG };
  return resolveAgreementConfig(caseFile.agreement_config, {
    pathway: caseFile.immigration_pathway ?? "",
    totalFee: caseFile.agreement_fee ? Number(caseFile.agreement_fee) : undefined,
    customClauses: caseFile.agreement_notes ?? "",
  });
}

export interface ClientAgreementDetails {
  fullLegalName?: string | null;
  email?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
  passportNumber?: string | null;
  citizenship?: string | null;
  residentialAddress?: string | null;
  caseReference?: string | null;
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function isVerified(
  verifiedFields: Record<string, boolean> | null | undefined,
  ...keys: string[]
): boolean {
  if (!verifiedFields) return false;
  return keys.some((key) => !!verifiedFields[key]);
}

/**
 * Prefer consultant-verified questionnaire values, then any non-empty candidate.
 * Each candidate: [fieldKeys that count as verified, value].
 */
function pickVerifiedThenAny(
  verifiedFields: Record<string, boolean> | null | undefined,
  candidates: Array<{ keys: string[]; value: unknown }>,
): string | null {
  for (const c of candidates) {
    if (isVerified(verifiedFields, ...c.keys)) {
      const v = pickString(c.value);
      if (v) return v;
    }
  }
  for (const c of candidates) {
    const v = pickString(c.value);
    if (v) return v;
  }
  return null;
}

export function cleanAddressText(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  return value
    .replace(/,\s*,+/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/,\s*$/g, "")
    .trim();
}

function composeAddressParts(...parts: unknown[]): string | null {
  const joined = parts
    .flatMap((part) => {
      if (typeof part !== "string" || !part.trim()) return [];
      return part.split(",").map((s) => s.trim()).filter(Boolean);
    })
    .filter(Boolean);

  return joined.length ? joined.join(", ") : null;
}

function formatAgreementDob(value: unknown): string | null {
  const raw = pickString(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

export function mergeClientAgreementDetails(
  base: ClientAgreementDetails,
  overrides?: Partial<ClientAgreementDetails> | null,
): ClientAgreementDetails {
  if (!overrides) return base;
  const merged: ClientAgreementDetails = { ...base };
  (Object.keys(overrides) as (keyof ClientAgreementDetails)[]).forEach((key) => {
    const value = overrides[key];
    if (typeof value === "string" && value.trim()) {
      merged[key] = key === "residentialAddress" ? cleanAddressText(value) : value.trim();
    }
  });
  return merged;
}

/** Fill gaps from stored config only — questionnaire/verified extract wins. */
export function mergeStoredAgreementDetailsGaps(
  extracted: ClientAgreementDetails,
  stored?: Partial<ClientAgreementDetails> | null,
): ClientAgreementDetails {
  if (!stored) return extracted;
  const merged: ClientAgreementDetails = { ...extracted };
  (Object.keys(stored) as (keyof ClientAgreementDetails)[]).forEach((key) => {
    const existing = merged[key];
    if (typeof existing === "string" && existing.trim()) return;
    const value = stored[key];
    if (typeof value === "string" && value.trim()) {
      merged[key] = key === "residentialAddress" ? cleanAddressText(value) : value.trim();
    }
  });
  return merged;
}

export function extractClientAgreementDetails(params: {
  clientProfile?: { phone?: string | null; passport_number?: string | null; id?: number } | null;
  clientUser?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  questionnaireMain?: Record<string, unknown> | null;
  questionnaireStep1?: Record<string, unknown> | null;
  verifiedFields?: Record<string, boolean> | null;
  storedDetails?: Partial<ClientAgreementDetails> | null;
  clientProfileId?: string | number | null;
}): ClientAgreementDetails {
  const md = params.questionnaireMain ?? {};
  const s1 = params.questionnaireStep1 ?? {};
  const vf = params.verifiedFields ?? {};
  const composedName = [md.firstName, md.lastName]
    .filter((v) => typeof v === "string" && v.trim())
    .join(" ")
    .trim();

  const fullLegalName = pickVerifiedThenAny(vf, [
    { keys: ["main_data.passportFullName", "main_data.fullName"], value: md.passportFullName },
    { keys: ["main_data.fullName", "main_data.passportFullName"], value: md.fullName },
    { keys: ["main_data.nicFullName"], value: md.nicFullName },
    { keys: ["main_data.firstName", "main_data.lastName"], value: composedName || null },
    { keys: ["step1_data.fullName"], value: s1.fullName },
    { keys: [], value: params.clientUser?.name },
  ]);

  const email = pickVerifiedThenAny(vf, [
    { keys: ["step1_data.email", "main_data.email"], value: s1.email },
    { keys: ["main_data.email"], value: md.email },
    { keys: [], value: params.clientUser?.email },
  ]);

  const phone = pickVerifiedThenAny(vf, [
    { keys: ["main_data.phone"], value: md.phone },
    { keys: ["main_data.mobile"], value: md.mobile },
    { keys: ["step1_data.whatsapp"], value: s1.whatsapp },
    { keys: [], value: params.clientProfile?.phone },
    { keys: [], value: params.clientUser?.phone },
  ]);

  const dobRaw = pickVerifiedThenAny(vf, [
    { keys: ["main_data.dob"], value: md.dob },
    { keys: ["main_data.passportDob"], value: md.passportDob },
    { keys: ["main_data.nicDob"], value: md.nicDob },
  ]);

  const passportNumber = pickVerifiedThenAny(vf, [
    { keys: ["main_data.passportNumber"], value: md.passportNumber },
    { keys: [], value: params.clientProfile?.passport_number },
  ]);

  const citizenship = pickVerifiedThenAny(vf, [
    { keys: ["main_data.passportNationality"], value: md.passportNationality },
    { keys: ["main_data.nationality"], value: md.nationality },
  ]);

  const addressRaw = pickVerifiedThenAny(vf, [
    { keys: ["main_data.nicAddress"], value: md.nicAddress },
    { keys: ["main_data.currentAddress", "main_data.addressLine1"], value: md.currentAddress },
    { keys: ["main_data.address", "main_data.addressLine1"], value: md.address },
    { keys: ["main_data.mailingAddress"], value: md.mailingAddress },
    { keys: ["main_data.residentialAddress"], value: md.residentialAddress },
    {
      keys: ["main_data.addressLine1", "main_data.city", "main_data.province", "main_data.postalCode"],
      value: composeAddressParts(
        md.addressLine1 ?? md.streetAddress,
        md.city,
        md.province,
        md.postalCode,
        md.countryOfResidence ?? md.country,
      ),
    },
  ]);

  const extracted: ClientAgreementDetails = {
    fullLegalName,
    email,
    phone,
    dateOfBirth: formatAgreementDob(dobRaw),
    passportNumber,
    citizenship,
    residentialAddress: cleanAddressText(addressRaw),
    caseReference: params.clientProfileId ? `WTC-${params.clientProfileId}` : null,
  };

  // Stored agreement_config fills gaps only — never override fresh questionnaire/verified data.
  return mergeStoredAgreementDetailsGaps(extracted, params.storedDetails);
}

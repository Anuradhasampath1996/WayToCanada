export type AgreementCurrency = "CAD" | "USD";

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
  clientDetails?: ClientAgreementDetails;
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

export function formatAgreementCurrency(amount: number, currency: AgreementCurrency = "CAD") {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency }).format(amount);
}

export function milestoneAmounts(config: AgreementConfig) {
  const m1 = Math.round(config.totalFee * config.milestone1Pct / 100);
  const m2 = Math.round(config.totalFee * config.milestone2Pct / 100);
  const m3 = config.totalFee - m1 - m2;
  return { m1, m2, m3 };
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

export function extractClientAgreementDetails(params: {
  clientProfile?: { phone?: string | null; passport_number?: string | null; id?: number } | null;
  clientUser?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  questionnaireMain?: Record<string, unknown> | null;
  questionnaireStep1?: Record<string, unknown> | null;
  storedDetails?: Partial<ClientAgreementDetails> | null;
  clientProfileId?: string | number | null;
}): ClientAgreementDetails {
  const md = params.questionnaireMain ?? {};
  const s1 = params.questionnaireStep1 ?? {};
  const passportName = pickString(md.passportFullName, md.fullName, md.nicFullName);
  const composedName = [md.firstName, md.lastName].filter((v) => typeof v === "string" && v.trim()).join(" ").trim();
  const residentialAddress = cleanAddressText(
    pickString(
      md.nicAddress,
      md.currentAddress,
      md.address,
      md.mailingAddress,
      md.residentialAddress,
      composeAddressParts(md.streetAddress, md.city, md.province, md.postalCode, md.country),
    ),
  );

  const extracted: ClientAgreementDetails = {
    fullLegalName: passportName || composedName || pickString(s1.fullName) || params.clientUser?.name || null,
    email: pickString(s1.email, params.clientUser?.email),
    phone: pickString(md.phone, md.mobile, s1.whatsapp, params.clientProfile?.phone, params.clientUser?.phone),
    dateOfBirth: formatAgreementDob(md.dob ?? md.passportDob ?? md.nicDob),
    passportNumber: pickString(md.passportNumber, params.clientProfile?.passport_number),
    citizenship: pickString(md.passportNationality, md.nationality),
    residentialAddress,
    caseReference: params.clientProfileId ? `WTC-${params.clientProfileId}` : null,
  };

  return mergeClientAgreementDetails(extracted, params.storedDetails);
}

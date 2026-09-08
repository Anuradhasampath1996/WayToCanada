import type {
  GovernmentFormItem,
  GovernmentFormMissingField,
  GovernmentFormsIndexResponse,
} from "./government-forms-api";

export type WorkflowStepId =
  | "review"
  | "complete_data"
  | "generate"
  | "preview"
  | "download";

export type WorkflowStepStatus = "pending" | "active" | "complete" | "blocked";

export type WorkflowStep = {
  id: WorkflowStepId;
  title: string;
  description: string;
  status: WorkflowStepStatus;
};

/** Maps government-form canonical keys to questionnaire field_remarks keys. */
const CANONICAL_TO_QUESTIONNAIRE: Record<string, string> = {
  "applicant.personal.family_name": "main_data.passportFullName",
  "applicant.personal.given_names": "main_data.passportFullName",
  "applicant.personal.full_name": "main_data.passportFullName",
  "applicant.personal.date_of_birth": "main_data.dob",
  "applicant.personal.uci": "main_data.uci",
  "applicant.application.type": "main_data.imm5476ApplicationType",
  "applicant.personal.country_of_birth": "main_data.birthCountry",
  "applicant.personal.address.full": "main_data.addressLine1",
  "applicant.personal.marital_status": "step1_data.married",
  "applicant.contact.email": "step1_data.email",
  "applicant.family.spouse.family_name": "spouse_data.fullName",
  "applicant.family.spouse.given_names": "spouse_data.fullName",
  "applicant.family.spouse.date_of_birth": "spouse_data.dob",
  "applicant.family.spouse.contact.email": "spouse_data.email",
  "applicant.family.parent1.family_name": "accompanying_data.parent1.fullName",
  "applicant.family.parent1.given_names": "accompanying_data.parent1.fullName",
  "applicant.family.parent1.date_of_birth": "accompanying_data.parent1.dob",
  "applicant.family.parent2.family_name": "accompanying_data.parent2.fullName",
  "applicant.family.parent2.given_names": "accompanying_data.parent2.fullName",
  "applicant.family.parent2.date_of_birth": "accompanying_data.parent2.dob",
};

export type GapFieldInputType = "text" | "date" | "email" | "select";

export type GapFieldFillSpec = {
  inputType: GapFieldInputType;
  options?: string[];
  fillable: boolean;
};

const CANONICAL_FILL_SPECS: Record<string, GapFieldFillSpec> = {
  "applicant.personal.date_of_birth": { inputType: "date", fillable: true },
  "applicant.personal.uci": { inputType: "text", fillable: true },
  "applicant.application.type": { inputType: "text", fillable: true },
  "applicant.personal.country_of_birth": { inputType: "text", fillable: true },
  "applicant.personal.marital_status": { inputType: "select", options: ["yes", "no"], fillable: true },
  "applicant.contact.email": { inputType: "email", fillable: true },
  "applicant.personal.address.full": { inputType: "text", fillable: true },
  "applicant.personal.family_name": { inputType: "text", fillable: true },
  "applicant.personal.given_names": { inputType: "text", fillable: true },
  "applicant.personal.full_name": { inputType: "text", fillable: true },
  "applicant.family.spouse.family_name": { inputType: "text", fillable: true },
  "applicant.family.spouse.given_names": { inputType: "text", fillable: true },
  "applicant.family.spouse.date_of_birth": { inputType: "date", fillable: true },
  "applicant.family.spouse.contact.email": { inputType: "email", fillable: true },
  "applicant.family.parent1.family_name": { inputType: "text", fillable: true },
  "applicant.family.parent1.given_names": { inputType: "text", fillable: true },
  "applicant.family.parent1.date_of_birth": { inputType: "date", fillable: true },
  "applicant.family.parent2.family_name": { inputType: "text", fillable: true },
  "applicant.family.parent2.given_names": { inputType: "text", fillable: true },
  "applicant.family.parent2.date_of_birth": { inputType: "date", fillable: true },
  "representative.rcic_number": { inputType: "text", fillable: true },
  "representative.membership_id": { inputType: "text", fillable: true },
  "representative.personal.given_names": { inputType: "text", fillable: true },
  "representative.personal.family_name": { inputType: "text", fillable: true },
  "representative.personal.full_name": { inputType: "text", fillable: true },
  "representative.firm_name": { inputType: "text", fillable: true },
  "representative.contact.email": { inputType: "email", fillable: true },
  "representative.contact.phone": { inputType: "text", fillable: true },
  "representative.contact.phone_number": { inputType: "text", fillable: true },
  "representative.contact.phone_country_code": { inputType: "text", fillable: true },
  "representative.address.unit": { inputType: "text", fillable: true },
  "representative.address.street_number": { inputType: "text", fillable: true },
  "representative.address.street_name": { inputType: "text", fillable: true },
  "representative.address.line1": { inputType: "text", fillable: true },
  "representative.address.line2": { inputType: "text", fillable: true },
  "representative.address.city": { inputType: "text", fillable: true },
  "representative.address.province": { inputType: "text", fillable: true },
  "representative.address.postal_code": { inputType: "text", fillable: true },
  "representative.address.country": { inputType: "text", fillable: true },
};

export function mapCanonicalToQuestionnaireField(canonicalKey: string): string | null {
  if (CANONICAL_TO_QUESTIONNAIRE[canonicalKey]) {
    return CANONICAL_TO_QUESTIONNAIRE[canonicalKey];
  }

  if (canonicalKey.match(/^applicant\.family\.children\.\d+\./)) {
    const idx = canonicalKey.match(/^applicant\.family\.children\.(\d+)\./)?.[1];
    if (!idx) return "children_data";
    if (canonicalKey.endsWith(".date_of_birth")) return `children_data.${idx}.dob`;
    if (canonicalKey.endsWith(".family_name") || canonicalKey.endsWith(".given_names") || canonicalKey.endsWith(".full_name")) {
      return `children_data.${idx}.fullName`;
    }
    if (canonicalKey.endsWith(".country_of_birth")) return `children_data.${idx}.nicBirthPlace`;
    if (canonicalKey.endsWith(".address.full")) return `children_data.${idx}.nicAddress`;
    if (canonicalKey.endsWith(".marital_status")) return `children_data.${idx}.maritalStatus`;
    if (canonicalKey.endsWith(".contact.email")) return `children_data.${idx}.email`;
    if (canonicalKey.endsWith(".relationship")) return `children_data.${idx}.relationship`;
  }
  if (canonicalKey.startsWith("overflow.")) {
    return null;
  }

  return null;
}

export function gapFieldFillSpec(canonicalKey: string): GapFieldFillSpec | null {
  if (CANONICAL_FILL_SPECS[canonicalKey]) {
    return CANONICAL_FILL_SPECS[canonicalKey];
  }
  if (canonicalKey.match(/^applicant\.family\.(children|siblings|parent[12])\.\d*\.?/ ) || canonicalKey.match(/^applicant\.family\.parent[12]\./) || canonicalKey.match(/^applicant\.family\.siblings\.\d+\./) || canonicalKey.match(/^applicant\.family\.children\.\d+\./)) {
    if (canonicalKey.endsWith(".date_of_birth")) return { inputType: "date", fillable: true };
    if (
      canonicalKey.endsWith(".family_name")
      || canonicalKey.endsWith(".given_names")
      || canonicalKey.endsWith(".full_name")
      || canonicalKey.endsWith(".country_of_birth")
      || canonicalKey.endsWith(".address.full")
      || canonicalKey.endsWith(".marital_status")
      || canonicalKey.endsWith(".relationship")
    ) {
      return { inputType: "text", fillable: true };
    }
    if (canonicalKey.endsWith(".contact.email")) return { inputType: "email", fillable: true };
  }
  if (canonicalKey.startsWith("applicant.family.spouse.")) {
    if (canonicalKey.endsWith(".date_of_birth")) return { inputType: "date", fillable: true };
    if (canonicalKey.endsWith(".contact.email")) return { inputType: "email", fillable: true };
    return { inputType: "text", fillable: true };
  }
  if (canonicalKey.startsWith("representative.")) {
    if (canonicalKey.endsWith(".email") || canonicalKey.endsWith("contact.email")) {
      return { inputType: "email", fillable: true };
    }
    return { inputType: "text", fillable: true };
  }
  if (canonicalKey === "applicant.personal.uci") {
    return { inputType: "text", fillable: true };
  }
  return null;
}

export function canFillGapField(field: GovernmentFormMissingField): boolean {
  return !field.key.startsWith("overflow.") && gapFieldFillSpec(field.key)?.fillable === true;
}

export function canRequestFromClient(field: GovernmentFormMissingField): boolean {
  return (
    field.responsible_party === "client"
    && !field.key.startsWith("overflow.")
    && mapCanonicalToQuestionnaireField(field.key) !== null
  );
}

export type AggregateReadiness = {
  formCount: number;
  averagePercentage: number;
  allReady: boolean;
  totalMissing: number;
  clientMissing: number;
  consultantMissing: number;
  anyGenerated: boolean;
  anyDownloadable: boolean;
};

export function aggregateReadiness(forms: GovernmentFormItem[]): AggregateReadiness {
  const totalMissing = forms.reduce((n, f) => n + f.readiness.missing_fields.length, 0);
  const clientMissing = forms.reduce(
    (n, f) => n + f.readiness.missing_fields.filter((m) => m.responsible_party === "client").length,
    0,
  );
  const consultantMissing = totalMissing - clientMissing;
  const averagePercentage =
    forms.length === 0
      ? 0
      : Math.round(forms.reduce((s, f) => s + f.readiness.percentage, 0) / forms.length);

  return {
    formCount: forms.length,
    averagePercentage,
    allReady: forms.every((f) => f.readiness.ready),
    totalMissing,
    clientMissing,
    consultantMissing,
    anyGenerated: forms.some((f) => f.current_generation !== null),
    anyDownloadable: forms.some((f) => f.current_generation?.output_sha256),
  };
}

export function computeWorkflowSteps(data: GovernmentFormsIndexResponse): WorkflowStep[] {
  const agg = aggregateReadiness(data.forms);
  const reviewed = data.application_info_reviewed;
  const stale = data.application_info_stale || data.forms.some((f) => f.current_generation?.is_stale);

  const reviewStatus: WorkflowStepStatus = reviewed && !stale ? "complete" : reviewed ? "active" : "active";
  const dataStatus: WorkflowStepStatus = !reviewed
    ? "pending"
    : agg.allReady
      ? "complete"
      : "active";
  const generateStatus: WorkflowStepStatus = !reviewed
    ? "pending"
    : !agg.allReady
      ? "blocked"
      : agg.anyGenerated
        ? "complete"
        : "active";
  const previewStatus: WorkflowStepStatus = agg.anyGenerated ? "complete" : "pending";
  const downloadStatus: WorkflowStepStatus = agg.anyDownloadable ? "complete" : "pending";

  return [
    {
      id: "review",
      title: "Review client data",
      description: reviewed
        ? stale
          ? "Re-review after client updates"
          : "Application snapshot locked for generation"
        : "Confirm questionnaire data before generating forms",
      status: stale && reviewed ? "active" : reviewStatus,
    },
    {
      id: "complete_data",
      title: "Fill missing information",
      description: agg.allReady
        ? "All required fields present for auto-fill"
        : `${agg.totalMissing} gap${agg.totalMissing === 1 ? "" : "s"} — request from client or fill yourself`,
      status: dataStatus,
    },
    {
      id: "generate",
      title: "Generate government forms",
      description: agg.allReady
        ? "Auto-fill official IRCC PDFs from case data"
        : "Reach 100% readiness on each form first",
      status: generateStatus,
    },
    {
      id: "preview",
      title: "Preview & verify",
      description: "Review populated PDF in browser; validate in Adobe Reader",
      status: previewStatus,
    },
    {
      id: "download",
      title: "Download for filing",
      description: "Download verified forms for IRCC submission",
      status: downloadStatus,
    },
  ];
}

export function groupMissingFields(fields: GovernmentFormMissingField[]) {
  return {
    client: fields.filter((f) => f.responsible_party === "client" && !f.key.startsWith("overflow.")),
    consultant: fields.filter((f) => f.responsible_party === "consultant"),
    overflow: fields.filter((f) => f.key.startsWith("overflow.")),
  };
}

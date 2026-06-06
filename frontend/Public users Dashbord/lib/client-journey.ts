export interface ClientCaseFile {
  id: number;
  status: string;
  immigration_pathway: string | null;
  agreement_token: string | null;
  agreement_sent_at: string | null;
  agreement_signed_at: string | null;
  application_forms_verified_at: string | null;
}

export interface ClientFormsVerification {
  agreement_signed: boolean;
  total_forms: number;
  submitted_count: number;
  reviewed_count: number;
  all_submitted: boolean;
  all_reviewed: boolean;
  verified_at: string | null;
  case_management_unlocked: boolean;
}

export type JourneyStepId = "questionnaire" | "retainer" | "forms" | "documents";

export type JourneyStepStatus = "done" | "active" | "waiting" | "locked";

export interface JourneyStep {
  id: JourneyStepId;
  number: number;
  title: string;
  navLabel: string;
  description: string;
  href: string;
  status: JourneyStepStatus;
  actionLabel: string;
  lockedReason?: string;
}

const STATUS_ORDER: Record<string, number> = {
  PENDING_ASSESSMENT: 0,
  PATHWAY_SELECTED: 1,
  AGREEMENT_SENT: 2,
  AGREEMENT_SIGNED: 3,
  DOCUMENTS_UPLOADING: 4,
  UNDER_REVIEW: 4,
  READY_FOR_SUBMISSION: 4,
  APPLICATION_SUBMITTED: 4,
};

export function effectiveStatusStep(caseFile: ClientCaseFile): number {
  const step = STATUS_ORDER[caseFile.status] ?? 0;
  if (caseFile.agreement_signed_at) return Math.max(step, 3);
  if (caseFile.agreement_sent_at) return Math.max(step, 2);
  return step;
}

export function caseManagementUnlocked(
  caseFile: ClientCaseFile | null,
  verification: ClientFormsVerification | null,
): boolean {
  if (!caseFile) return false;
  return Boolean(verification?.case_management_unlocked ?? caseFile.application_forms_verified_at);
}

export function buildClientJourney(
  caseFile: ClientCaseFile | null,
  verification: ClientFormsVerification | null,
  hasForms: boolean,
): { steps: JourneyStep[]; currentStepId: JourneyStepId; progressPercent: number } {
  const order = caseFile ? effectiveStatusStep(caseFile) : 0;
  const agreementSigned = Boolean(caseFile?.agreement_signed_at);
  const agreementSent = Boolean(caseFile?.agreement_sent_at);
  const pathwaySet = order >= 1;
  const docsUnlocked = caseManagementUnlocked(caseFile, verification);
  const allFormsSubmitted = verification?.all_submitted ?? false;
  const formsReviewed = verification?.all_reviewed ?? false;

  const questionnaireStatus: JourneyStepStatus =
    !caseFile || order === 0 ? "active" : "done";

  let retainerStatus: JourneyStepStatus = "locked";
  if (agreementSigned) retainerStatus = "done";
  else if (agreementSent || order >= 2) retainerStatus = "active";
  else if (pathwaySet) retainerStatus = "waiting";

  let formsStatus: JourneyStepStatus = "locked";
  if (docsUnlocked || formsReviewed) formsStatus = "done";
  else if (agreementSigned && hasForms) formsStatus = allFormsSubmitted ? "waiting" : "active";
  else if (agreementSigned && !hasForms) formsStatus = "done";
  else if (agreementSigned) formsStatus = "active";

  let documentsStatus: JourneyStepStatus = "locked";
  if (docsUnlocked) documentsStatus = "active";
  else if (agreementSigned) documentsStatus = "waiting";

  const steps: JourneyStep[] = [
    {
      id: "questionnaire",
      number: 1,
      title: "Complete your profile",
      navLabel: "Questionnaire",
      description: "Tell us about your background so your consultant can assess eligibility and recommend a pathway.",
      href: "/user-dashboard/questionnaire",
      status: questionnaireStatus,
      actionLabel: "Open questionnaire",
    },
    {
      id: "retainer",
      number: 2,
      title: "Sign retainer agreement",
      navLabel: "Retainer agreement",
      description: "Review and sign the agreement to officially start working with your consultant.",
      href: "/user-dashboard/retainer-agreement",
      status: retainerStatus,
      actionLabel: agreementSent ? "Sign agreement" : "View agreement",
      lockedReason: pathwaySet
        ? undefined
        : "Available after your consultant confirms your pathway.",
    },
    {
      id: "forms",
      number: 3,
      title: "Submit application forms",
      navLabel: "Application forms",
      description: hasForms
        ? "Fill in the IRCC forms assigned to your case. We pre-fill answers from your questionnaire when possible."
        : "Your consultant will assign forms if needed for your pathway.",
      href: "/user-dashboard/application-forms",
      status: formsStatus,
      actionLabel: allFormsSubmitted ? "View submitted forms" : "Continue forms",
      lockedReason: agreementSigned
        ? undefined
        : "Unlocks after you sign the retainer agreement.",
    },
    {
      id: "documents",
      number: 4,
      title: "Upload documents & message consultant",
      navLabel: "Case documents",
      description: "Upload required documents, track review status, and chat with your consultant.",
      href: "/user-dashboard/case-management",
      status: documentsStatus,
      actionLabel: "Open case documents",
      lockedReason: docsUnlocked
        ? undefined
        : agreementSigned
          ? "Unlocks after your consultant verifies your application forms."
          : "Complete the earlier steps first.",
    },
  ];

  const currentStepId =
    steps.find((s) => s.status === "active")?.id
    ?? steps.find((s) => s.status === "waiting")?.id
    ?? (docsUnlocked ? "documents" : "questionnaire");

  const doneCount = steps.filter((s) => s.status === "done").length;
  const activeBonus = steps.some((s) => s.status === "active") ? 0.5 : 0;
  const progressPercent = Math.round(((doneCount + activeBonus) / steps.length) * 100);

  return { steps, currentStepId, progressPercent };
}

export function canAccessNavStep(
  stepId: JourneyStepId,
  caseFile: ClientCaseFile | null,
  verification: ClientFormsVerification | null,
): boolean {
  if (!caseFile && stepId !== "questionnaire") return false;
  const order = caseFile ? effectiveStatusStep(caseFile) : 0;

  switch (stepId) {
    case "questionnaire":
      return true;
    case "retainer":
      return order >= 1 || Boolean(caseFile?.agreement_sent_at);
    case "forms":
      return Boolean(caseFile?.agreement_signed_at);
    case "documents":
      return caseManagementUnlocked(caseFile, verification);
    default:
      return false;
  }
}

export const CLIENT_STATUS_LABELS: Record<string, string> = {
  PENDING_ASSESSMENT: "Profile in review",
  PATHWAY_SELECTED: "Pathway confirmed",
  AGREEMENT_SENT: "Agreement ready to sign",
  AGREEMENT_SIGNED: "Agreement signed",
  DOCUMENTS_UPLOADING: "Uploading documents",
  UNDER_REVIEW: "Under consultant review",
  READY_FOR_SUBMISSION: "Ready for submission",
  APPLICATION_SUBMITTED: "Application submitted",
};

export function clientStatusLabel(status: string): string {
  return CLIENT_STATUS_LABELS[status] ?? status.replace(/_/g, " ").toLowerCase();
}

import type { ClientQuestionnaireStats } from "@/lib/client-questionnaire-stats";

export interface ClientCaseFile {
  id: number;
  status: string;
  immigration_pathway: string | null;
  agreement_token: string | null;
  agreement_sent_at: string | null;
  agreement_signed_at: string | null;
  application_forms_verified_at: string | null;
  pathway_assessment_at?: string | null;
  pathway_assessment_notes?: string | null;
  pathway_assessment_crs_score?: number | null;
  pathway_assessment_ircc_crs_score?: number | null;
  pathway_assessment_snapshot?: {
    principal_applicant?: "main" | "spouse";
    has_spouse?: boolean;
    comparison?: { recommendation?: string };
  } | null;
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

export interface ClientJourneyMeta {
  questionnaireSubmitted: boolean;
  pendingRefills: number;
  assessmentWaiting: boolean;
  pathwayAssigned: string | null;
}

export interface ClientNextAction {
  tone: "primary" | "warning" | "info" | "success";
  title: string;
  description: string;
  href?: string;
  buttonLabel?: string;
}

export interface ClientActivityEvent {
  id: string;
  label: string;
  at: string | null;
  done: boolean;
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
  qStats: ClientQuestionnaireStats,
): {
  steps: JourneyStep[];
  currentStepId: JourneyStepId;
  progressPercent: number;
  meta: ClientJourneyMeta;
} {
  const pathwaySet = Boolean(caseFile?.immigration_pathway);
  const agreementSigned = Boolean(caseFile?.agreement_signed_at);
  const agreementSent = Boolean(caseFile?.agreement_sent_at);
  const docsUnlocked = caseManagementUnlocked(caseFile, verification);
  const allFormsSubmitted = verification?.all_submitted ?? false;
  const formsReviewed = verification?.all_reviewed ?? false;
  const pendingRefills = qStats.pendingRefills;

  const assessmentWaiting =
    qStats.isSubmitted && pendingRefills === 0 && !pathwaySet;

  let questionnaireStatus: JourneyStepStatus = "active";
  if (pendingRefills > 0) questionnaireStatus = "active";
  else if (!qStats.isSubmitted) questionnaireStatus = "active";
  else if (assessmentWaiting) questionnaireStatus = "waiting";
  else if (pathwaySet || qStats.isSubmitted) questionnaireStatus = "done";

  let retainerStatus: JourneyStepStatus = "locked";
  if (agreementSigned) retainerStatus = "done";
  else if (agreementSent) retainerStatus = "active";
  else if (pathwaySet) retainerStatus = "waiting";
  else if (assessmentWaiting) retainerStatus = "locked";

  let formsStatus: JourneyStepStatus = "locked";
  if (docsUnlocked || formsReviewed) formsStatus = "done";
  else if (agreementSigned && hasForms) formsStatus = allFormsSubmitted ? "waiting" : "active";
  else if (agreementSigned && !hasForms) formsStatus = "done";

  let documentsStatus: JourneyStepStatus = "locked";
  if (docsUnlocked) documentsStatus = "active";
  else if (agreementSigned && allFormsSubmitted) documentsStatus = "waiting";

  const steps: JourneyStep[] = [
    {
      id: "questionnaire",
      number: 1,
      title: pendingRefills > 0 ? "Fix questionnaire corrections" : "Complete your profile",
      navLabel: "Your profile",
      description: pendingRefills > 0
        ? `Your consultant flagged ${pendingRefills} item${pendingRefills === 1 ? "" : "s"} to update.`
        : "Tell us about your background so your consultant can assess eligibility and recommend a pathway.",
      href: "/user-dashboard/questionnaire",
      status: questionnaireStatus,
      actionLabel: pendingRefills > 0 ? "Fix corrections" : qStats.isSubmitted ? "View questionnaire" : "Open questionnaire",
    },
    {
      id: "retainer",
      number: 2,
      title: "Sign retainer agreement",
      navLabel: "Sign agreement",
      description: "Review and sign the agreement to officially start working with your consultant.",
      href: "/user-dashboard/retainer-agreement",
      status: retainerStatus,
      actionLabel: agreementSent ? "Sign agreement" : "View agreement",
      lockedReason: pathwaySet
        ? agreementSent ? undefined : "Your consultant is preparing the agreement."
        : assessmentWaiting
          ? "Available after your consultant confirms your pathway."
          : "Submit your questionnaire first.",
    },
    {
      id: "forms",
      number: 3,
      title: "Submit application forms",
      navLabel: "Government forms",
      description: hasForms
        ? "Fill in the IRCC forms assigned to your case. We pre-fill answers from your questionnaire when possible."
        : "Your consultant will assign forms if needed for your pathway.",
      href: "/user-dashboard/application-forms",
      status: formsStatus,
      actionLabel: allFormsSubmitted ? "View submitted forms" : "Continue forms",
      lockedReason: agreementSigned ? undefined : "Unlocks after you sign the retainer agreement.",
    },
    {
      id: "documents",
      number: 4,
      title: "Upload documents & message consultant",
      navLabel: "Documents & messages",
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

  return {
    steps,
    currentStepId,
    progressPercent,
    meta: {
      questionnaireSubmitted: qStats.isSubmitted,
      pendingRefills,
      assessmentWaiting,
      pathwayAssigned: caseFile?.immigration_pathway ?? null,
    },
  };
}

export function canAccessNavStep(
  stepId: JourneyStepId,
  caseFile: ClientCaseFile | null,
  verification: ClientFormsVerification | null,
): boolean {
  if (stepId === "questionnaire") return true;
  if (!caseFile) return false;

  switch (stepId) {
    case "retainer":
      return Boolean(caseFile.immigration_pathway) || Boolean(caseFile.agreement_sent_at);
    case "forms":
      return Boolean(caseFile.agreement_signed_at);
    case "documents":
      return caseManagementUnlocked(caseFile, verification);
    default:
      return false;
  }
}

/** LMS unlocks when consultant assigns an immigration pathway (matches backend LmsPathwayGate). */
export function canAccessLearning(caseFile: ClientCaseFile | null): boolean {
  return Boolean(caseFile?.immigration_pathway);
}

/** Read consultant messages after retainer signed (send still needs full case hub). */
export function canAccessClientMessages(caseFile: ClientCaseFile | null): boolean {
  return Boolean(caseFile?.agreement_signed_at);
}

export const LEARNING_LOCKED_REASON =
  "Unlocks after your consultant assigns your immigration pathway.";

export function resolveClientNextAction(
  caseFile: ClientCaseFile | null,
  verification: ClientFormsVerification | null,
  qStats: ClientQuestionnaireStats,
  hasForms: boolean,
  meta: ClientJourneyMeta,
): ClientNextAction {
  if (qStats.pendingRefills > 0) {
    return {
      tone: "warning",
      title: `${qStats.pendingRefills} correction${qStats.pendingRefills === 1 ? "" : "s"} needed`,
      description: "Your consultant asked you to update parts of your questionnaire. Fix the flagged items and save your changes.",
      href: "/user-dashboard/questionnaire",
      buttonLabel: "Fix questionnaire",
    };
  }

  if (!qStats.isSubmitted) {
    return {
      tone: "primary",
      title: "Complete your questionnaire",
      description: "Fill in your profile and upload identity documents so your consultant can assess your eligibility.",
      href: "/user-dashboard/questionnaire",
      buttonLabel: "Open questionnaire",
    };
  }

  if (meta.assessmentWaiting) {
    return {
      tone: "info",
      title: "Consultant is reviewing your profile",
      description: "Your questionnaire was submitted. Your consultant is scoring your profile and selecting the best immigration pathway.",
    };
  }

  if (!caseFile?.immigration_pathway) {
    return {
      tone: "info",
      title: "Waiting for pathway confirmation",
      description: "Your consultant will confirm your immigration pathway soon. You'll be notified when the retainer agreement is ready.",
    };
  }

  if (!caseFile.agreement_signed_at) {
    if (!caseFile.agreement_sent_at) {
      return {
        tone: "waiting" as "info",
        title: "Retainer agreement coming soon",
        description: `${caseFile.immigration_pathway} is confirmed. Your consultant is preparing your retainer agreement.`,
      };
    }
    return {
      tone: "primary",
      title: "Sign your retainer agreement",
      description: "Your agreement is ready. Review the terms and sign digitally to move forward.",
      href: "/user-dashboard/retainer-agreement",
      buttonLabel: "Sign agreement",
    };
  }

  if (hasForms && verification && !verification.all_submitted) {
    return {
      tone: "primary",
      title: "Complete application forms",
      description: `${verification.submitted_count}/${verification.total_forms} forms submitted. Finish the remaining IRCC forms.`,
      href: "/user-dashboard/application-forms",
      buttonLabel: "Continue forms",
    };
  }

  if (hasForms && verification && verification.all_submitted && !verification.all_reviewed) {
    return {
      tone: "info",
      title: "Forms under consultant review",
      description: "All forms are submitted. Your consultant is reviewing them — case documents will unlock when verified.",
      href: "/user-dashboard/application-forms",
      buttonLabel: "View forms",
    };
  }

  if (caseManagementUnlocked(caseFile, verification)) {
    return {
      tone: "success",
      title: "Upload your case documents",
      description: "Your case hub is open. Upload required documents and message your consultant.",
      href: "/user-dashboard/case-management",
      buttonLabel: "Open case documents",
    };
  }

  return {
    tone: "info",
    title: "Continue your journey",
    description: "Follow the steps below to keep your application moving.",
    href: "/user-dashboard",
    buttonLabel: "View dashboard",
  };
}

export function buildClientActivity(
  caseFile: ClientCaseFile | null,
  verification: ClientFormsVerification | null,
  qStats: ClientQuestionnaireStats,
): ClientActivityEvent[] {
  return [
    {
      id: "submitted",
      label: qStats.isSubmitted ? "Questionnaire submitted" : "Questionnaire in progress",
      at: qStats.submittedAt,
      done: qStats.isSubmitted,
    },
    {
      id: "refill",
      label: qStats.pendingRefills > 0 ? `${qStats.pendingRefills} corrections requested` : "No corrections pending",
      at: null,
      done: qStats.isSubmitted && qStats.pendingRefills === 0,
    },
    {
      id: "pathway",
      label: caseFile?.immigration_pathway ? `Pathway: ${caseFile.immigration_pathway}` : "Pathway pending",
      at: caseFile?.pathway_assessment_at ?? null,
      done: Boolean(caseFile?.immigration_pathway),
    },
    {
      id: "agreement",
      label: caseFile?.agreement_signed_at ? "Retainer signed" : caseFile?.agreement_sent_at ? "Agreement sent — sign now" : "Retainer agreement",
      at: caseFile?.agreement_signed_at ?? caseFile?.agreement_sent_at ?? null,
      done: Boolean(caseFile?.agreement_signed_at),
    },
    {
      id: "forms",
      label: verification && verification.total_forms > 0
        ? `Forms ${verification.submitted_count}/${verification.total_forms} submitted`
        : "Application forms",
      at: null,
      done: Boolean(verification?.all_submitted),
    },
    {
      id: "hub",
      label: "Case documents hub",
      at: caseFile?.application_forms_verified_at ?? null,
      done: caseManagementUnlocked(caseFile, verification),
    },
  ];
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

export const JOURNEY_STEP_PAGES: Record<JourneyStepId, { step: number; label: string; title: string }> = {
  questionnaire: { step: 1, label: "Your profile", title: "Your profile" },
  retainer: { step: 2, label: "Sign agreement", title: "Sign agreement" },
  forms: { step: 3, label: "Government forms", title: "Government forms" },
  documents: { step: 4, label: "Documents & messages", title: "Documents & messages" },
};

export function journeyStepBadge(status: JourneyStepStatus): {
  label: string;
  className: string;
} {
  switch (status) {
    case "done":
      return {
        label: "Complete",
        className: "bg-emerald-500/10 text-emerald-700 border-emerald-200/80",
      };
    case "active":
      return {
        label: "Your turn",
        className: "bg-primary/10 text-primary border-primary/25",
      };
    case "waiting":
      return {
        label: "With consultant",
        className: "bg-amber-500/10 text-amber-800 border-amber-200/80",
      };
    default:
      return {
        label: "Not yet",
        className: "bg-muted text-muted-foreground border-transparent",
      };
  }
}

export function journeyCurrentStepNumber(
  steps: JourneyStep[],
  currentStepId: JourneyStepId,
): number {
  return steps.find((s) => s.id === currentStepId)?.number ?? 1;
}

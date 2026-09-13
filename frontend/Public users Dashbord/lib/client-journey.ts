import type { ClientQuestionnaireStats } from "@/lib/client-questionnaire-stats";
import { workflowLabel } from "@/lib/case-workflow-labels";

export interface ClientCaseFile {
  id: number;
  status: string;
  immigration_pathway: string | null;
  agreement_token: string | null;
  agreement_sent_at: string | null;
  agreement_signed_at: string | null;
  application_forms_verified_at: string | null;
  ready_for_client_review_at?: string | null;
  client_acknowledged_at?: string | null;
  client_declaration_signed_at?: string | null;
  ready_to_submit_at?: string | null;
  submitted_at?: string | null;
  decision_status?: string | null;
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

export type JourneyStepId = "questionnaire" | "retainer" | "extra_details" | "forms" | "documents" | "final_review" | "government_requests";

export type ClientAssignmentSummary = {
  extra_fields?: {
    ask?: { key: string; label: string; status?: string }[];
    reused?: { key: string; label?: string; value?: string | null }[];
  };
  forms?: { code: string; name?: string; kind?: string }[];
  documents?: { id: string; label: string; reuse_candidate?: unknown }[];
  tracks?: {
    extra_data?: { unlocked?: boolean; parallel?: boolean };
    forms?: { unlocked?: boolean; parallel?: boolean };
    documents?: { unlocked?: boolean; parallel?: boolean };
  };
  pathway?: string | null;
} | null;

export type JourneyStepStatus = "done" | "active" | "waiting" | "locked";

export interface JourneyStep {
  id: JourneyStepId;
  number: number;
  title: string;
  navLabel: string;
  /** One-line blurb under the overview stepper icon */
  shortBlurb: string;
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
  assignment?: ClientAssignmentSummary,
): {
  steps: JourneyStep[];
  displayStages: ClientDisplayStage[];
  currentStepId: JourneyStepId;
  progressPercent: number;
  meta: ClientJourneyMeta;
} {
  const pathwaySet = Boolean(caseFile?.immigration_pathway);
  const agreementSigned = Boolean(caseFile?.agreement_signed_at);
  const agreementSent = Boolean(caseFile?.agreement_sent_at);
  const docsUnlocked =
    caseManagementUnlocked(caseFile, verification)
    || Boolean(assignment?.tracks?.documents?.unlocked);
  const extraUnlocked = Boolean(assignment?.tracks?.extra_data?.unlocked) || pathwaySet;
  const missingExtra = assignment?.extra_fields?.ask?.length ?? 0;
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

  let extraStatus: JourneyStepStatus = "locked";
  if (!pathwaySet) extraStatus = "locked";
  else if (missingExtra === 0 && extraUnlocked) extraStatus = "done";
  else if (extraUnlocked) extraStatus = "active";
  else extraStatus = "waiting";

  let formsStatus: JourneyStepStatus = "locked";
  if (!agreementSigned) formsStatus = "locked";
  else if (docsUnlocked || formsReviewed || !hasForms) formsStatus = "done";
  else if (hasForms) formsStatus = allFormsSubmitted ? "waiting" : "active";

  let documentsStatus: JourneyStepStatus = "locked";
  if (caseFile?.ready_for_client_review_at || caseFile?.submitted_at) documentsStatus = "done";
  else if (docsUnlocked) documentsStatus = "active";
  else if (agreementSigned) documentsStatus = "waiting";

  let finalReviewStatus: JourneyStepStatus = "locked";
  if (caseFile?.submitted_at || caseFile?.client_acknowledged_at) finalReviewStatus = "done";
  else if (caseFile?.ready_for_client_review_at) finalReviewStatus = "active";
  else if (docsUnlocked || agreementSigned) finalReviewStatus = "waiting";

  let governmentRequestsStatus: JourneyStepStatus = "locked";
  if (caseFile?.decision_status) governmentRequestsStatus = "done";
  else if (caseFile?.submitted_at) governmentRequestsStatus = "active";
  else if (caseFile?.ready_for_client_review_at || caseFile?.client_acknowledged_at) governmentRequestsStatus = "waiting";

  const steps: JourneyStep[] = [
    {
      id: "questionnaire",
      number: 1,
      title: pendingRefills > 0 ? "Fix questionnaire corrections" : "Complete your profile",
      navLabel: "Your profile",
      shortBlurb: "Tell us about yourself and your case.",
      description: pendingRefills > 0
        ? `Your consultant flagged ${pendingRefills} item${pendingRefills === 1 ? "" : "s"} to update.`
        : "Let us know about your background, goals, and details so your consultant can assess your case accurately.",
      href: "/user-dashboard/questionnaire",
      status: questionnaireStatus,
      actionLabel: pendingRefills > 0 ? "Fix corrections" : qStats.isSubmitted ? "View questionnaire" : "Open questionnaire",
    },
    {
      id: "retainer",
      number: 2,
      title: "Sign agreement",
      navLabel: "Sign agreement",
      shortBlurb: "Review and sign your agreement.",
      description: "Review and e-sign your consultant agreement to officially start working together.",
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
      id: "extra_details",
      number: 3,
      title: "Extra details for your pathway",
      navLabel: "Extra details",
      shortBlurb: "Answer only the missing pathway questions.",
      description: missingExtra > 0
        ? `${missingExtra} extra question${missingExtra === 1 ? "" : "s"} for your pathway. Known profile answers are already reused.`
        : "Your consultant assigned pathway-specific questions. Known profile answers are reused automatically.",
      href: "/user-dashboard/extra-details",
      status: extraStatus,
      actionLabel: missingExtra > 0 ? "Add extra details" : "View extra details",
      lockedReason: pathwaySet
        ? undefined
        : "Available after your consultant selects a pathway.",
    },
    {
      id: "forms",
      number: 4,
      title: "Application forms",
      navLabel: "Application forms",
      shortBlurb: "Complete your IRCC forms.",
      description: hasForms
        ? "Fill and submit the IRCC forms assigned by your consultant. Questionnaire answers pre-fill fields when possible."
        : "No interactive forms for your package yet — continue to documents when unlocked.",
      href: "/user-dashboard/application-forms",
      status: formsStatus,
      actionLabel: hasForms
        ? (allFormsSubmitted ? "View forms" : "Continue forms")
        : "View forms",
      lockedReason: agreementSigned ? undefined : "Unlocks after you sign the retainer agreement.",
    },
    {
      id: "documents",
      number: 5,
      title: "Documents",
      navLabel: "Documents",
      shortBlurb: "Upload supporting documents.",
      description: "Upload the documents your consultant needs, then we review your file and share clear next steps.",
      href: "/user-dashboard/case-management",
      status: documentsStatus,
      actionLabel: "Open documents",
      lockedReason: docsUnlocked
        ? undefined
        : agreementSigned
          ? "Your document checklist is ready and can progress in parallel with forms."
          : "Unlocks after you sign the retainer agreement, in parallel with forms.",
    },
    {
      id: "final_review",
      number: 6,
      title: "Final package review",
      navLabel: "Final review",
      shortBlurb: "Acknowledge the assembled application.",
      description: caseFile?.ready_for_client_review_at
        ? "Review the read-only package. Your acknowledgement is required before submission. Sign only if this application requires a declaration."
        : "Your consultant will send the assembled package here for your acknowledgement.",
      href: "/user-dashboard/final-review",
      status: finalReviewStatus,
      actionLabel: caseFile?.client_acknowledged_at ? "View acknowledgement" : "Review package",
      lockedReason: caseFile?.ready_for_client_review_at
        ? undefined
        : "Unlocks after your consultant marks the package ready for client review.",
    },
    {
      id: "government_requests",
      number: 7,
      title: "Government requests",
      navLabel: "Government requests",
      shortBlurb: "See due dates after submission.",
      description: caseFile?.submitted_at
        ? "Your consultant records government requests and due dates here. This is not an IRCC portal."
        : "After the application is submitted, government requests and due dates appear here.",
      href: "/user-dashboard/government-requests",
      status: governmentRequestsStatus,
      actionLabel: "View requests",
      lockedReason: caseFile?.submitted_at
        ? undefined
        : "Unlocks after your consultant records the government submission.",
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
    displayStages: buildClientDisplayStages(steps),
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

export type ClientDisplayStage = {
  id: string;
  title: string;
  status: JourneyStepStatus;
  href: string;
};

export function buildClientDisplayStages(steps: JourneyStep[]): ClientDisplayStage[] {
  const byId = Object.fromEntries(steps.map((step) => [step.id, step]));
  const rollup = (ids: JourneyStepId[], title: string, href: string): ClientDisplayStage => {
    const subset = ids.map((id) => byId[id]).filter(Boolean);
    let status: JourneyStepStatus = "locked";
    if (subset.some((step) => step.status === "active")) status = "active";
    else if (subset.length > 0 && subset.every((step) => step.status === "done")) status = "done";
    else if (subset.some((step) => step.status === "waiting")) status = "waiting";
    const open = subset.find((step) => step.status === "active") ?? subset.find((step) => step.status !== "locked");
    return { id: ids[0], title, status, href: open?.href ?? href };
  };

  return [
    rollup(["questionnaire"], "Profile & Assessment", "/user-dashboard/questionnaire"),
    rollup(["retainer", "extra_details"], "Agreement & Case Setup", "/user-dashboard/retainer-agreement"),
    rollup(["forms", "documents"], "Documents & Application", "/user-dashboard/case-management"),
    rollup(["final_review"], "Final Review & Submission", "/user-dashboard/final-review"),
    rollup(["government_requests"], "Government Processing / Decision", "/user-dashboard/government-requests"),
  ];
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
    case "extra_details":
      return Boolean(caseFile.immigration_pathway);
    case "forms":
      return Boolean(caseFile.agreement_signed_at);
    case "documents":
      return caseManagementUnlocked(caseFile, verification) || Boolean(caseFile.agreement_signed_at);
    case "final_review":
      return Boolean(caseFile.ready_for_client_review_at);
    case "government_requests":
      return Boolean(caseFile.submitted_at);
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
  assignment?: ClientAssignmentSummary,
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
      description: "Fill in your profile and questionnaire to help your consultant understand your case.",
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

  const missingExtraCount = assignment?.extra_fields?.ask?.length ?? 0;
  if (caseFile.immigration_pathway && missingExtraCount > 0 && !caseFile.agreement_signed_at) {
    return {
      tone: "primary",
      title: "Add extra details for your pathway",
      description: "Your consultant only needs the missing pathway questions. Profile answers already on file are reused.",
      href: "/user-dashboard/extra-details",
      buttonLabel: "Add extra details",
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

  if (caseFile.agreement_signed_at && missingExtraCount > 0) {
    return {
      tone: "primary",
      title: "Add extra details for your pathway",
      description: "Forms and documents can progress in parallel. Finish the missing pathway questions when you can.",
      href: "/user-dashboard/extra-details",
      buttonLabel: "Add extra details",
    };
  }

  if (hasForms && verification && verification.all_submitted && !verification.all_reviewed) {
    return {
      tone: "info",
      title: "Forms under consultant review",
      description: "All forms are submitted. Documents can continue in parallel while your consultant reviews forms.",
      href: "/user-dashboard/application-forms",
      buttonLabel: "View forms",
    };
  }

  if (caseFile.ready_for_client_review_at && !caseFile.client_acknowledged_at && !caseFile.submitted_at) {
    return {
      tone: "primary",
      title: "Review your final package",
      description: "Your consultant assembled the application. Acknowledge it here. They cannot sign for you.",
      href: "/user-dashboard/final-review",
      buttonLabel: "Review package",
    };
  }

  if (caseFile.submitted_at) {
    return {
      tone: caseFile.decision_status ? "success" : "info",
      title: caseFile.decision_status ? "A decision is on file" : "Watch for government requests",
      description: caseFile.decision_status
        ? "Your consultant recorded a decision. Open this page for request history and next-step notes."
        : "Your application is submitted. Your consultant will record government requests and due dates here.",
      href: "/user-dashboard/government-requests",
      buttonLabel: "View government requests",
    };
  }

  if (caseManagementUnlocked(caseFile, verification)) {
    return {
      tone: "success",
      title: "Upload your case documents",
      description: "Your document checklist is open. Upload the files your consultant requested.",
      href: "/user-dashboard/case-management",
      buttonLabel: "Open documents",
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
  READY_TO_SUBMIT: "Ready to submit",
  SUBMITTED: "Submitted",
  CLIENT_REVIEW: "Client final review",
  CONSULTANT_FINAL_REVIEW: "Consultant final review",
  GOVERNMENT_PROCESSING: "Government processing",
  GOVERNMENT_REQUEST_RECEIVED: "Government request received",
  RESPONSE_IN_PROGRESS: "Response in progress",
  DECISION_RECEIVED: "Decision received",
  CASE_CLOSED: "Case closed",
};

export function clientStatusLabel(status: string): string {
  return CLIENT_STATUS_LABELS[status] ?? workflowLabel(status);
}

export const JOURNEY_STEP_PAGES: Record<JourneyStepId, { step: number; label: string; title: string }> = {
  questionnaire: { step: 1, label: "Your profile", title: "Complete your profile" },
  retainer: { step: 2, label: "Sign agreement", title: "Sign agreement" },
  extra_details: { step: 3, label: "Extra details", title: "Extra details for your pathway" },
  forms: { step: 4, label: "Application forms", title: "Application forms" },
  documents: { step: 5, label: "Documents", title: "Documents" },
  final_review: { step: 6, label: "Final review", title: "Final package review" },
  government_requests: { step: 7, label: "Government requests", title: "Government requests" },
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
        label: "Current step",
        className: "bg-primary/10 text-primary border-primary/25",
      };
    case "waiting":
      return {
        label: "Pending",
        className: "bg-muted text-muted-foreground border-transparent",
      };
    default:
      return {
        label: "Pending",
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

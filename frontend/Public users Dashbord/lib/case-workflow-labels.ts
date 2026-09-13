export const WORKFLOW_LABELS: Record<string, string> = {
  INITIAL_CONSULTATION: "Initial consultation",
  PROFILE_REVIEW: "Profile review",
  ELIGIBILITY_ASSESSMENT: "Eligibility assessment",
  PATHWAY_RECOMMENDED: "Pathway recommended",
  PATHWAY_SELECTED: "Pathway selected",
  RETAINER_PENDING: "Retainer pending",
  REPRESENTATIVE_AUTHORIZATION_PENDING: "Representative authorization",
  CASE_ACTIVE: "Case active",
  ADDITIONAL_DATA_COLLECTION: "Additional data collection",
  DOCUMENT_COLLECTION: "Document collection",
  DOCUMENT_REVIEW: "Document review",
  APPLICATION_PREPARATION: "Application preparation",
  CONSULTANT_FINAL_REVIEW: "Consultant final review",
  CLIENT_REVIEW: "Client final review",
  READY_TO_SUBMIT: "Ready to submit",
  SUBMITTED: "Submitted",
  GOVERNMENT_PROCESSING: "Government processing",
  GOVERNMENT_REQUEST_RECEIVED: "Government request received",
  RESPONSE_IN_PROGRESS: "Response in progress",
  DECISION_RECEIVED: "Decision received",
  CASE_CLOSED: "Case closed",
  PENDING_ASSESSMENT: "Eligibility assessment",
  AGREEMENT_SENT: "Retainer pending",
  AGREEMENT_SIGNED: "Case active",
  DOCUMENTS_UPLOADING: "Document collection",
  UNDER_REVIEW: "Document review",
  READY_FOR_SUBMISSION: "Ready to submit",
  APPLICATION_SUBMITTED: "Submitted",
};

export function workflowLabel(status?: string | null): string {
  if (!status) return "In progress";
  return WORKFLOW_LABELS[status] ?? status.replaceAll("_", " ").toLowerCase();
}

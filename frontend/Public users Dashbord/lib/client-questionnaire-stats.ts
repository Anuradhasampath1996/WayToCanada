export interface FieldRemark {
  remark: string;
  requested_at: string;
  status: "pending" | "resolved";
}

export interface ClientQuestionnaireSnapshot {
  is_submitted?: boolean;
  submitted_at?: string | null;
  field_remarks?: Record<string, FieldRemark> | null;
  main_data?: Record<string, unknown> | null;
}

export interface ClientQuestionnaireStats {
  hasSubmission: boolean;
  isSubmitted: boolean;
  submittedAt: string | null;
  pendingRefills: number;
  fieldRemarks: Record<string, FieldRemark>;
}

export function buildClientQuestionnaireStats(
  submission: ClientQuestionnaireSnapshot | null | undefined,
): ClientQuestionnaireStats {
  if (!submission) {
    return {
      hasSubmission: false,
      isSubmitted: false,
      submittedAt: null,
      pendingRefills: 0,
      fieldRemarks: {},
    };
  }

  const remarks = submission.field_remarks ?? {};
  const pendingRefills = Object.values(remarks).filter((r) => r.status === "pending").length;

  return {
    hasSubmission: true,
    isSubmitted: Boolean(submission.is_submitted),
    submittedAt: submission.submitted_at ?? null,
    pendingRefills,
    fieldRemarks: remarks,
  };
}

export function pendingRemarkKeys(remarks: Record<string, FieldRemark>): string[] {
  return Object.entries(remarks)
    .filter(([, r]) => r.status === "pending")
    .map(([k]) => k);
}

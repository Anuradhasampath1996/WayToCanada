export interface FieldRemark {
  remark: string;
  requested_at: string;
  status: "pending" | "resolved";
}

export interface QuestionnaireSubmissionSnapshot {
  is_submitted?: boolean;
  submitted_at?: string | null;
  verified_fields?: Record<string, boolean> | null;
  field_remarks?: Record<string, FieldRemark> | null;
  main_data?: Record<string, unknown> | null;
}

export interface QuestionnaireWorkspaceStats {
  hasSubmission: boolean;
  isSubmitted: boolean;
  submittedAt: string | null;
  verifiedCount: number;
  pendingRefills: number;
  hasMainProfile: boolean;
}

export function buildQuestionnaireStats(
  submission: QuestionnaireSubmissionSnapshot | null | undefined,
): QuestionnaireWorkspaceStats {
  if (!submission) {
    return {
      hasSubmission: false,
      isSubmitted: false,
      submittedAt: null,
      verifiedCount: 0,
      pendingRefills: 0,
      hasMainProfile: false,
    };
  }

  const remarks = submission.field_remarks ?? {};
  const pendingRefills = Object.values(remarks).filter((r) => r.status === "pending").length;

  return {
    hasSubmission: true,
    isSubmitted: Boolean(submission.is_submitted),
    submittedAt: submission.submitted_at ?? null,
    verifiedCount: Object.keys(submission.verified_fields ?? {}).length,
    pendingRefills,
    hasMainProfile: Boolean(submission.main_data && Object.keys(submission.main_data).length > 0),
  };
}

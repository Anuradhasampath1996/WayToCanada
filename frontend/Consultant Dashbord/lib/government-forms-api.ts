const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

export type GovernmentFormMissingField = {
  key: string;
  label: string;
  source_section: string;
  responsible_party: string;
  redirect_hint: string | null;
};

export type GovernmentFormGeneration = {
  id: number;
  form_code: string | null;
  version_label: string | null;
  generated_at: string | null;
  generation_status: string | null;
  review_status: string | null;
  source_data_hash: string | null;
  output_sha256: string | null;
  supersedes_id: number | null;
  is_stale: boolean;
};

export type GovernmentFormOverflowWarning = {
  section: string;
  count: number;
  capacity: number;
  label: string;
  message: string;
};

export type GovernmentFormReadiness = {
  percentage: number;
  ready: boolean;
  missing_fields: GovernmentFormMissingField[];
  overflow_warnings?: GovernmentFormOverflowWarning[];
  blocked_by_overflow?: boolean;
};

export type GovernmentFormFillCoverage = {
  mapped_total: number;
  mapped_filled: number;
  percentage: number;
  unanswered_fields: Array<{
    key: string;
    label: string;
    questionnaire_key: string | null;
    responsible_party: string;
    can_request: boolean;
    can_fill: boolean;
  }>;
};

export type GovernmentFormItem = {
  form_code: string;
  name: string;
  version_label: string;
  readiness: GovernmentFormReadiness;
  fill_coverage?: GovernmentFormFillCoverage;
  current_generation: GovernmentFormGeneration | null;
};

export type FieldRemark = {
  remark: string;
  requested_at: string;
  status: string;
  form_code?: string;
  form_codes?: string[];
  canonical_key?: string;
};

export type PathwayFormReference = {
  code: string;
  name: string;
  normalized: string;
  fillable: boolean;
};

export type GovernmentFormsIndexResponse = {
  application_info_reviewed: boolean;
  application_info_stale: boolean;
  reviewed_at: string | null;
  field_remarks?: Record<string, FieldRemark>;
  forms: GovernmentFormItem[];
  pathway_forms?: PathwayFormReference[];
};

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("wtc_consultant_token");
}

export function authHeaders(json = false): Record<string, string> {
  const token = getToken();
  return {
    Accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function pdfAuthHeaders(): Record<string, string> {
  const token = getToken();
  return {
    Accept: "application/pdf,*/*",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function parseJson<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) {
    throw new Error((json as { message?: string }).message ?? "Request failed.");
  }
  return json as T;
}

export function governmentFormsDownloadUrl(
  profileId: string,
  submissionId: number,
  download = true,
  options?: { flattened?: boolean },
): string {
  const params = new URLSearchParams();
  if (download) params.set("download", "1");
  if (options?.flattened) params.set("flattened", "1");
  const q = params.toString() ? `?${params.toString()}` : "";
  return `${API}/consultant/clients/${profileId}/government-forms/generations/${submissionId}/download${q}`;
}

export type GovernmentFormResolvedField = {
  key: string;
  label: string;
  value: string | null;
  filled: boolean;
};

export type GovernmentFormResolvedDataResponse = {
  form_code: string;
  fields: GovernmentFormResolvedField[];
};

export function governmentFormsResolvedDataUrl(profileId: string, formCode: string): string {
  return `${API}/consultant/clients/${profileId}/government-forms/${formCode}/resolved-data`;
}

export async function fetchGovernmentFormResolvedData(
  profileId: string,
  formCode: string,
): Promise<GovernmentFormResolvedDataResponse> {
  const res = await fetch(governmentFormsResolvedDataUrl(profileId, formCode), {
    headers: authHeaders(),
  });
  return parseJson(res);
}

export function governmentFormsTemplatePreviewUrl(profileId: string, formCode: string, download = false): string {
  const q = download ? "?download=1" : "";
  return `${API}/consultant/clients/${profileId}/government-forms/${formCode}/template-preview${q}`;
}

export async function fetchGovernmentForms(profileId: string): Promise<GovernmentFormsIndexResponse> {
  const res = await fetch(`${API}/consultant/clients/${profileId}/government-forms`, {
    headers: authHeaders(),
  });
  return parseJson(res);
}

export async function reviewApplicationInfo(profileId: string): Promise<{
  application_info_reviewed: boolean;
  reviewed_at: string | null;
}> {
  const res = await fetch(`${API}/consultant/clients/${profileId}/government-forms/application-info/review`, {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify({}),
  });
  return parseJson(res);
}

export async function generateGovernmentForm(
  profileId: string,
  formCode: string,
): Promise<{
  submission: GovernmentFormGeneration;
  adobe_note?: string;
}> {
  const res = await fetch(`${API}/consultant/clients/${profileId}/government-forms/${formCode}/generate`, {
    method: "POST",
    headers: authHeaders(true),
    body: JSON.stringify({}),
  });
  return parseJson(res);
}

export async function markGovernmentFormReviewed(
  profileId: string,
  submissionId: number,
): Promise<{ submission: GovernmentFormGeneration }> {
  const res = await fetch(
    `${API}/consultant/clients/${profileId}/government-forms/generations/${submissionId}/mark-reviewed`,
    { method: "POST", headers: authHeaders(true), body: JSON.stringify({}) },
  );
  return parseJson(res);
}

export async function downloadGovernmentFormPdf(
  profileId: string,
  submissionId: number,
  filename: string,
): Promise<void> {
  const res = await fetch(governmentFormsDownloadUrl(profileId, submissionId, true), {
    headers: pdfAuthHeaders(),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error((json as { message?: string }).message ?? "Download failed.");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Ask client to fill/correct a questionnaire field (shows in client dashboard). */
export async function requestQuestionnaireRefill(
  profileId: string,
  fieldKey: string,
  remark: string,
): Promise<{ field_remarks: Record<string, FieldRemark> }> {
  const res = await fetch(`${API}/consultant/clients/${profileId}/questionnaire/request-refill`, {
    method: "PATCH",
    headers: authHeaders(true),
    body: JSON.stringify({ field_key: fieldKey, remark }),
  });
  return parseJson(res);
}

/** Request all unanswered mapped autofill fields for a form from the client. */
export async function requestUnansweredGovernmentFormFields(
  profileId: string,
  formCode: string,
  remark?: string,
): Promise<{
  message: string;
  requested_count: number;
  field_remarks: Record<string, FieldRemark>;
  fill_coverage: GovernmentFormFillCoverage;
}> {
  const res = await fetch(
    `${API}/consultant/clients/${profileId}/government-forms/${formCode}/request-unanswered`,
    {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify(remark ? { remark } : {}),
    },
  );
  return parseJson(res);
}

/** Request unanswered mapped fields across all fillable pathway forms (deduped). */
export async function requestAllUnansweredGovernmentFormFields(
  profileId: string,
  remark?: string,
): Promise<{
  message: string;
  requested_count: number;
  field_remarks: Record<string, FieldRemark>;
  forms: { form_code: string; fill_coverage: GovernmentFormFillCoverage }[];
  pathway_forms?: PathwayFormReference[];
}> {
  const res = await fetch(
    `${API}/consultant/clients/${profileId}/government-forms/request-unanswered`,
    {
      method: "POST",
      headers: authHeaders(true),
      body: JSON.stringify(remark ? { remark } : {}),
    },
  );
  return parseJson(res);
}

export async function fillGovernmentFormGapField(
  profileId: string,
  canonicalKey: string,
  value: string,
): Promise<{
  message: string;
  application_info_stale: boolean;
  field_remarks: Record<string, FieldRemark>;
  forms: { form_code: string; readiness: GovernmentFormReadiness }[];
}> {
  const res = await fetch(`${API}/consultant/clients/${profileId}/government-forms/gap-fields`, {
    method: "PATCH",
    headers: authHeaders(true),
    body: JSON.stringify({ canonical_key: canonicalKey, value }),
  });
  return parseJson(res);
}

export async function fetchQuestionnaireSubmission(profileId: string): Promise<{
  submission: Record<string, unknown> | null;
}> {
  const res = await fetch(`${API}/consultant/clients/${profileId}/questionnaire`, {
    headers: authHeaders(),
  });
  return parseJson(res);
}

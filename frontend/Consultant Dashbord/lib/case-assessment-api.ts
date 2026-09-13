const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

export type AssessmentField = { key: string; label: string; present: boolean };

export type AssessmentReadiness = {
  consultation: {
    completed_at: string | null;
    skipped_at: string | null;
    skip_reason: string | null;
    notes: string | null;
    satisfied: boolean;
  };
  profile_review: {
    reviewed_at: string | null;
    can_review: boolean;
    required_fields: AssessmentField[];
    missing_fields: AssessmentField[];
  };
  maple_recommendation: Record<string, unknown> | null;
  maple_recommended_at: string | null;
  can_select_pathway: boolean;
  can_open_assessment: boolean;
  blockers: string[];
};

export type CalculatorRouting = {
  family: string | null;
  registry_key: string;
  mode: "express_entry" | "checklist" | string;
  calculators: string[];
  checklist: { id: string; label: string }[];
};

function headers(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchAssessment(profileId: string, token: string, family?: string) {
  const qs = family ? `?family=${encodeURIComponent(family)}` : "";
  const res = await fetch(`${API}/consultant/clients/${profileId}/case-file/assessment${qs}`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error("Could not load assessment readiness.");
  return res.json() as Promise<{ assessment: AssessmentReadiness; calculator: CalculatorRouting }>;
}

export async function completeConsultation(profileId: string, token: string, notes?: string) {
  const res = await fetch(`${API}/consultant/clients/${profileId}/case-file/consultation/complete`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ notes }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || "Could not record consultation.");
  return json as { assessment: AssessmentReadiness; message: string };
}

export async function skipConsultation(profileId: string, token: string, reason: string) {
  const res = await fetch(`${API}/consultant/clients/${profileId}/case-file/consultation/skip`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ reason }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || "Could not skip consultation.");
  return json as { assessment: AssessmentReadiness; message: string };
}

export async function reviewProfile(profileId: string, token: string) {
  const res = await fetch(`${API}/consultant/clients/${profileId}/case-file/profile-review`, {
    method: "POST",
    headers: headers(token),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || "Could not mark profile reviewed.");
  return json as { assessment: AssessmentReadiness; message: string };
}

export async function generateMapleRecommendation(profileId: string, token: string) {
  const res = await fetch(`${API}/consultant/clients/${profileId}/case-file/maple-recommendation`, {
    method: "POST",
    headers: headers(token),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message || "Could not generate Maple recommendation.");
  return json as {
    maple_recommendation: Record<string, unknown>;
    pathway_auto_selected: false;
    message: string;
  };
}

export function consultantAuthToken(): string {
  if (typeof document === "undefined") return "";
  return (
    document.cookie.match(/wtc_consultant_token=([^;]+)/)?.[1] ??
    localStorage.getItem("wtc_consultant_token") ??
    ""
  );
}

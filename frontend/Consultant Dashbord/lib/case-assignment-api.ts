const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

export type AssignmentField = {
  key: string;
  label: string;
  value?: string | null;
  status?: string;
};

export type AssignmentDocument = {
  id: string;
  label: string;
  category?: string;
  status?: string;
  reuse_candidate?: { label?: string; original_filename?: string; source?: string } | null;
};

export type AssignmentForm = {
  code: string;
  name?: string;
  kind?: string;
  status?: string;
};

export type CaseAssignment = {
  pathway?: string | null;
  registry_key?: string | null;
  plan_version?: number | null;
  extra_fields: {
    ask: AssignmentField[];
    reused: AssignmentField[];
    all?: AssignmentField[];
  };
  forms: AssignmentForm[];
  documents: AssignmentDocument[];
  tracks?: {
    extra_data?: { unlocked?: boolean; parallel?: boolean };
    forms?: { unlocked?: boolean; parallel?: boolean };
    documents?: { unlocked?: boolean; parallel?: boolean };
  };
};

function headers(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function fetchAssignment(profileId: string, token: string): Promise<CaseAssignment> {
  const res = await fetch(`${API}/consultant/clients/${profileId}/case-file/assignment`, {
    headers: headers(token),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message ?? "Failed to load assignment.");
  return json.assignment;
}

export async function saveConsultantExtraData(
  profileId: string,
  token: string,
  answers: Record<string, string>,
): Promise<CaseAssignment> {
  const res = await fetch(`${API}/consultant/clients/${profileId}/case-file/extra-data`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({ answers }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message ?? "Failed to save extra details.");
  return json.assignment;
}

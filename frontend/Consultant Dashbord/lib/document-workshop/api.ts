import type { WorkshopSourceDoc } from "./build-pdf";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("wtc_consultant_token");
}

export function workshopAuthHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}`, Accept: "application/json" } : { Accept: "application/json" };
}

export type WorkshopSourcesResponse = {
  client: { id: number; name: string | null; email: string | null };
  case_file_id: number | null;
  documents: WorkshopSourceDoc[];
};

export type WorkshopSavedDocument = {
  id: number;
  document_type: string;
  document_label: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  status: string;
  stream_url: string;
};

/** Rewrite absolute backend stream URLs to use NEXT_PUBLIC_API_URL when needed. */
export function resolveStreamUrl(streamUrl: string, profileId: string | number, submissionId: number): string {
  if (streamUrl.startsWith("http")) {
    try {
      const u = new URL(streamUrl);
      return `${API}/consultant/clients/${profileId}/documents/${submissionId}/stream${u.search}`;
    } catch {
      /* fall through */
    }
  }
  return `${API}/consultant/clients/${profileId}/documents/${submissionId}/stream`;
}

export async function fetchWorkshopSources(profileId: string | number): Promise<WorkshopSourcesResponse> {
  const res = await fetch(`${API}/consultant/clients/${profileId}/document-workshop/sources`, {
    headers: workshopAuthHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Failed to load workshop sources (${res.status})`);
  }
  const data = (await res.json()) as WorkshopSourcesResponse;
  data.documents = (data.documents ?? []).map((d) => ({
    ...d,
    stream_url: resolveStreamUrl(d.stream_url, profileId, d.id),
  }));
  return data;
}

export async function saveWorkshopPdf(
  profileId: string | number,
  file: Blob,
  documentName: string,
  description?: string,
): Promise<WorkshopSavedDocument> {
  const form = new FormData();
  form.append("file", file, `${documentName.replace(/[^\w\-]+/g, "_") || "workshop"}.pdf`);
  form.append("document_name", documentName);
  if (description?.trim()) form.append("description", description.trim());

  const token = getToken();
  const res = await fetch(`${API}/consultant/clients/${profileId}/document-workshop/save`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}`, Accept: "application/json" } : { Accept: "application/json" },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Save failed (${res.status})`);
  }
  const data = await res.json();
  return data.document as WorkshopSavedDocument;
}

export type WorkshopDraftPageMeta = {
  id: string;
  sourceId: number;
  sourceLabel: string;
  sourcePageIndex: number;
  rotation: 0 | 90 | 180 | 270;
  kind: "pdf" | "image";
};

export type WorkshopDraft = {
  step: number;
  name: string;
  description: string;
  selectedSourceIds: number[];
  /** Page order + rotation without binary payloads (re-hydrated from sources on load). */
  pages: WorkshopDraftPageMeta[];
  pageNumbers: boolean;
  updatedAt: string;
};

const key = (profileId: string | number) => `wtc_document_workshop_draft_${profileId}`;

export function loadWorkshopDraft(profileId: string | number): WorkshopDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key(profileId));
    if (!raw) return null;
    return JSON.parse(raw) as WorkshopDraft;
  } catch {
    return null;
  }
}

export function saveWorkshopDraft(profileId: string | number, draft: WorkshopDraft): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key(profileId), JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }));
  } catch {
    /* quota */
  }
}

export function clearWorkshopDraft(profileId: string | number): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(key(profileId));
}

export type WorkshopDraftPageMeta = {
  id: string;
  sourceKey: string;
  sourceId: number;
  sourceKind: "case_document" | "package_submission";
  sourceLabel: string;
  sourcePageIndex: number;
  rotation: 0 | 90 | 180 | 270;
  kind: "pdf" | "image";
};

export type WorkshopDraft = {
  step: number;
  name: string;
  description: string;
  /** Composite keys: `${source_kind}:${id}` */
  selectedSourceIds: string[];
  /** Page order + rotate without binary payloads (re-hydrated from sources on load). */
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
    const draft = JSON.parse(raw) as WorkshopDraft;
    // Migrate legacy numeric selectedSourceIds → case_document keys
    draft.selectedSourceIds = (draft.selectedSourceIds ?? []).map((id) =>
      typeof id === "number" || /^\d+$/.test(String(id))
        ? `case_document:${id}`
        : String(id),
    );
    draft.pages = (draft.pages ?? []).map((p) => ({
      ...p,
      sourceKind: p.sourceKind ?? "case_document",
      sourceKey: p.sourceKey ?? `case_document:${p.sourceId}`,
    }));
    return draft;
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

import type { GovernmentFormGeneration } from "./government-forms-api";

export type GenerationDisplayStatus =
  | "ready"
  | "generating"
  | "generated"
  | "needs_review"
  | "reviewed"
  | "superseded"
  | "stale"
  | "error";

export function resolveGenerationDisplayStatus(
  generation: GovernmentFormGeneration | null,
  isGenerating: boolean,
  hasError: boolean,
): GenerationDisplayStatus | null {
  if (isGenerating) return "generating";
  if (hasError) return "error";
  if (!generation) return null;

  if (generation.is_stale) return "stale";
  if (generation.generation_status === "SUPERSEDED") return "superseded";
  if (generation.review_status === "reviewed" || generation.generation_status === "REVIEWED") return "reviewed";
  if (
    generation.review_status === "needs_review"
    || generation.generation_status === "NEEDS_REVIEW"
    || generation.generation_status === "GENERATED"
  ) {
    return "needs_review";
  }
  if (generation.generation_status === "GENERATED") return "generated";

  return "generated";
}

export const GENERATION_STATUS_LABELS: Record<GenerationDisplayStatus, string> = {
  ready: "Ready to Generate",
  generating: "Generating…",
  generated: "Generated",
  needs_review: "Needs Review",
  reviewed: "Reviewed",
  superseded: "Superseded",
  stale: "Outdated",
  error: "Error",
};

export function mapRedirectHint(profileId: string, hint: string | null): string | null {
  if (!hint) return null;
  if (hint.startsWith("/questionnaire")) {
    return `/dashboard/clients/${profileId}/workspace/questionnaire-review`;
  }
  if (hint === "/consultant/profile") {
    return "/dashboard/account";
  }
  return hint;
}

export function formatGeneratedDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

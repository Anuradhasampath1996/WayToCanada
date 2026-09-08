import { describe, expect, it } from "vitest";
import {
  formatGeneratedDate,
  mapRedirectHint,
  resolveGenerationDisplayStatus,
} from "../government-forms-ui";
import type { GovernmentFormGeneration } from "../government-forms-api";

const baseGeneration: GovernmentFormGeneration = {
  id: 1,
  form_code: "IMM5476",
  version_label: "11-2025",
  generated_at: "2026-09-01T12:00:00Z",
  generation_status: "GENERATED",
  review_status: "needs_review",
  source_data_hash: "abc",
  output_sha256: "def",
  supersedes_id: null,
  is_stale: false,
};

describe("resolveGenerationDisplayStatus", () => {
  it("returns generating while in flight", () => {
    expect(resolveGenerationDisplayStatus(null, true, false)).toBe("generating");
  });

  it("returns error when generation failed", () => {
    expect(resolveGenerationDisplayStatus(null, false, true)).toBe("error");
  });

  it("returns stale when backend marks generation stale", () => {
    expect(
      resolveGenerationDisplayStatus({ ...baseGeneration, is_stale: true }, false, false),
    ).toBe("stale");
  });

  it("returns needs_review for generated submission awaiting review", () => {
    expect(resolveGenerationDisplayStatus(baseGeneration, false, false)).toBe("needs_review");
  });

  it("returns reviewed after consultant marks reviewed", () => {
    expect(
      resolveGenerationDisplayStatus(
        { ...baseGeneration, review_status: "reviewed", generation_status: "REVIEWED" },
        false,
        false,
      ),
    ).toBe("reviewed");
  });
});

describe("mapRedirectHint", () => {
  it("maps questionnaire hints to workspace review route", () => {
    expect(mapRedirectHint("12", "/questionnaire/main")).toBe(
      "/dashboard/clients/12/workspace/questionnaire-review",
    );
  });

  it("maps consultant profile hint to account settings", () => {
    expect(mapRedirectHint("12", "/consultant/profile")).toBe("/dashboard/account");
  });
});

describe("formatGeneratedDate", () => {
  it("formats ISO timestamps for display", () => {
    expect(formatGeneratedDate("2026-09-01T12:00:00Z")).toMatch(/Sep/);
  });
});

import { describe, expect, it } from "vitest";
import {
  aggregateReadiness,
  canFillGapField,
  canRequestFromClient,
  computeWorkflowSteps,
  gapFieldFillSpec,
  mapCanonicalToQuestionnaireField,
} from "../government-forms-workflow";
import type { GovernmentFormsIndexResponse } from "../government-forms-api";

const baseForm = {
  form_code: "IMM5476",
  name: "Use of a Representative",
  version_label: "11-2025",
  readiness: {
    percentage: 60,
    ready: false,
    missing_fields: [
      {
        key: "applicant.personal.family_name",
        label: "Applicant family name",
        source_section: "questionnaire_main",
        responsible_party: "client",
        redirect_hint: "/questionnaire/main",
      },
      {
        key: "representative.rcic_number",
        label: "RCIC licence number",
        source_section: "consultant_profile",
        responsible_party: "consultant",
        redirect_hint: "/consultant/profile",
      },
    ],
  },
  current_generation: null,
};

describe("government-forms-workflow", () => {
  it("maps canonical keys to questionnaire remark keys", () => {
    expect(mapCanonicalToQuestionnaireField("applicant.personal.date_of_birth")).toBe("main_data.dob");
    expect(mapCanonicalToQuestionnaireField("applicant.personal.uci")).toBe("main_data.uci");
    expect(mapCanonicalToQuestionnaireField("applicant.application.type")).toBe(
      "main_data.imm5476ApplicationType",
    );
    expect(mapCanonicalToQuestionnaireField("applicant.family.spouse.contact.email")).toBe(
      "spouse_data.email",
    );
    expect(mapCanonicalToQuestionnaireField("overflow.children")).toBeNull();
  });

  it("detects client-requestable fields", () => {
    expect(canRequestFromClient(baseForm.readiness.missing_fields[0])).toBe(true);
    expect(canRequestFromClient(baseForm.readiness.missing_fields[1])).toBe(false);
  });

  it("detects fillable gap fields", () => {
    expect(canFillGapField(baseForm.readiness.missing_fields[0])).toBe(true);
    expect(canFillGapField(baseForm.readiness.missing_fields[1])).toBe(true);
  });

  it("allows answering IMM5476 UCI and representative street number", () => {
    expect(gapFieldFillSpec("applicant.personal.uci")?.fillable).toBe(true);
    expect(gapFieldFillSpec("representative.address.street_number")?.fillable).toBe(true);
    expect(gapFieldFillSpec("representative.address.city")?.fillable).toBe(true);
  });

  it("aggregates readiness across forms", () => {
    const agg = aggregateReadiness([baseForm]);
    expect(agg.averagePercentage).toBe(60);
    expect(agg.totalMissing).toBe(2);
    expect(agg.clientMissing).toBe(1);
    expect(agg.consultantMissing).toBe(1);
  });

  it("computes workflow steps before review", () => {
    const data: GovernmentFormsIndexResponse = {
      application_info_reviewed: false,
      application_info_stale: false,
      reviewed_at: null,
      forms: [baseForm],
    };
    const steps = computeWorkflowSteps(data);
    expect(steps[0].id).toBe("review");
    expect(steps[0].status).toBe("active");
    expect(steps[1].status).toBe("pending");
  });
});

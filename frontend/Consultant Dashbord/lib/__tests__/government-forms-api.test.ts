import { describe, expect, it } from "vitest";
import { authHeaders, governmentFormsDownloadUrl, governmentFormsTemplatePreviewUrl, pdfAuthHeaders } from "../government-forms-api";

describe("governmentFormsDownloadUrl", () => {
  it("uses the secure authenticated backend download endpoint", () => {
    const url = governmentFormsDownloadUrl("42", 7, true);
    expect(url).toBe(
      "http://127.0.0.1:8000/api/v1/consultant/clients/42/government-forms/generations/7/download?download=1",
    );
    expect(url).not.toContain("storage/app");
    expect(url).not.toContain("private/");
  });

  it("supports inline preview without download flag", () => {
    const url = governmentFormsDownloadUrl("42", 7, false);
    expect(url).toBe(
      "http://127.0.0.1:8000/api/v1/consultant/clients/42/government-forms/generations/7/download",
    );
  });
});

describe("governmentFormsTemplatePreviewUrl", () => {
  it("uses the secure template preview endpoint", () => {
    const url = governmentFormsTemplatePreviewUrl("42", "IMM5476", false);
    expect(url).toBe(
      "http://127.0.0.1:8000/api/v1/consultant/clients/42/government-forms/IMM5476/template-preview",
    );
  });
});

describe("authHeaders", () => {
  it("includes bearer token from localStorage", () => {
    expect(authHeaders()).toMatchObject({
      Accept: "application/json",
      Authorization: "Bearer test-token",
    });
  });

  it("pdf headers accept pdf content type", () => {
    expect(pdfAuthHeaders()).toMatchObject({
      Accept: "application/pdf,*/*",
      Authorization: "Bearer test-token",
    });
  });
});

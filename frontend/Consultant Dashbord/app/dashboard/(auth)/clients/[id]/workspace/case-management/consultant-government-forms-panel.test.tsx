import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConsultantGovernmentFormsPanel } from "./consultant-government-forms-panel";
import * as api from "@/lib/government-forms-api";
import type { GovernmentFormsIndexResponse } from "@/lib/government-forms-api";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/pdf-viewer-dialog", () => ({
  PdfViewerDialog: () => null,
}));

vi.mock("@/components/government-form-filled-preview-dialog", () => ({
  GovernmentFormFilledPreviewDialog: () => null,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ open, children }: { open?: boolean; children: React.ReactNode }) =>
    open ? <div data-testid="dialog-root">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div role="dialog">{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

const unreviewedPayload: GovernmentFormsIndexResponse = {
  application_info_reviewed: false,
  application_info_stale: false,
  reviewed_at: null,
  forms: [
    {
      form_code: "IMM5476",
      name: "Use of a Representative",
      version_label: "11-2025",
      readiness: {
        percentage: 85,
        ready: false,
        missing_fields: [
          {
            key: "applicant.email",
            label: "Applicant email address",
            source_section: "main_applicant",
            responsible_party: "client",
            redirect_hint: "/questionnaire/main",
          },
        ],
      },
      current_generation: null,
    },
  ],
};

const readyPayload: GovernmentFormsIndexResponse = {
  application_info_reviewed: true,
  application_info_stale: false,
  reviewed_at: "2026-09-01T10:00:00Z",
  forms: [
    {
      ...unreviewedPayload.forms[0],
      readiness: { percentage: 100, ready: true, missing_fields: [] },
      current_generation: null,
    },
  ],
};

const generatedPayload: GovernmentFormsIndexResponse = {
  ...readyPayload,
  forms: [
    {
      ...readyPayload.forms[0],
      current_generation: {
        id: 3,
        form_code: "IMM5476",
        version_label: "11-2025",
        generated_at: "2026-09-01T12:00:00Z",
        generation_status: "GENERATED",
        review_status: "needs_review",
        source_data_hash: "hash",
        output_sha256: "sha",
        supersedes_id: null,
        is_stale: false,
      },
    },
  ],
};

describe("ConsultantGovernmentFormsPanel", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    document.body.removeAttribute("data-scroll-locked");
    document.body.style.pointerEvents = "";
  });

  it("renders the government forms section with IMM 5476 from API", async () => {
    vi.spyOn(api, "fetchGovernmentForms").mockResolvedValue(unreviewedPayload);

    render(<ConsultantGovernmentFormsPanel profileId="12" />);

    expect(await screen.findByText("IMM5476")).toBeInTheDocument();
    expect(screen.getByText("Use of a Representative")).toBeInTheDocument();
    expect(screen.getByText("Government Forms Journey")).toBeInTheDocument();
    expect(screen.getAllByText("85%").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Preview blank IMM5476 form/i })).toBeInTheDocument();
  });

  it("shows review gate when application info is not reviewed", async () => {
    vi.spyOn(api, "fetchGovernmentForms").mockResolvedValue(unreviewedPayload);

    render(<ConsultantGovernmentFormsPanel profileId="12" />);

    expect(
      await screen.findByText(/Step 1 — Review application information/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Review Application Information/i })).toBeInTheDocument();
  });

  it("calls review endpoint and refreshes after review", async () => {
    const fetchSpy = vi
      .spyOn(api, "fetchGovernmentForms")
      .mockResolvedValueOnce(unreviewedPayload)
      .mockResolvedValueOnce(readyPayload);
    const reviewSpy = vi.spyOn(api, "reviewApplicationInfo").mockResolvedValue({
      application_info_reviewed: true,
      reviewed_at: "2026-09-01T10:00:00Z",
    });
    const onToast = vi.fn();

    render(<ConsultantGovernmentFormsPanel profileId="12" onToast={onToast} />);
    const user = userEvent.setup();

    await screen.findByRole("button", { name: /Review Application Information/i });
    await user.click(screen.getByRole("button", { name: /Review Application Information/i }));

    await waitFor(() => {
      expect(reviewSpy).toHaveBeenCalledWith("12");
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    expect(await screen.findByText(/Application information reviewed/i)).toBeInTheDocument();
    expect(onToast).toHaveBeenCalledWith("Application information reviewed.", "success");
  });

  it("shows missing information in dialog", async () => {
    vi.spyOn(api, "fetchGovernmentForms").mockResolvedValue({
      ...readyPayload,
      forms: [unreviewedPayload.forms[0]],
    });

    render(<ConsultantGovernmentFormsPanel profileId="12" />);
    const user = userEvent.setup();

    await screen.findByRole("button", { name: /View Missing Information/i });
    await user.click(screen.getByRole("button", { name: /View Missing Information/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Missing Information")).toBeInTheDocument();
    expect(within(dialog).getByText("Applicant email address")).toBeInTheDocument();
  });

  it("does not show Generate when form is not ready", async () => {
    vi.spyOn(api, "fetchGovernmentForms").mockResolvedValue({
      ...readyPayload,
      forms: [unreviewedPayload.forms[0]],
    });

    render(<ConsultantGovernmentFormsPanel profileId="12" />);

    await screen.findByText(/Application information reviewed/i);
    expect(screen.queryByRole("button", { name: /Generate Form/i })).not.toBeInTheDocument();
  });

  it("generates form and shows latest generation metadata", async () => {
    vi.spyOn(api, "fetchGovernmentForms")
      .mockResolvedValueOnce(readyPayload)
      .mockResolvedValueOnce(generatedPayload);
    const generateSpy = vi.spyOn(api, "generateGovernmentForm").mockResolvedValue({
      submission: generatedPayload.forms[0].current_generation!,
    });

    render(<ConsultantGovernmentFormsPanel profileId="12" />);
    const user = userEvent.setup();

    const generateBtn = await screen.findByRole("button", { name: /Generate Form/i });
    await user.click(generateBtn);

    await waitFor(() => expect(generateSpy).toHaveBeenCalledWith("12", "IMM5476"));
    expect(await screen.findByText(/Latest generation/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Download generated form/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Preview filled IMM5476 form/i })).toBeInTheDocument();
  });

  it("prevents duplicate generate clicks while generating", async () => {
    vi.spyOn(api, "fetchGovernmentForms").mockResolvedValue(readyPayload);
    const generateSpy = vi.spyOn(api, "generateGovernmentForm").mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ submission: generatedPayload.forms[0].current_generation! }), 100)),
    );

    render(<ConsultantGovernmentFormsPanel profileId="12" />);
    const user = userEvent.setup();

    const generateBtn = await screen.findByRole("button", { name: /Generate Form/i });
    await user.click(generateBtn);
    await user.click(generateBtn);
    await waitFor(() => expect(generateSpy).toHaveBeenCalledTimes(1));
  });

  it("uses secure download helper for downloads", async () => {
    vi.spyOn(api, "fetchGovernmentForms").mockResolvedValue(generatedPayload);
    const downloadSpy = vi.spyOn(api, "downloadGovernmentFormPdf").mockResolvedValue();

    render(<ConsultantGovernmentFormsPanel profileId="12" />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /Download generated form/i }));

    expect(downloadSpy).toHaveBeenCalledWith("12", 3, "IMM5476-11-2025.pdf");
  });

  it("marks generation reviewed and refreshes", async () => {
    const fetchSpy = vi.spyOn(api, "fetchGovernmentForms").mockResolvedValueOnce(generatedPayload).mockResolvedValue({
      ...generatedPayload,
      forms: [
        {
          ...generatedPayload.forms[0],
          current_generation: {
            ...generatedPayload.forms[0].current_generation!,
            review_status: "reviewed",
            generation_status: "REVIEWED",
          },
        },
      ],
    });
    const markSpy = vi.spyOn(api, "markGovernmentFormReviewed").mockResolvedValue({
      submission: {
        ...generatedPayload.forms[0].current_generation!,
        review_status: "reviewed",
        generation_status: "REVIEWED",
      },
    });

    render(<ConsultantGovernmentFormsPanel profileId="12" />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /Mark form reviewed/i }));

    await waitFor(() => {
      expect(markSpy).toHaveBeenCalledWith("12", 3);
      expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("shows API error state with retry", async () => {
    vi.spyOn(api, "fetchGovernmentForms").mockRejectedValue(new Error("Unauthorized"));

    render(<ConsultantGovernmentFormsPanel profileId="12" />);

    expect(await screen.findByText("Unauthorized")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
  });

  it("shows stale generation warning when backend marks stale", async () => {
    vi.spyOn(api, "fetchGovernmentForms").mockResolvedValue({
      ...generatedPayload,
      application_info_stale: true,
      forms: [
        {
          ...generatedPayload.forms[0],
          current_generation: {
            ...generatedPayload.forms[0].current_generation!,
            is_stale: true,
          },
        },
      ],
    });

    render(<ConsultantGovernmentFormsPanel profileId="12" />);

    expect(
      await screen.findByText(/Client or application information has changed/i),
    ).toBeInTheDocument();
  });
});

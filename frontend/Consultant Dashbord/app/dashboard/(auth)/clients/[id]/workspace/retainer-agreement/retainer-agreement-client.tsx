"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, FileText, CheckCircle2, ChevronRight,
  Loader2, Send, AlertCircle, Edit3, Eye, DollarSign,
  Users, Briefcase, Award, Clock, Download, MessageCircle,
  BookmarkPlus, Trash2, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { WorkspaceBreadcrumb } from "../workspace-flow-ui";
import { RichTextEditorDemo } from "@/components/ui/custom/tiptap/rich-text-editor";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { RetainerAgreementDocument } from "@/components/retainer-agreement-document";
import {
  type AgreementConfig,
  type ClientAgreementDetails,
  type AgreementSectionKey,
  DEFAULT_AGREEMENT_CONFIG,
  extractClientAgreementDetails,
  formatAgreementCurrency,
  agreementTaxAmount,
  agreementTaxForAmount,
  agreementGrandTotal,
  milestoneAmounts,
  PATHWAY_TEMPLATES,
  resolvePathwayTemplate,
  resolveAgreementConfig,
} from "@/lib/retainer-agreement";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3 | 4;

interface ConsultantProfile {
  name: string;
  email: string;
  phone: string | null;
  rcic_number: string | null;
  company_name: string | null;
  company_logo: string | null;
  company_bio: string | null;
  company_website: string | null;
  company_phone: string | null;
  company_address_line1: string | null;
  company_address_line2: string | null;
  company_city: string | null;
  company_province: string | null;
  company_postal_code: string | null;
  company_country: string | null;
  digital_signature: string | null;
}

interface AgreementTemplate {
  id: number;
  name: string;
  pathway: string | null;
  config: Partial<AgreementConfig>;
  is_default: boolean;
}

interface TaxRateOption {
  code: string;
  name: string;
  label: string;
  total_pct: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined"
      ? (document.cookie.match(/wtc_consultant_token=([^;]+)/)?.[1] ??
         localStorage.getItem("wtc_consultant_token") ?? "")
      : "";
  const h: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

const STEPS = [
  { label: "Service Template", icon: Briefcase },
  { label: "Client Details",   icon: Users },
  { label: "Customize",        icon: Edit3 },
  { label: "Preview & Send",   icon: Send },
];

function WizardNav({ current }: { current: WizardStep }) {
  return (
    <div className="flex items-center gap-0 mb-8 overflow-x-auto pb-1">
      {STEPS.map((s, i) => {
        const stepNum = (i + 1) as WizardStep;
        const done    = stepNum < current;
        const active  = stepNum === current;
        const Icon    = s.icon;
        return (
          <div key={i} className="flex items-center gap-0 flex-1 min-w-0">
            <div className={cn(
              "flex flex-col items-center gap-1 px-2 py-2 rounded-xl flex-1 transition-colors",
              done   && "text-green-700",
              active && "text-primary",
              !done && !active && "text-muted-foreground/50"
            )}>
              <div className={cn(
                "flex h-9 w-9 items-center justify-center rounded-full border-2 shrink-0",
                done   && "bg-green-50 border-green-500",
                active && "bg-primary/10 border-primary",
                !done && !active && "bg-muted border-muted-foreground/20"
              )}>
                {done
                  ? <CheckCircle2 className="h-5 w-5 text-green-600" />
                  : <Icon className="h-4 w-4" />}
              </div>
              <span className="text-[11px] font-medium text-center leading-tight hidden sm:block">
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("h-0.5 w-6 shrink-0 mx-1 rounded", done ? "bg-green-400" : "bg-muted")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Input Helpers ────────────────────────────────────────────────────────────

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="text-xs font-medium text-foreground mb-1 block">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <input
      type="text" value={value} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    />
  );
}

function TextAreaInput({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    />
  );
}

function NumInput({ value, onChange, min, max, step = 1 }: {
  value: number; onChange: (v: number) => void; min: number; max: number; step?: number;
}) {
  return (
    <input
      type="number" value={value} min={min} max={max} step={step}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
    />
  );
}

function Textarea({ value, onChange, rows = 3, placeholder }: {
  value: string; onChange: (v: string) => void; rows?: number; placeholder?: string;
}) {
  return (
    <textarea
      value={value} rows={rows} placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
    />
  );
}

function isHtmlEmpty(html: string): boolean {
  return !html || html.replace(/<[^>]*>/g, "").trim() === "";
}

function detectTaxProvince(...values: Array<string | null | undefined>): string | null {
  const aliases: Record<string, string> = {
    alberta: "AB", "british columbia": "BC", manitoba: "MB", "new brunswick": "NB",
    "newfoundland and labrador": "NL", "nova scotia": "NS", ontario: "ON",
    "prince edward island": "PE", quebec: "QC", saskatchewan: "SK", yukon: "YT",
    "northwest territories": "NT", nunavut: "NU",
  };
  const text = values.filter(Boolean).join(" ").toLowerCase();
  for (const [name, code] of Object.entries(aliases)) {
    if (text.includes(name) || new RegExp(`\\b${code.toLowerCase()}\\b`).test(text)) return code;
  }
  return null;
}
const AGREEMENT_SECTION_LABELS: Record<AgreementSectionKey, string> = {
  parties: "Parties to this Agreement",
  scope: "Scope of Services",
  fees: "Professional Fees & Payment Milestones",
  governmentFees: "Government & Third-Party Fees",
  clientObligations: "Client Obligations",
  consultantObligations: "Consultant Obligations",
  outcome: "No Guarantee of Outcome",
  termination: "Termination",
  privacy: "Confidentiality & Privacy",
  refund: "Refund Policy",
  regulatory: "Regulatory Compliance & Dispute Resolution",
  general: "General Provisions",
  custom: "Additional Terms",
};

function agreementEditorText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .trim();
}

function agreementEditorHtml(value: string): string {
  return value
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
    .join("");
}

function sanitizeAgreementHtml(value: string): string {
  const allowed = new Set(["p", "br", "strong", "em", "u", "s", "ul", "ol", "li", "h1", "h2", "h3"]);
  return value.replace(/<\s*(\/?)\s*([a-z0-9]+)[^>]*>/gi, (tag, closing, name) => {
    const normalized = name.toLowerCase();
    return allowed.has(normalized) ? `<${closing}${normalized}>` : "";
  });
}


export function RetainerAgreementClient({ paramsPromise }: { paramsPromise: Promise<{ id: string }> }) {
  const { id } = use(paramsPromise);

  const [step, setStep]             = useState<WizardStep>(1);
  const [loading, setLoading]       = useState(true);
  const [sending, setSending]       = useState(false);
  const [sent, setSent]             = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [consultantProfile, setConsultantProfile] = useState<ConsultantProfile | null>(null);

  // Pre-loaded data
  const [clientName, setClientName]           = useState("");
  const [clientEmail, setClientEmail]         = useState("");
  const [clientDetails, setClientDetails]     = useState<ClientAgreementDetails>({});
  const [consultantName, setConsultantName]   = useState("");
  const [pathway, setPathway]                 = useState("");
  const [alreadySent, setAlreadySent]         = useState(false);
  const [alreadySentAt, setAlreadySentAt]     = useState<string | null>(null);
  const [alreadySigned, setAlreadySigned]     = useState(false);

  const [config, setConfig] = useState<AgreementConfig>(DEFAULT_AGREEMENT_CONFIG);
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([]);
  const [taxRatesLoading, setTaxRatesLoading] = useState(true);
  const [taxRatesError, setTaxRatesError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen]       = useState(false);
  const [milestonePayments, setMilestonePayments] = useState<Record<string, boolean>>({ "1": false, "2": false, "3": false });
  const [savingMilestones, setSavingMilestones] = useState(false);
  const [signedDocPath, setSignedDocPath]   = useState<string | null>(null);
  const [agreementSignedAt, setAgreementSignedAt] = useState<string | null>(null);
  const [agreementVersion, setAgreementVersion] = useState(1);
  const [templates, setTemplates] = useState<AgreementTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [mapleOpen, setMapleOpen] = useState(false);
  const [mapleInstructions, setMapleInstructions] = useState("");
  const [mapleFee, setMapleFee] = useState("");
  const [mapleCurrency, setMapleCurrency] = useState<AgreementConfig["currency"]>("CAD");
  const [maplePaymentRules, setMaplePaymentRules] = useState("");
  const [mapleRefundPolicy, setMapleRefundPolicy] = useState("");
  const [mapleNotes, setMapleNotes] = useState<string | null>(null);
  const [generatingAgreement, setGeneratingAgreement] = useState(false);
  const [editingSection, setEditingSection] = useState<AgreementSectionKey | null>(null);
  const [editingSectionText, setEditingSectionText] = useState("");
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderCount, setReminderCount] = useState(0);
  const [lastReminderAt, setLastReminderAt] = useState<string | null>(null);
  const set = <K extends keyof AgreementConfig>(k: K, v: AgreementConfig[K]) =>
    setConfig(prev => ({ ...prev, [k]: v }));

  const setClientDetail = <K extends keyof ClientAgreementDetails>(key: K, value: ClientAgreementDetails[K]) =>
    setClientDetails((prev) => ({ ...prev, [key]: value }));

  async function loadTemplates() {
    setTemplatesLoading(true);
    try {
      const res = await fetch(`${API}/consultant/agreement-templates`, { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json();
        setTemplates(json.templates ?? []);
      }
    } finally {
      setTemplatesLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetch(`${API}/tax/gst-hst/rates`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.message ?? "Unable to load synced tax rates.");
        if (active) setTaxRates(Array.isArray(json.rates) ? json.rates : []);
      })
      .catch((e) => {
        if (active) setTaxRatesError(e instanceof Error ? e.message : "Unable to load synced tax rates.");
      })
      .finally(() => {
        if (active) setTaxRatesLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const selected = taxRates.find(rate => rate.code === config.taxProvince);
    if (!selected) return;

    if (config.taxLabel !== selected.label || config.taxRate !== selected.total_pct) {
      setConfig(prev => ({
        ...prev,
        taxLabel: selected.label,
        taxRate: selected.total_pct,
      }));
    }
  }, [taxRates, config.taxProvince, config.taxLabel, config.taxRate]);

  // Load case file + client data + consultant profile
  useEffect(() => {
    void loadTemplates();
    Promise.all([
      fetch(`${API}/consultant/clients/${id}/case-file`, { headers: authHeaders() }).then(r => r.json()),
      fetch(`${API}/consultant/clients/${id}/questionnaire`, { headers: authHeaders() }).then(r => r.json()).catch(() => null),
      fetch(`${API}/consultant/profile`, { headers: authHeaders() }).then(r => r.ok ? r.json() : null).catch(() => null),
    ])
      .then(([cf, q, prof]) => {
        const caseFile   = cf.case_file;
        const client     = cf.client;
        const consultant = cf.consultant;

        if (client?.user) {
          setClientName(client.user.name ?? "");
          setClientEmail(client.user.email ?? "");
        }
        if (consultant?.name)        setConsultantName(consultant.name);
        if (consultant?.rcic_number) set("consultantLicenseNo", consultant.rcic_number);

        if (prof) {
          setConsultantProfile(prof as ConsultantProfile);
          if (prof.name)        setConsultantName(prof.name);
          if (prof.rcic_number) set("consultantLicenseNo", prof.rcic_number);
        }

        const pw = caseFile?.immigration_pathway ?? "";
        setPathway(pw);

        const tmpl = resolvePathwayTemplate(pw, caseFile?.pathway_code);
        if (tmpl) set("totalFee", tmpl.fee);

        if (caseFile?.agreement_config) {
          setConfig(prev => resolveAgreementConfig(caseFile.agreement_config, prev));
        } else {
          if (caseFile?.agreement_fee)   set("totalFee",      Number(caseFile.agreement_fee));
          if (caseFile?.agreement_notes) set("customClauses", caseFile.agreement_notes);
        }

        setAlreadySent(!!caseFile?.agreement_sent_at);
        setAlreadySentAt(caseFile?.agreement_sent_at ?? null);
        setAlreadySigned(!!caseFile?.agreement_signed_at || caseFile?.status === "AGREEMENT_SIGNED");
        setSignedDocPath(caseFile?.signed_document_path ?? null);
        setAgreementSignedAt(caseFile?.agreement_signed_at ?? null);
        setAgreementVersion(caseFile?.agreement_version ?? 1);
        setReminderCount(caseFile?.agreement_reminder_count ?? 0);
        setLastReminderAt(caseFile?.agreement_last_reminder_at ?? null);
        if (caseFile?.agreement_milestone_payments) {
          setMilestonePayments(caseFile.agreement_milestone_payments as Record<string, boolean>);
        }
        if (caseFile?.agreement_sent_at && !caseFile?.agreement_signed_at) {
          setStep(4);
        }

        const extractedDetails = extractClientAgreementDetails({
          clientProfile: client ?? null,
          clientUser: client?.user ?? null,
          questionnaireMain: (q?.submission?.main_data as Record<string, unknown> | undefined) ?? null,
          questionnaireStep1: (q?.submission?.step1_data as Record<string, unknown> | undefined) ?? null,
          verifiedFields: (q?.submission?.verified_fields as Record<string, boolean> | undefined) ?? null,
          storedDetails: (caseFile?.agreement_config as { clientDetails?: ClientAgreementDetails } | undefined)?.clientDetails ?? null,
          clientProfileId: id,
        });
        setClientDetails(extractedDetails);
        // Prefer questionnaire / verified legal name & email over account display name.
        if (extractedDetails.fullLegalName) setClientName(extractedDetails.fullLegalName);
        if (extractedDetails.email) setClientEmail(extractedDetails.email);

        const storedTaxProvince = (caseFile?.agreement_config as { taxProvince?: string } | undefined)?.taxProvince;
        if (!storedTaxProvince) {
          set("taxProvince", detectTaxProvince(
            extractedDetails.residentialAddress,
            prof?.company_province,
            prof?.company_address_line1,
            prof?.company_address_line2,
          ) ?? "ON");
        }
      })
      .catch(() => setError("Failed to load client data."))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function printDraftPdf() {
    const style = document.createElement("style");
    style.id = "__pdf_print_style";
    style.textContent = `
      @media print {
        body * { visibility: hidden !important; }
        #retainer-agreement-doc,
        #retainer-agreement-doc * { visibility: visible !important; }
        #retainer-agreement-doc {
          position: absolute !important;
          top: 0 !important; left: 0 !important;
          width: 100% !important;
          padding: 32px !important;
          margin: 0 !important;
          background: white !important;
          box-shadow: none !important;
          border-radius: 0 !important;
        }
      }
    `;
    document.head.appendChild(style);
    const prev = document.title;
    document.title = `Retainer Agreement – ${clientName || "Client"}`;
    window.print();
    document.title = prev;
    document.getElementById("__pdf_print_style")?.remove();
  }

  async function handleDownloadPdf() {
    if (!alreadySent) {
      printDraftPdf();
      return;
    }
    setDownloadingPdf(true);
    setError(null);
    try {
      const headers = authHeaders();
      delete headers["Content-Type"];
      headers.Accept = "application/pdf";
      const res = await fetch(`${API}/consultant/clients/${id}/case-file/agreement-pdf`, { headers });
      if (!res.ok) throw new Error("Failed to generate PDF.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `retainer-agreement-${clientName || "client"}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF download failed.");
    } finally {
      setDownloadingPdf(false);
    }
  }

  function applyTemplate(tmpl: AgreementTemplate) {
    setConfig(prev => resolveAgreementConfig({
      ...tmpl.config,
      clientName,
      clientEmail,
      consultantName,
      clientDetails: prev.clientDetails,
      pathway: tmpl.pathway || pathway,
    }, {
      consultantLicenseNo: prev.consultantLicenseNo,
    }));
    if (tmpl.pathway) setPathway(tmpl.pathway);
    setMapleNotes(null);
  }

  function openMapleDialog() {
    setMapleFee(String(config.totalFee || resolvePathwayTemplate(pathway)?.fee || ""));
    setMapleCurrency(config.currency);
    setMapleRefundPolicy(isHtmlEmpty(config.refundPolicy) ? "" : config.refundPolicy);
    setMapleOpen(true);
  }

  function openSectionEditor(section: AgreementSectionKey) {
    const current = config.sectionEdits?.[section]?.trim()
      ? sanitizeAgreementHtml(config.sectionEdits[section])
      : (() => {
      const scopeText = config.scopeDescription
        || resolvePathwayTemplate(pathway)?.description
        || "Services include assessment, application preparation, and submission to relevant Canadian immigration authorities.";
      const consultantAddress = consultantProfile
        ? [consultantProfile.company_address_line1, consultantProfile.company_address_line2,
          consultantProfile.company_city, consultantProfile.company_province,
          consultantProfile.company_postal_code, consultantProfile.company_country]
          .filter(Boolean).join(", ")
        : "";
      const clientAddress = clientDetails.residentialAddress || "";

      switch (section) {
        case "parties":
          return [
            "Immigration Consultant",
            `Full legal name: ${consultantName || "[Consultant Name]"}`,
            consultantProfile?.company_name ? `Business / firm name: ${consultantProfile.company_name}` : "",
            config.consultantLicenseNo ? `RCIC licence no.: ${config.consultantLicenseNo}` : "",
            consultantProfile?.email ? `Email: ${consultantProfile.email}` : "",
            consultantProfile?.company_phone || consultantProfile?.phone
              ? `Telephone: ${consultantProfile.company_phone || consultantProfile.phone}` : "",
            consultantAddress ? `Address: ${consultantAddress}` : "",
            "",
            "Client",
            `Full legal name: ${clientName || "[Client Full Legal Name]"}`,
            clientEmail ? `Email: ${clientEmail}` : "",
            clientDetails.phone ? `Telephone: ${clientDetails.phone}` : "",
            clientAddress ? `Address: ${clientAddress}` : "",
          ].filter((line, index, lines) => line || (index > 0 && lines[index - 1])).join("\n");
        case "scope":
          return [
            `The Consultant agrees to provide professional immigration consulting services relating to the Client's selected immigration pathway: ${pathway || "[Pathway]"}.`,
            scopeText,
            "Reviewing eligibility and advising on suitable immigration options within the agreed pathway.",
            "Preparing, reviewing, and submitting applications and supporting documentation as agreed.",
            "Communicating with the Client regarding requests for information, deadlines, and application status.",
            "Services outside this scope — including additional applications, appeals, judicial review, or new pathways — require a separate written agreement and fee schedule.",
          ].join("\n\n");
        case "fees":
          return [
            `The total professional fee is ${formatAgreementCurrency(config.totalFee, config.currency)} (${config.currency}), exclusive of applicable taxes and government fees.`,
            `Milestone 1 (${config.milestone1Pct}%): ${config.milestone1Label} — ${formatAgreementCurrency(m1, config.currency)}`,
            `Milestone 2 (${config.milestone2Pct}%): ${config.milestone2Label} — ${formatAgreementCurrency(m2, config.currency)}`,
            `Milestone 3 (${config.milestone3Pct}%): ${config.milestone3Label} — ${formatAgreementCurrency(m3, config.currency)}`,
            "Invoices are due within fourteen (14) calendar days unless otherwise agreed in writing. Late payments may pause work until the account is brought current.",
            "Any advance payment will be handled in accordance with applicable CICC requirements. Only fees earned under the agreed milestones may be treated as earned fees.",
            ...(config.taxEnabled && config.taxRate > 0
              ? [
                `${config.taxLabel} (${config.taxRate}%): ${formatAgreementCurrency(agreementTaxAmount(config), config.currency)}`,
                `Total amount payable including tax: ${formatAgreementCurrency(agreementGrandTotal(config), config.currency)}. Tax is charged proportionally with each milestone payment.`,
              ]
              : []),
          ].join("\n\n");
        case "governmentFees":
          return "Government application fees, biometrics, medical examinations, police certificates, language tests, credential assessments, courier charges, translation, and other third-party costs are not included in the professional fee unless expressly stated in writing. The Client is responsible for paying these amounts directly or reimbursing the Consultant when paid on the Client's behalf.";
        case "clientObligations":
          return [
            `Provide complete, accurate, and genuine documents within ${config.docDeadlineDays} calendar days of request.`,
            "Respond promptly to Consultant requests and disclose any change in circumstances material to the application.",
            "Review drafts carefully and confirm accuracy before submission.",
            "Refrain from misrepresentation. Fraudulent, altered, or false documents void this Agreement without refund.",
            "Understand that final decisions rest solely with IRCC, provinces, or other decision-makers — not the Consultant.",
          ].join("\n");
        case "consultantObligations":
          return [
            "Perform services competently, diligently, and in accordance with the CICC Code of Professional Ethics.",
            "Maintain a client file and provide reasonable updates on progress and outstanding requirements.",
            "Safeguard Client information and use it only for the purpose of providing agreed services.",
            "Disclose any conflict of interest and decline or withdraw from representation where required by CICC rules.",
          ].join("\n");
        case "outcome":
          return "The Consultant does not guarantee approval of any application, visa, permit, nomination, invitation, or permanent residence. Processing times, policy changes, and officer discretion are outside the Consultant's control. Advice is based on information provided by the Client and laws in force at the time services are rendered.";
        case "termination":
          return "Either party may terminate this Agreement in writing. Fees earned for work completed to the date of termination remain payable. Upon termination, the Consultant will provide reasonable transition assistance and return original Client documents upon settlement of outstanding fees, subject to applicable trust account and CICC rules.";
        case "privacy":
          return "The Consultant will protect personal information in accordance with applicable privacy legislation, including PIPEDA where applicable. Information may be disclosed where required by law or with the Client's written consent. The Client authorizes the Consultant to share application information with IRCC, provinces, and designated third parties as necessary to perform the services.";
        case "refund":
          return agreementEditorText(config.refundPolicy);
        case "regulatory":
          return "The Consultant is regulated by the College of Immigration and Citizenship Consultants (CICC). Complaints may be filed with the CICC at college-ic.ca. The parties agree to attempt good-faith resolution before pursuing external remedies. Nothing in this Agreement limits rights available under CICC By-Laws or applicable law.";
        case "general":
          return [
            "Entire agreement: This document, together with any written amendments signed by both parties, constitutes the entire agreement.",
            "Amendments: Changes must be in writing and signed by both parties.",
            "Assignment: The Client may not assign this Agreement without the Consultant's written consent.",
            "Severability: If any provision is invalid, the remainder continues in effect.",
            "Governing law: This Agreement is governed by the laws of Canada and the province in which the Consultant primarily practises.",
          ].join("\n");
        case "custom":
          return agreementEditorText(config.customClauses);
      }
    })();
    setEditingSection(section);
    setEditingSectionText(current.includes("<") ? current : agreementEditorHtml(current));
  }

  function saveSectionEdit() {
    if (!editingSection) return;

    const section = editingSection;
    const html = sanitizeAgreementHtml(editingSectionText.trim());
    const value = agreementEditorText(html);
    setConfig(prev => {
      const sectionEdits = { ...(prev.sectionEdits ?? {}) };
      if (value) sectionEdits[section] = html;
      else delete sectionEdits[section];
      return {
        ...prev,
        sectionEdits,
        ...(section === "scope" ? { scopeDescription: value } : {}),
        ...(section === "refund" ? { refundPolicy: html } : {}),
        ...(section === "custom" ? { customClauses: html } : {}),
      };
    });
    setEditingSection(null);
    setEditingSectionText("");
  }

  async function generateCustomAgreement() {
    if (!mapleInstructions.trim()) return;

    setGeneratingAgreement(true);
    setError(null);
    try {
      const res = await fetch(`${API}/consultant/clients/${id}/case-file/generate-agreement`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          instructions: mapleInstructions.trim(),
          total_fee: mapleFee.trim() ? Number(mapleFee) : null,
          currency: mapleCurrency,
          payment_rules: maplePaymentRules.trim() || null,
          refund_policy: mapleRefundPolicy.trim() || null,
          pathway,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Maple could not create the agreement draft.");
      if (!json.config || typeof json.config !== "object") {
        throw new Error("Maple returned an invalid agreement draft.");
      }

      setConfig(prev => resolveAgreementConfig({
        ...(json.config as Partial<AgreementConfig>),
        clientName,
        clientEmail,
        consultantName,
        clientDetails: prev.clientDetails,
        pathway,
      }, {
        consultantLicenseNo: prev.consultantLicenseNo,
      }));
      setMapleNotes(String(json.notes ?? "Maple created a draft. Review every term before sending."));
      setMapleOpen(false);
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Maple agreement generation failed.");
    } finally {
      setGeneratingAgreement(false);
    }
  }

  async function saveCurrentTemplate() {
    if (!templateName.trim()) return;
    setSavingTemplate(true);
    setError(null);
    try {
      const payload = buildPayloadConfig();
      const {
        clientName: _cn,
        clientEmail: _ce,
        consultantName: _con,
        clientDetails: _details,
        ...configOnly
      } = payload;
      const res = await fetch(`${API}/consultant/agreement-templates`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          name: templateName.trim(),
          pathway: pathway || null,
          config: configOnly,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to save template.");
      setSaveTemplateOpen(false);
      setTemplateName("");
      await loadTemplates();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save template.");
    } finally {
      setSavingTemplate(false);
    }
  }

  async function deleteTemplate(tmplId: number) {
    try {
      const res = await fetch(`${API}/consultant/agreement-templates/${tmplId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.message ?? "Failed to delete.");
      }
      await loadTemplates();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete template.");
    }
  }

  async function handleWhatsAppReminder() {
    setSendingReminder(true);
    setError(null);
    try {
      const res = await fetch(`${API}/consultant/clients/${id}/case-file/send-agreement-reminder`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ send_email: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Reminder failed.");
      if (json.whatsapp_url) window.open(json.whatsapp_url, "_blank", "noopener,noreferrer");
      setReminderCount(json.reminder_count ?? reminderCount + 1);
      setLastReminderAt(json.last_reminder_at ?? new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reminder failed.");
    } finally {
      setSendingReminder(false);
    }
  }

  function buildPayloadConfig(): AgreementConfig {
    return {
      ...config,
      clientName,
      clientEmail,
      consultantName,
      pathway,
      scopeDescription: config.scopeDescription || resolvePathwayTemplate(pathway)?.description || "",
      clientDetails: {
        ...clientDetails,
        fullLegalName: clientName || clientDetails.fullLegalName || null,
        email: clientEmail || clientDetails.email || null,
      },
    };
  }

  async function handleSend() {
    setSending(true);
    setError(null);
    setConfirmOpen(false);
    try {
      const payloadConfig = buildPayloadConfig();
      const res = await fetch(`${API}/consultant/clients/${id}/case-file/send-agreement`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          agreement_fee:   payloadConfig.totalFee,
          agreement_notes: payloadConfig.customClauses || null,
          agreement_config: payloadConfig,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to send.");
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send agreement.");
    } finally {
      setSending(false);
    }
  }

  async function saveMilestonePayments(next: Record<string, boolean>) {
    setSavingMilestones(true);
    try {
      const res = await fetch(`${API}/consultant/clients/${id}/case-file/agreement-milestones`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ milestone_payments: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to update.");
      setMilestonePayments(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save milestone status.");
    } finally {
      setSavingMilestones(false);
    }
  }

  const { m1, m2, m3 } = milestoneAmounts(config);
  const pctSum  = config.milestone1Pct + config.milestone2Pct + config.milestone3Pct;
  const complianceWarnings: string[] = [];
  if (!config.consultantLicenseNo && !consultantProfile?.rcic_number) {
    complianceWarnings.push("RCIC license number is missing — add it in Step 2 or your profile.");
  }
  if (!consultantProfile?.digital_signature) {
    complianceWarnings.push("Digital signature not set in your consultant profile.");
  }
  if (isHtmlEmpty(config.refundPolicy)) {
    complianceWarnings.push("Refund policy is empty.");
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Signed read-only view ──
  if (alreadySigned) {
    const signedConfig = buildPayloadConfig();
    return (
      <div className="min-w-0 w-full overflow-x-hidden px-3 py-4 sm:px-4 sm:py-6">
        <WorkspaceBreadcrumb profileId={id} workspaceStep={2} pageLabel="Retainer agreement" />
        <div className="mb-4 flex flex-wrap items-center gap-3 sm:mb-6">
          <h1 className="text-base font-bold sm:text-lg">Signed Retainer Agreement</h1>
          <Badge className="bg-green-600 text-white gap-1">
            <CheckCircle2 className="h-3 w-3" /> Signed
          </Badge>
          {agreementVersion > 1 && (
            <Badge variant="outline">Version {agreementVersion}</Badge>
          )}
        </div>
        <RetainerAgreementDocument
          config={signedConfig}
          clientName={clientName}
          clientEmail={clientEmail}
          clientDetails={clientDetails}
          consultantName={consultantName}
          consultantProfile={consultantProfile}
          agreementDate={alreadySentAt}
          clientSignedDate={agreementSignedAt}
        />
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={downloadingPdf} className="gap-1.5">
            {downloadingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Download PDF
          </Button>
        </div>
        {signedDocPath && (
          <div className="mt-4">
            <Button variant="outline" size="sm" asChild>
              <a href={signedDocPath} target="_blank" rel="noopener noreferrer">View uploaded signed PDF</a>
            </Button>
          </div>
        )}
        <div className="mt-6 rounded-xl border bg-card p-5 space-y-3">
          <p className="text-sm font-semibold">Milestone payments</p>
          {(["1", "2", "3"] as const).map((n) => {
            const amt = n === "1" ? m1 : n === "2" ? m2 : m3;
            const label = n === "1" ? config.milestone1Label : n === "2" ? config.milestone2Label : config.milestone3Label;
            return (
              <label key={n} className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={!!milestonePayments[n]}
                  disabled={savingMilestones}
                  onChange={(e) => {
                    const next = { ...milestonePayments, [n]: e.target.checked };
                    void saveMilestonePayments(next);
                  }}
                />
                <span>
                  Milestone {n} — {formatAgreementCurrency(amt, config.currency)} — {label}
                </span>
              </label>
            );
          })}
        </div>
        <div className="mt-6">
          <Link href={`/dashboard/clients/${id}/workspace`}>
            <Button variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to workspace</Button>
          </Link>
        </div>
      </div>
    );
  }

  // ── Success state ──
  if (sent) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mx-auto mb-4">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Agreement Sent!</h1>
        <p className="text-muted-foreground mb-6">
          A secure signing link has been emailed to <strong>{clientEmail || clientName}</strong>.
          The workspace status is now <Badge variant="outline">Agreement Sent</Badge>.
        </p>
        <Link href={`/dashboard/clients/${id}/workspace`}>
          <Button>
            <ArrowLeft className="mr-2 h-4 w-4" />Back to Workspace
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full overflow-x-hidden px-3 py-4 sm:px-4 sm:py-6">

      <WorkspaceBreadcrumb profileId={id} workspaceStep={2} pageLabel="Retainer agreement" />

      {/* Page Header */}
      <div className="mb-4 flex flex-wrap items-center gap-3 sm:mb-6">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold leading-none sm:text-lg">Create Retainer Agreement</h1>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {clientName ? `For: ${clientName}` : "Loading client data\u2026"}
            </p>
          </div>
        </div>
        {alreadySigned && (
          <Badge className="w-full justify-center bg-green-600 text-white gap-1 sm:ml-auto sm:w-auto">
            <CheckCircle2 className="h-3 w-3" /> Agreement Signed
          </Badge>
        )}
        {!alreadySigned && alreadySent && (
          <Badge variant="outline" className="w-full justify-center border-amber-400 text-amber-700 gap-1 sm:ml-auto sm:w-auto">
            <Clock className="h-3 w-3" /> Previously Sent
          </Badge>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-2 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />{error}
        </div>
      )}

      {/* No pathway guard */}
      {!pathway && (
        <div className="rounded-xl border bg-amber-50 border-amber-200 p-6 text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-amber-500 mx-auto" />
          <p className="font-semibold text-amber-800">No pathway assigned yet</p>
          <p className="text-sm text-amber-700">
            You must assign an immigration pathway before creating a retainer agreement.
          </p>
          <Link href={`/dashboard/clients/${id}/workspace/pathway-calculator`}>
            <Button variant="outline" className="border-amber-400 text-amber-700 hover:bg-amber-100">
              Go to Pathway Calculator
            </Button>
          </Link>
        </div>
      )}

      {pathway && (
        <>
          <WizardNav current={step} />

          {/* ──────────────── STEP 1: Template ──────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-card p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold">Select Service Template</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Choose the template that matches this client&apos;s immigration pathway.
                  The assigned pathway is pre-selected.
                </p>
                <div className="grid gap-3">
                  {Object.entries(PATHWAY_TEMPLATES).map(([key, tmpl]) => {
                    const selected = pathway === key;
                    return (
                      <div
                        key={key}
                        onClick={() => { setPathway(key); set("totalFee", tmpl.fee); }}
                        className={cn(
                          "w-full text-left rounded-xl border p-4 transition-all cursor-pointer",
                          selected
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "hover:bg-muted/40 hover:border-muted-foreground/30"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className={cn(
                              "h-4 w-4 rounded-full border-2 shrink-0",
                              selected ? "bg-primary border-primary" : "border-muted-foreground/40"
                            )} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{key}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{tmpl.description}</p>
                            </div>
                          </div>
                          {!selected && (
                            <Badge variant="outline" className="shrink-0 text-xs whitespace-nowrap">
                              Default {formatAgreementCurrency(tmpl.fee, config.currency)}
                            </Badge>
                          )}
                        </div>

                        {/* Inline fee editor — only on selected template */}
                        {selected && (
                          <div
                            className="mt-4 pt-4 border-t border-primary/20 flex items-end gap-4"
                            onClick={e => e.stopPropagation()}
                          >
                            <div className="flex-1">
                              <label className="text-xs font-medium text-primary mb-1 block">
                                Professional Fee ({config.currency})
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  value={config.totalFee}
                                  min={0}
                                  max={50000}
                                  step={50}
                                  onChange={e => set("totalFee", Number(e.target.value))}
                                  className="w-40 rounded-md border border-primary/40 bg-background px-3 py-1.5 text-sm font-semibold text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                                <select
                                  value={config.currency}
                                  onChange={e => set("currency", e.target.value as "CAD" | "USD")}
                                  className="rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                >
                                  <option value="CAD">CAD</option>
                                  <option value="USD">USD</option>
                                </select>
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground space-y-0.5 pb-1">
                              <p>Default: <span className="font-medium">{formatAgreementCurrency(tmpl.fee, config.currency)}</span></p>
                              <button
                                type="button"
                                className="text-primary underline underline-offset-2 hover:opacity-70"
                                onClick={() => set("totalFee", tmpl.fee)}
                              >
                                Reset to default
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {templatesLoading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading saved templates…
                  </div>
                )}
                {templates.length > 0 && (
                  <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <BookmarkPlus className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-semibold">My Saved Templates</h3>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {templates.map((tmpl) => (
                        <div key={tmpl.id} className="flex items-center gap-2 rounded-lg border bg-card p-3">
                          <button
                            type="button"
                            onClick={() => { applyTemplate(tmpl); setStep(3); }}
                            className="min-w-0 flex-1 text-left hover:opacity-80"
                          >
                            <p className="text-sm font-medium truncate">{tmpl.name}</p>
                            {tmpl.pathway && (
                              <p className="text-[11px] text-muted-foreground truncate">{tmpl.pathway}</p>
                            )}
                          </button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                            onClick={() => void deleteTemplate(tmpl.id)}
                            aria-label={`Delete ${tmpl.name}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Sparkles className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold">Create a custom agreement with Maple AI</h3>
                        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                          Describe your fee rules and special terms. Maple will prepare a draft that you can
                          fully edit before previewing or sending it.
                        </p>
                      </div>
                    </div>
                    <Button onClick={openMapleDialog} className="shrink-0 gap-2">
                      <Sparkles className="h-4 w-4" /> Create custom agreement
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 flex-wrap">
                <Button
                  variant="outline"
                  className="gap-2"
                  disabled={!pathway || !clientEmail || Number(config.totalFee) <= 0 || sending || alreadySigned}
                  onClick={() => {
                    const tmpl = resolvePathwayTemplate(pathway);
                    if (tmpl && (!config.totalFee || config.totalFee <= 0)) {
                      set("totalFee", tmpl.fee);
                    }
                    setConfirmOpen(true);
                  }}
                >
                  <Send className="h-4 w-4" />
                  {alreadySent ? "Quick resend with defaults" : "Quick send with defaults"}
                </Button>
                <Button onClick={() => setStep(2)} className="gap-2">
                  Next: Client Details <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ──────────────── STEP 2: Client Details ──────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-xl border bg-card p-6 space-y-5">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold">Client &amp; Consultant Details</h2>
                </div>
                <p className="text-sm text-muted-foreground">
                  Verify and edit the auto-filled details — these appear in the agreement parties table.
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Client full legal name">
                    <TextInput
                      value={clientName}
                      onChange={(v) => { setClientName(v); setClientDetail("fullLegalName", v); }}
                      placeholder="As on passport"
                    />
                  </Field>
                  <Field label="Client email">
                    <TextInput
                      value={clientEmail}
                      onChange={(v) => { setClientEmail(v); setClientDetail("email", v); }}
                      placeholder="client@email.com"
                    />
                  </Field>
                  <Field label="Client telephone">
                    <TextInput
                      value={clientDetails.phone ?? ""}
                      onChange={(v) => setClientDetail("phone", v)}
                      placeholder="Mobile or WhatsApp"
                    />
                  </Field>
                  <Field label="Date of birth">
                    <TextInput
                      value={clientDetails.dateOfBirth ?? ""}
                      onChange={(v) => setClientDetail("dateOfBirth", v)}
                      placeholder="e.g. January 27, 1999"
                    />
                  </Field>
                  <Field label="Passport / travel document no.">
                    <TextInput
                      value={clientDetails.passportNumber ?? ""}
                      onChange={(v) => setClientDetail("passportNumber", v)}
                      placeholder="e.g. P1076180"
                    />
                  </Field>
                  <Field label="Country of citizenship">
                    <TextInput
                      value={clientDetails.citizenship ?? ""}
                      onChange={(v) => setClientDetail("citizenship", v)}
                      placeholder="e.g. Sri Lankan"
                    />
                  </Field>
                  <Field label="Client residential address" hint="Required for the legal agreement if not in questionnaire">
                    <TextAreaInput
                      value={clientDetails.residentialAddress ?? ""}
                      onChange={(v) => setClientDetail("residentialAddress", v)}
                      placeholder="Full mailing address"
                    />
                  </Field>
                  <Field label="Consultant name">
                    <TextInput value={consultantName} onChange={setConsultantName} placeholder="Your full name" />
                  </Field>
                  <Field label="CICC License No. (RCIC)" hint="Optional — printed on the agreement">
                    <TextInput
                      value={config.consultantLicenseNo}
                      onChange={v => set("consultantLicenseNo", v)}
                      placeholder="e.g. R123456"
                    />
                  </Field>
                </div>
                <div className="rounded-lg bg-muted/40 border p-3 text-xs text-muted-foreground flex items-start gap-2">
                  <Award className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                  <span>
                    Selected pathway: <strong className="text-foreground">{pathway}</strong>.
                    The scope of services will be auto-populated from this template.
                  </span>
                </div>
              </div>
              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
                </Button>
                <Button onClick={() => setStep(3)} className="gap-2">
                  Next: Customize <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ──────────────── STEP 3: Customize ──────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              {mapleNotes && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
                  <div className="flex items-start gap-2">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{mapleNotes}</span>
                  </div>
                </div>
              )}
              <div className="rounded-xl border bg-card p-6 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <h2 className="font-semibold">Fee Structure &amp; Terms</h2>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSaveTemplateOpen(true)} className="gap-1.5">
                    <BookmarkPlus className="h-3.5 w-3.5" /> Save as template
                  </Button>
                </div>

                {/* Total fee + currency */}
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Total Professional Fee" hint="Consultant fee — excludes government application fees">
                    <NumInput value={config.totalFee} onChange={v => set("totalFee", v)} min={0} max={50000} step={50} />
                  </Field>
                  <Field label="Currency">
                    <select
                      value={config.currency}
                      onChange={e => set("currency", e.target.value as "CAD" | "USD")}
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="CAD">CAD — Canadian Dollar</option>
                      <option value="USD">USD — US Dollar</option>
                    </select>
                  </Field>
                </div>

                {/* Tax charges */}
                <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-4 space-y-3">
                  <label className="flex items-start gap-3 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={config.taxEnabled}
                      onChange={e => set("taxEnabled", e.target.checked)}
                      disabled={taxRatesLoading || taxRates.length === 0}
                      className="mt-0.5 h-4 w-4 accent-primary"
                    />
                    <span>
                      Add tax charges to the professional fee
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        Tax is shown separately and charged proportionally with each payment milestone.
                      </span>
                    </span>
                  </label>
                  {config.taxEnabled && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="Place of supply">
                        <select
                          value={config.taxProvince}
                          onChange={e => set("taxProvince", e.target.value)}
                          disabled={taxRatesLoading || taxRates.length === 0}
                          className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        >
                          {taxRates.length === 0 && <option value="">No synced rates available</option>}
                          {taxRates.map(rate => (
                            <option key={rate.code} value={rate.code}>
                              {rate.name} — {rate.label}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Synced tax rate" hint="Loaded from the active rates maintained in Admin → GST/HST Sync.">
                        <input
                          value={config.taxLabel ? `${config.taxLabel} (${config.taxRate}%)` : "Select a place of supply"}
                          readOnly
                          className="w-full rounded-md border border-input bg-muted px-3 py-1.5 text-sm text-muted-foreground"
                        />
                      </Field>
                    </div>
                  )}
                  {taxRatesError && (
                    <p className="text-xs text-amber-700">
                      {taxRatesError} Tax charges are unavailable until synced rates can be loaded.
                    </p>
                  )}
                  {config.taxEnabled && config.taxRate > 0 && (
                    <div className="border-t border-primary/10 pt-3 text-xs text-muted-foreground">
                      <div className="flex justify-between gap-3">
                        <span>{config.taxLabel} ({config.taxRate}%)</span>
                        <span>{formatAgreementCurrency(agreementTaxAmount(config), config.currency)}</span>
                      </div>
                      <div className="mt-1 flex justify-between gap-3 font-semibold text-foreground">
                        <span>Total including tax</span>
                        <span>{formatAgreementCurrency(agreementGrandTotal(config), config.currency)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Milestones */}
                <div>
                  <p className="text-sm font-semibold mb-3">Payment Milestones</p>
                  {pctSum !== 100 && (
                    <div className="mb-3 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      Milestone percentages total {pctSum}% — must equal exactly 100%.
                    </div>
                  )}
                  <div className="space-y-4">
                    {([1, 2, 3] as const).map(n => {
                      const pctKey = `milestone${n}Pct`   as keyof AgreementConfig;
                      const lblKey = `milestone${n}Label` as keyof AgreementConfig;
                      const pct    = config[pctKey] as number;
                      const lbl    = config[lblKey] as string;
                      const amt    = n === 3 ? m3 : Math.round(config.totalFee * pct / 100);
                      return (
                        <div key={n} className="rounded-lg border bg-muted/20 p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Milestone {n}
                            </p>
                            <Badge variant="outline" className="text-xs">
                              {formatAgreementCurrency(amt + agreementTaxForAmount(config, amt), config.currency)}
                              {config.taxEnabled && config.taxRate > 0 ? " incl. tax" : ""}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <Field label="Percentage (%)">
                              <NumInput value={pct} onChange={v => set(pctKey, v)} min={0} max={100} />
                            </Field>
                            <div className="col-span-2">
                              <Field label="Trigger Description">
                                <TextInput value={lbl} onChange={v => set(lblKey, v)} />
                              </Field>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Doc deadline */}
                <Field label="Document Submission Deadline (calendar days)" hint="Number of days the client has to submit requested documents">
                  <NumInput value={config.docDeadlineDays} onChange={v => set("docDeadlineDays", v)} min={3} max={60} />
                </Field>

                {/* Refund policy */}
                <Field label="Refund Policy">
                  <RichTextEditorDemo
                    output="html"
                    value={config.refundPolicy}
                    onChange={v => set("refundPolicy", v as string)}
                    placeholder="Describe your refund terms…"
                    className="min-h-[120px] max-h-[220px]"
                    editorContentClassName="p-3 text-sm"
                  />
                </Field>

                {/* Custom clauses */}
                <Field
                  label="Additional Custom Clauses (optional)"
                  hint="Appears as Section 13 in the agreement. Leave blank if not needed."
                >
                  <RichTextEditorDemo
                    output="html"
                    value={config.customClauses}
                    onChange={v => set("customClauses", v as string)}
                    placeholder="e.g. Client must attend a mandatory pre-application consultation within 7 days of signing."
                    className="min-h-[120px] max-h-[220px]"
                    editorContentClassName="p-3 text-sm"
                  />
                </Field>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
                </Button>
                <Button onClick={() => setStep(4)} disabled={pctSum !== 100} className="gap-2">
                  <Eye className="h-4 w-4" /> Preview Agreement
                </Button>
              </div>
            </div>
          )}

          {/* ──────────────── STEP 4: Preview & Send ──────────────── */}
          {step === 4 && (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="rounded-xl border bg-card p-4 flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{clientName || "\u2014"}</span>
                  {clientEmail && <span className="text-muted-foreground text-xs">{clientEmail}</span>}
                </div>
                <div className="h-4 w-px bg-border hidden sm:block" />
                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <span>{pathway}</span>
                </div>
                <div className="h-4 w-px bg-border hidden sm:block" />
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-primary">{formatAgreementCurrency(config.totalFee, config.currency)}</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => setStep(3)} className="ml-auto gap-1">
                  <Edit3 className="h-3.5 w-3.5" /> Edit
                </Button>
              </div>

              {/* Resend warning */}
              {alreadySent && !alreadySigned && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex flex-wrap items-center gap-3 text-sm text-amber-800">
                  <Clock className="h-4 w-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">Agreement already sent</p>
                    <p className="text-xs mt-0.5">
                      Sent on {alreadySentAt ? new Date(alreadySentAt).toLocaleString("en-CA") : "\u2014"}.
                      {reminderCount > 0 && (
                        <> Reminders sent: {reminderCount}
                          {lastReminderAt && ` (last ${new Date(lastReminderAt).toLocaleString("en-CA")})`}.
                        </>
                      )}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleWhatsAppReminder}
                    disabled={sendingReminder}
                    className="gap-1.5 border-green-300 text-green-800 hover:bg-green-50"
                  >
                    {sendingReminder
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <MessageCircle className="h-3.5 w-3.5" />}
                    WhatsApp reminder
                  </Button>
                </div>
              )}

              {complianceWarnings.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-1">
                  <p className="font-medium flex items-center gap-2"><AlertCircle className="h-4 w-4" />Before sending</p>
                  <ul className="list-disc ml-5 text-xs space-y-0.5">
                    {complianceWarnings.map((w) => <li key={w}>{w}</li>)}
                  </ul>
                </div>
              )}

              <RetainerAgreementDocument
                config={buildPayloadConfig()}
                clientName={clientName}
                clientEmail={clientEmail}
                clientDetails={clientDetails}
                consultantName={consultantName}
                consultantProfile={consultantProfile}
                previewNote="The client will receive a secure signing link via email. This preview is for consultant review only."
                editable={!alreadySigned}
                onEditSection={openSectionEditor}
              />

              <div className="flex flex-wrap justify-between items-center gap-3">
                <Button variant="outline" onClick={() => setStep(3)}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
                </Button>
                <div className="flex items-center gap-3">
                  <Button variant="outline" onClick={handleDownloadPdf} disabled={downloadingPdf} className="gap-2">
                    {downloadingPdf
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Download className="h-4 w-4" />}
                    {alreadySent ? "Download PDF" : "Print preview"}
                  </Button>
                  <Button
                    onClick={() => setConfirmOpen(true)}
                    disabled={sending}
                    className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Send className="h-4 w-4" /> {alreadySent ? "Resend to Client" : "Send to Client"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog
        open={editingSection !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingSection(null);
            setEditingSectionText("");
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Edit {editingSection ? AGREEMENT_SECTION_LABELS[editingSection] : "agreement section"}
            </DialogTitle>
            <DialogDescription>
              Edit the complete content of this section below. Your changes will replace the standard wording in the
              preview and the agreement sent to the client.
            </DialogDescription>
          </DialogHeader>
          <RichTextEditorDemo
            output="html"
            value={editingSectionText}
            onChange={value => setEditingSectionText(value as string)}
            placeholder="Type the wording you want to appear in this section…"
            className="min-h-[240px] max-h-[420px]"
            editorContentClassName="p-4 text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            Use the toolbar to format headings, bold text, lists, and emphasis. Review the wording carefully before saving.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingSection(null);
                setEditingSectionText("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={saveSectionEdit}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mapleOpen} onOpenChange={setMapleOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Create custom agreement with Maple AI
            </DialogTitle>
            <DialogDescription>
              Give Maple the commercial terms and instructions for this {pathway} agreement. The result is a
              draft only and remains editable in Customize.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_150px]">
              <Field label="Professional fee">
                <input
                  type="number"
                  value={mapleFee}
                  min={0}
                  max={50000}
                  step={50}
                  onChange={e => setMapleFee(e.target.value)}
                  placeholder="e.g. 3500"
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </Field>
              <Field label="Currency">
                <select
                  value={mapleCurrency}
                  onChange={e => setMapleCurrency(e.target.value as AgreementConfig["currency"])}
                  className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="CAD">CAD</option>
                  <option value="USD">USD</option>
                </select>
              </Field>
            </div>
            <Field
              label="What should this agreement cover?"
              hint="Include special services, payment milestones, deadlines, or clauses you want Maple to draft."
            >
              <TextAreaInput
                value={mapleInstructions}
                onChange={setMapleInstructions}
                rows={5}
                placeholder="Example: Charge 50% on signing and 50% when the application is ready. Include a mandatory consultation, document review, and a clause explaining that government fees are separate."
              />
            </Field>
            <Field label="Payment rules (optional)">
              <TextAreaInput
                value={maplePaymentRules}
                onChange={setMaplePaymentRules}
                rows={3}
                placeholder="e.g. The second milestone is due before submission."
              />
            </Field>
            <Field label="Refund policy (optional)">
              <TextAreaInput
                value={mapleRefundPolicy}
                onChange={setMapleRefundPolicy}
                rows={3}
                placeholder="e.g. Fees already earned are non-refundable; unused funds are returned within 30 days."
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMapleOpen(false)} disabled={generatingAgreement}>
              Cancel
            </Button>
            <Button
              onClick={() => void generateCustomAgreement()}
              disabled={generatingAgreement || !mapleInstructions.trim()}
              className="gap-2"
            >
              {generatingAgreement
                ? <><Loader2 className="h-4 w-4 animate-spin" /> Preparing draft…</>
                : <><Sparkles className="h-4 w-4" /> Prepare draft</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={saveTemplateOpen} onOpenChange={setSaveTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save agreement template</DialogTitle>
            <DialogDescription>
              Saves fee milestones, refund policy, and custom clauses for reuse on future clients.
            </DialogDescription>
          </DialogHeader>
          <Field label="Template name">
            <TextInput
              value={templateName}
              onChange={setTemplateName}
              placeholder="e.g. Express Entry – standard 3500"
            />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveTemplateOpen(false)}>Cancel</Button>
            <Button onClick={saveCurrentTemplate} disabled={savingTemplate || !templateName.trim()}>
              {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send agreement to client?</DialogTitle>
            <DialogDescription>
              The client will receive an email with a secure link. They will see exactly the document previewed above
              (fee {formatAgreementCurrency(config.totalFee, config.currency)}, version {alreadySent ? agreementVersion + 1 : 1}).
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Recipient: <strong>{clientEmail || clientName}</strong>
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handleSend} disabled={sending} className="bg-green-600 hover:bg-green-700 text-white">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm & send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

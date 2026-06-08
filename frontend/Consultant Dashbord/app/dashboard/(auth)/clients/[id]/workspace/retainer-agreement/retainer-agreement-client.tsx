"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, FileText, CheckCircle2, ChevronRight,
  Loader2, Send, AlertCircle, Edit3, Eye, DollarSign,
  Users, Briefcase, Award, Clock, Download, MessageCircle,
  BookmarkPlus, Trash2,
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
  DEFAULT_AGREEMENT_CONFIG,
  formatAgreementCurrency,
  milestoneAmounts,
  PATHWAY_TEMPLATES,
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
  const [consultantName, setConsultantName]   = useState("");
  const [pathway, setPathway]                 = useState("");
  const [alreadySent, setAlreadySent]         = useState(false);
  const [alreadySentAt, setAlreadySentAt]     = useState<string | null>(null);
  const [alreadySigned, setAlreadySigned]     = useState(false);

  const [config, setConfig] = useState<AgreementConfig>(DEFAULT_AGREEMENT_CONFIG);
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
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [reminderCount, setReminderCount] = useState(0);
  const [lastReminderAt, setLastReminderAt] = useState<string | null>(null);
  const set = <K extends keyof AgreementConfig>(k: K, v: AgreementConfig[K]) =>
    setConfig(prev => ({ ...prev, [k]: v }));

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

        const tmpl = PATHWAY_TEMPLATES[pw];
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

        if (q?.submission?.main_data) {
          const md   = q.submission.main_data;
          const name = [md.firstName, md.lastName].filter(Boolean).join(" ");
          if (name) setClientName(name);
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
    setConfig(prev => resolveAgreementConfig(tmpl.config, {
      ...prev,
      clientName,
      clientEmail,
      consultantName,
      pathway: tmpl.pathway || pathway,
    }));
    if (tmpl.pathway) setPathway(tmpl.pathway);
  }

  async function saveCurrentTemplate() {
    if (!templateName.trim()) return;
    setSavingTemplate(true);
    setError(null);
    try {
      const payload = buildPayloadConfig();
      const { clientName: _cn, clientEmail: _ce, consultantName: _con, ...configOnly } = payload;
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
      scopeDescription: PATHWAY_TEMPLATES[pathway]?.description ?? config.scopeDescription ?? "",
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
      <div className="w-full px-4 py-6">
        <WorkspaceBreadcrumb profileId={id} workspaceStep={2} pageLabel="Retainer agreement" />
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <h1 className="text-lg font-bold">Signed Retainer Agreement</h1>
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
    <div className="w-full px-4 py-6">

      <WorkspaceBreadcrumb profileId={id} workspaceStep={2} pageLabel="Retainer agreement" />

      {/* Page Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none">Create Retainer Agreement</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {clientName ? `For: ${clientName}` : "Loading client data\u2026"}
            </p>
          </div>
        </div>
        {alreadySigned && (
          <Badge className="ml-auto bg-green-600 text-white gap-1">
            <CheckCircle2 className="h-3 w-3" /> Agreement Signed
          </Badge>
        )}
        {!alreadySigned && alreadySent && (
          <Badge variant="outline" className="ml-auto border-amber-400 text-amber-700 gap-1">
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
              </div>
              <div className="flex justify-end">
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
                  Verify and edit the auto-filled details — these will appear in the agreement.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Client Full Name">
                    <TextInput value={clientName} onChange={setClientName} placeholder="Full legal name" />
                  </Field>
                  <Field label="Client Email">
                    <TextInput value={clientEmail} onChange={setClientEmail} placeholder="client@email.com" />
                  </Field>
                  <Field label="Consultant Name">
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
              <div className="rounded-xl border bg-card p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <BookmarkPlus className="h-4 w-4 text-primary" />
                    <h2 className="font-semibold">My Template Library</h2>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setSaveTemplateOpen(true)} className="gap-1.5">
                    <BookmarkPlus className="h-3.5 w-3.5" /> Save current as template
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Load a saved fee structure and terms template. Client details are not overwritten.
                </p>
                {templatesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading templates…
                  </div>
                ) : templates.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No saved templates yet.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {templates.map((tmpl) => (
                      <div key={tmpl.id} className="flex items-center gap-2 rounded-lg border p-3">
                        <button
                          type="button"
                          onClick={() => applyTemplate(tmpl)}
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
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border bg-card p-6 space-y-6">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold">Fee Structure &amp; Terms</h2>
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
                              {formatAgreementCurrency(amt, config.currency)}
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
                  hint="Appears as Section 7 in the agreement. Leave blank if not needed."
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
                consultantName={consultantName}
                consultantProfile={consultantProfile}
                previewNote="The client will receive a secure signing link via email. This preview is for consultant review only."
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

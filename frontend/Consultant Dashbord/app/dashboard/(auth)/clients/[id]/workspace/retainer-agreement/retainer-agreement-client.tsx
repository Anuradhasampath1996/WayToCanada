"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, FileText, CheckCircle2, ChevronRight,
  Loader2, Send, AlertCircle, Edit3, Eye, DollarSign,
  Users, Briefcase, Award, Clock, Download, Building2, Globe, Phone, MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RichTextEditorDemo } from "@/components/ui/custom/tiptap/rich-text-editor";

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

interface AgreementConfig {
  totalFee: number;
  currency: "CAD" | "USD";
  milestone1Pct: number;
  milestone1Label: string;
  milestone2Pct: number;
  milestone2Label: string;
  milestone3Pct: number;
  milestone3Label: string;
  docDeadlineDays: number;
  refundPolicy: string;
  customClauses: string;
  consultantLicenseNo: string;
}

const DEFAULT_CONFIG: AgreementConfig = {
  totalFee: 3000,
  currency: "CAD",
  milestone1Pct: 30,
  milestone1Label: "Upon signing this agreement (Retainer Fee)",
  milestone2Pct: 40,
  milestone2Label: "Upon receiving an ITA, provincial nomination, or equivalent approval",
  milestone3Pct: 30,
  milestone3Label: "Before final application submission to IRCC",
  docDeadlineDays: 14,
  refundPolicy:
    "The retainer fee (Milestone 1) is non-refundable once work has commenced. " +
    "Milestones 2 and 3 are not payable if the corresponding government action does not occur. " +
    "No refund will be issued if the application is refused due to fraudulent documents provided by the client.",
  customClauses: "",
  consultantLicenseNo: "",
};

const PATHWAY_TEMPLATES: Record<string, { fee: number; description: string }> = {
  "Express Entry \u2013 Federal Skilled Worker": {
    fee: 3500,
    description: "Express Entry profile creation, FSW eligibility assessment, CRS optimization, monitoring draws, and full PR application submission.",
  },
  "Express Entry \u2013 Canadian Experience Class": {
    fee: 3000,
    description: "CEC eligibility assessment, Express Entry profile, CRS optimization, and full PR application submission.",
  },
  "Express Entry \u2013 Federal Skilled Trades": {
    fee: 3200,
    description: "FST eligibility assessment, trade certification verification, Express Entry profile, and PR application.",
  },
  "Provincial Nominee Program": {
    fee: 4000,
    description: "Provincial stream identification, PNP application preparation, nomination support, and subsequent PR application.",
  },
  "Study Permit": {
    fee: 1500,
    description: "DLI selection guidance, study permit application preparation, submission, and response handling.",
  },
  "Work Permit": {
    fee: 2000,
    description: "LMIA or LMIA-exempt work permit assessment, application preparation, submission, and response handling.",
  },
  "Family Sponsorship": {
    fee: 3500,
    description: "Sponsorship eligibility assessment, undertaking and sponsorship application preparation, and submission.",
  },
};

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

function formatCurrency(amount: number, curr: string) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: curr }).format(amount);
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

// ─── Agreement Preview ────────────────────────────────────────────────────────

function AgreementPreview({
  clientName, clientEmail, consultantName, pathway, config, consultantProfile,
}: {
  clientName: string; clientEmail: string; consultantName: string;
  pathway: string; config: AgreementConfig; consultantProfile: ConsultantProfile | null;
}) {
  const today = new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
  const m1 = Math.round(config.totalFee * config.milestone1Pct / 100);
  const m2 = Math.round(config.totalFee * config.milestone2Pct / 100);
  const m3 = config.totalFee - m1 - m2;

  const cp = consultantProfile;
  const digitalSig     = cp?.digital_signature ?? null;
  const companyName    = cp?.company_name || consultantName || null;
  const companyAddress = [cp?.company_address_line1, cp?.company_address_line2, cp?.company_city, cp?.company_province, cp?.company_postal_code, cp?.company_country].filter(Boolean).join(", ");
  const companyPhone   = cp?.company_phone || cp?.phone || null;
  const companyWeb     = cp?.company_website || null;
  const rcicNo         = cp?.rcic_number || config.consultantLicenseNo || null;

  return (
    <div id="retainer-agreement-doc" className="rounded-xl border bg-white p-8 text-sm leading-relaxed max-w-3xl mx-auto shadow-sm space-y-6 text-foreground">
      {/* Header */}
      <div className="pb-5 border-b">
        {/* Logo + firm name */}
        <div className="flex items-start gap-5 mb-4">
          {cp?.company_logo && (
            <img
              src={cp.company_logo}
              alt={companyName ?? "Company logo"}
              className="h-16 w-auto max-w-[140px] object-contain shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            {companyName && (
              <p className="text-base font-bold leading-tight">{companyName}</p>
            )}
            {companyAddress && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-start gap-1">
                <MapPin className="h-3 w-3 shrink-0 mt-0.5" />{companyAddress}
              </p>
            )}
            {companyPhone && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Phone className="h-3 w-3 shrink-0" />{companyPhone}
              </p>
            )}
            {cp?.email && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="font-mono text-[10px]">✉</span>{cp.email}
              </p>
            )}
            {companyWeb && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Globe className="h-3 w-3 shrink-0" />{companyWeb}
              </p>
            )}
            {rcicNo && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3 shrink-0" />RCIC License No.&nbsp;<span className="font-mono">{rcicNo}</span>
              </p>
            )}
          </div>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold tracking-wide uppercase">Retainer Agreement</p>
          <p className="text-xs text-muted-foreground">Date: {today}</p>
        </div>
      </div>

      {/* Parties */}
      <section>
        <p className="font-bold mb-2 text-xs uppercase tracking-wide text-primary">1. Parties to this Agreement</p>
        <p>This Retainer Agreement (&quot;Agreement&quot;) is entered into between:</p>
        <ul className="list-disc ml-6 mt-2 space-y-1">
          <li>
            <strong>Immigration Consultant:</strong> {consultantName || "[Consultant Name]"}
            {rcicNo && `, RCIC License No. ${rcicNo}`},
            registered with the College of Immigration and Citizenship Consultants (CICC).
            {companyName && companyName !== consultantName && (
              <>, practising as <strong>{companyName}</strong></>
            )}
          </li>
          <li>
            <strong>Client:</strong> {clientName || "[Client Full Name]"}{clientEmail ? ` (${clientEmail})` : ""}.
          </li>
        </ul>
      </section>

      {/* Scope */}
      <section>
        <p className="font-bold mb-2 text-xs uppercase tracking-wide text-primary">2. Scope of Services</p>
        <p>
          The Consultant agrees to provide professional immigration consulting services for the client&apos;s
          immigration pathway: <strong>{pathway || "[Pathway]"}</strong>.
        </p>
        <p className="mt-2">
          {PATHWAY_TEMPLATES[pathway]?.description ??
            "Services include assessment, application preparation, and submission to relevant Canadian immigration authorities."}
        </p>
        <p className="mt-2 text-xs text-muted-foreground italic">
          Any services outside the scope defined above will require a separate written agreement.
        </p>
      </section>

      {/* Fees */}
      <section>
        <p className="font-bold mb-2 text-xs uppercase tracking-wide text-primary">3. Professional Fees &amp; Payment Milestones</p>
        <p>
          The total professional fee is{" "}
          <strong>{formatCurrency(config.totalFee, config.currency)}</strong> ({config.currency}),
          payable in three milestones:
        </p>
        <div className="mt-3 rounded-lg border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/60">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Milestone</th>
                <th className="text-left px-3 py-2 font-semibold">Trigger</th>
                <th className="text-right px-3 py-2 font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="px-3 py-2">1 ({config.milestone1Pct}%)</td>
                <td className="px-3 py-2">{config.milestone1Label}</td>
                <td className="px-3 py-2 text-right font-medium">{formatCurrency(m1, config.currency)}</td>
              </tr>
              <tr>
                <td className="px-3 py-2">2 ({config.milestone2Pct}%)</td>
                <td className="px-3 py-2">{config.milestone2Label}</td>
                <td className="px-3 py-2 text-right font-medium">{formatCurrency(m2, config.currency)}</td>
              </tr>
              <tr>
                <td className="px-3 py-2">3 ({config.milestone3Pct}%)</td>
                <td className="px-3 py-2">{config.milestone3Label}</td>
                <td className="px-3 py-2 text-right font-medium">{formatCurrency(m3, config.currency)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Client Obligations */}
      <section>
        <p className="font-bold mb-2 text-xs uppercase tracking-wide text-primary">4. Client Obligations</p>
        <ul className="list-disc ml-6 space-y-1">
          <li>Provide all required genuine documents within <strong>{config.docDeadlineDays} calendar days</strong> of request.</li>
          <li>Inform the Consultant immediately of any changes to personal circumstances (address, marital status, employment).</li>
          <li>Providing fraudulent, altered, or misrepresented documents immediately voids this Agreement without refund.</li>
          <li>The Client assumes full responsibility for the accuracy and authenticity of all submitted documents.</li>
        </ul>
      </section>

      {/* Refund Policy */}
      <section>
        <p className="font-bold mb-2 text-xs uppercase tracking-wide text-primary">5. Refund Policy</p>
        <div className="prose prose-sm max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: config.refundPolicy }} />
      </section>

      {/* CICC */}
      <section>
        <p className="font-bold mb-2 text-xs uppercase tracking-wide text-primary">6. Regulatory Compliance</p>
        <p>
          The Consultant is a regulated professional bound by the CICC Code of Professional Ethics and By-Laws.
          Any disputes may be escalated to the College of Immigration and Citizenship Consultants (CICC) at{" "}
          <span className="font-mono text-xs">cicc.ca</span>.
        </p>
      </section>

      {/* Custom Clauses */}
      {!isHtmlEmpty(config.customClauses) && (
        <section>
          <p className="font-bold mb-2 text-xs uppercase tracking-wide text-primary">7. Additional Terms</p>
          <div className="prose prose-sm max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: config.customClauses }} />
        </section>
      )}

      {/* Signatures */}
      <section className="pt-4 border-t">
        <p className="font-bold mb-4 text-xs uppercase tracking-wide text-primary">Signatures</p>
        <div className="grid grid-cols-2 gap-8 text-xs">
          <div>
            <p className="font-semibold mb-2">Immigration Consultant</p>
            {digitalSig ? (
              <div className="mb-1">
                <img
                  src={digitalSig}
                  alt="Consultant signature"
                  className="max-h-16 max-w-[220px] object-contain"
                  style={{ display: "block" }}
                />
              </div>
            ) : (
              <div className="border-b border-dashed mb-1 h-10" />
            )}
            <p className="font-medium">{consultantName || "[Consultant Name]"}</p>
            {rcicNo && <p className="text-muted-foreground">RCIC No. {rcicNo}</p>}
            {companyName && companyName !== consultantName && <p className="text-muted-foreground">{companyName}</p>}
            <p className="text-muted-foreground mt-1">Date: {new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" })}</p>
          </div>
          <div>
            <p className="font-semibold mb-6">Client</p>
            <div className="border-b border-dashed mb-1 h-6" />
            <p>{clientName || "[Client Name]"}</p>
            <p className="text-muted-foreground">Date: ___________</p>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-4 italic">
          The client will receive a secure digital signing link via email. This preview is for consultant review only.
        </p>
      </section>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

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

  const [config, setConfig] = useState<AgreementConfig>(DEFAULT_CONFIG);
  const set = <K extends keyof AgreementConfig>(k: K, v: AgreementConfig[K]) =>
    setConfig(prev => ({ ...prev, [k]: v }));

  // Load case file + client data + consultant profile
  useEffect(() => {
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

        if (caseFile?.agreement_fee)   set("totalFee",      Number(caseFile.agreement_fee));
        if (caseFile?.agreement_notes) set("customClauses", caseFile.agreement_notes);

        setAlreadySent(!!caseFile?.agreement_sent_at);
        setAlreadySentAt(caseFile?.agreement_sent_at ?? null);
        setAlreadySigned(caseFile?.status === "AGREEMENT_SIGNED");

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

  function handleDownloadPdf() {
    const style = document.createElement("style");
    style.id    = "__pdf_print_style";
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

  async function handleSend() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${API}/consultant/clients/${id}/case-file/send-agreement`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          agreement_fee:   config.totalFee,
          agreement_notes: config.customClauses || null,
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

  // ── Milestone amounts ──
  const m1      = Math.round(config.totalFee * config.milestone1Pct / 100);
  const m2      = Math.round(config.totalFee * config.milestone2Pct / 100);
  const m3      = config.totalFee - m1 - m2;
  const pctSum  = config.milestone1Pct + config.milestone2Pct + config.milestone3Pct;

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
    <div className="max-w-4xl mx-auto px-4 py-6">

      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/dashboard/clients/${id}/workspace`}>
          <Button variant="ghost" size="sm" className="gap-1.5 -ml-2">
            <ArrowLeft className="h-4 w-4" />Back to Workspace
          </Button>
        </Link>
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
                              Default {formatCurrency(tmpl.fee, config.currency)}
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
                              <p>Default: <span className="font-medium">{formatCurrency(tmpl.fee, config.currency)}</span></p>
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
                              {formatCurrency(amt, config.currency)}
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
                  <span className="font-semibold text-primary">{formatCurrency(config.totalFee, config.currency)}</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => setStep(3)} className="ml-auto gap-1">
                  <Edit3 className="h-3.5 w-3.5" /> Edit
                </Button>
              </div>

              {/* Resend warning */}
              {alreadySent && !alreadySigned && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 flex items-center gap-3 text-sm text-amber-800">
                  <Clock className="h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">Agreement already sent</p>
                    <p className="text-xs mt-0.5">
                      Sent on {alreadySentAt ? new Date(alreadySentAt).toLocaleString("en-CA") : "\u2014"}.
                      Clicking &quot;Send to Client&quot; will resend with updated details.
                    </p>
                  </div>
                </div>
              )}

              {alreadySigned && (
                <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 flex items-center gap-3 text-sm text-green-800">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <p>The client has already signed. You can resend for records but the case status will not change.</p>
                </div>
              )}

              {/* Agreement Preview */}
              <AgreementPreview
                clientName={clientName}
                clientEmail={clientEmail}
                consultantName={consultantName}
                pathway={pathway}
                config={config}
                consultantProfile={consultantProfile}
              />

              <div className="flex flex-wrap justify-between items-center gap-3">
                <Button variant="outline" onClick={() => setStep(3)}>
                  <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
                </Button>
                <div className="flex items-center gap-3">
                  <Button variant="outline" onClick={handleDownloadPdf} className="gap-2">
                    <Download className="h-4 w-4" /> Download PDF
                  </Button>
                  <Button
                    onClick={handleSend}
                    disabled={sending}
                    className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                  >
                    {sending
                      ? <><Loader2 className="h-4 w-4 animate-spin" /> Sending&hellip;</>
                      : <><Send className="h-4 w-4" /> {alreadySent ? "Resend to Client" : "Send to Client"}</>
                    }
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

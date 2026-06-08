"use client";

import { Building2, Globe, MapPin, Phone } from "lucide-react";
import {
  type AgreementConfig,
  formatAgreementCurrency,
  isHtmlEmpty,
  milestoneAmounts,
  PATHWAY_TEMPLATES,
} from "@/lib/retainer-agreement";

export interface ConsultantProfileDoc {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  rcic_number?: string | null;
  company_name?: string | null;
  company_logo?: string | null;
  company_phone?: string | null;
  company_website?: string | null;
  company_address_line1?: string | null;
  company_address_line2?: string | null;
  company_city?: string | null;
  company_province?: string | null;
  company_postal_code?: string | null;
  company_country?: string | null;
  digital_signature?: string | null;
}

function fmtDate(iso: string | null | undefined, fallback?: string) {
  if (!iso) return fallback ?? "___________";
  return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

export function RetainerAgreementDocument({
  config,
  clientName,
  clientEmail,
  consultantName,
  consultantProfile,
  clientSignature,
  agreementDate,
  clientSignedDate,
  previewNote,
}: {
  config: AgreementConfig;
  clientName: string;
  clientEmail: string;
  consultantName: string;
  consultantProfile: ConsultantProfileDoc | null;
  clientSignature?: string | null;
  agreementDate?: string | null;
  clientSignedDate?: string | null;
  previewNote?: string;
}) {
  const { m1, m2, m3 } = milestoneAmounts(config);
  const cp = consultantProfile;
  const digitalSig = cp?.digital_signature ?? null;
  const companyName = cp?.company_name || consultantName || null;
  const companyAddress = [
    cp?.company_address_line1, cp?.company_address_line2,
    cp?.company_city, cp?.company_province, cp?.company_postal_code, cp?.company_country,
  ].filter(Boolean).join(", ");
  const companyPhone = cp?.company_phone || cp?.phone || null;
  const companyWeb = cp?.company_website || null;
  const rcicNo = cp?.rcic_number || config.consultantLicenseNo || null;
  const pathway = config.pathway || "";
  const scopeText = config.scopeDescription
    || PATHWAY_TEMPLATES[pathway]?.description
    || "Services include assessment, application preparation, and submission to relevant Canadian immigration authorities.";
  const docDate = agreementDate
    ? fmtDate(agreementDate)
    : new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div
      id="retainer-agreement-doc"
      className="mx-auto max-w-3xl space-y-6 rounded-xl border bg-white p-8 text-sm leading-relaxed text-foreground shadow-sm"
    >
      <div className="border-b pb-5">
        <div className="mb-4 flex items-start gap-5">
          {cp?.company_logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cp.company_logo} alt={companyName ?? ""} className="h-16 w-auto max-w-[140px] shrink-0 object-contain" />
          )}
          <div className="min-w-0 flex-1">
            {companyName && <p className="text-base font-bold leading-tight">{companyName}</p>}
            {companyAddress && (
              <p className="mt-0.5 flex items-start gap-1 text-xs text-muted-foreground">
                <MapPin className="mt-0.5 size-3 shrink-0" />{companyAddress}
              </p>
            )}
            {companyPhone && (
              <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Phone className="size-3 shrink-0" />{companyPhone}
              </p>
            )}
            {cp?.email && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <span className="font-mono text-[10px]">✉</span>{cp.email}
              </p>
            )}
            {companyWeb && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Globe className="size-3 shrink-0" />{companyWeb}
              </p>
            )}
            {rcicNo && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Building2 className="size-3 shrink-0" />
                RCIC License No.&nbsp;<span className="font-mono">{rcicNo}</span>
              </p>
            )}
          </div>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold uppercase tracking-wide">Retainer Agreement</p>
          <p className="text-xs text-muted-foreground">Date: {docDate}</p>
        </div>
      </div>

      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">1. Parties to this Agreement</p>
        <p>This Retainer Agreement (&quot;Agreement&quot;) is entered into between:</p>
        <ul className="ml-6 mt-2 list-disc space-y-1">
          <li>
            <strong>Immigration Consultant:</strong> {consultantName || "[Consultant Name]"}
            {rcicNo && `, RCIC License No. ${rcicNo}`}, registered with the College of Immigration and Citizenship Consultants (CICC).
            {companyName && companyName !== consultantName && (
              <>, practising as <strong>{companyName}</strong></>
            )}
          </li>
          <li>
            <strong>Client:</strong> {clientName || "[Client Full Name]"}{clientEmail ? ` (${clientEmail})` : ""}.
          </li>
        </ul>
      </section>

      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">2. Scope of Services</p>
        <p>
          The Consultant agrees to provide professional immigration consulting services for the client&apos;s
          immigration pathway: <strong>{pathway || "[Pathway]"}</strong>.
        </p>
        <p className="mt-2">{scopeText}</p>
        <p className="mt-2 text-xs italic text-muted-foreground">
          Any services outside the scope defined above will require a separate written agreement.
        </p>
      </section>

      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">3. Professional Fees &amp; Payment Milestones</p>
        <p>
          The total professional fee is{" "}
          <strong>{formatAgreementCurrency(config.totalFee, config.currency)}</strong> ({config.currency}),
          payable in three milestones:
        </p>
        <div className="mt-3 overflow-hidden rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/60">
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Milestone</th>
                <th className="px-3 py-2 text-left font-semibold">Trigger</th>
                <th className="px-3 py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="px-3 py-2">1 ({config.milestone1Pct}%)</td>
                <td className="px-3 py-2">{config.milestone1Label}</td>
                <td className="px-3 py-2 text-right font-medium">{formatAgreementCurrency(m1, config.currency)}</td>
              </tr>
              <tr>
                <td className="px-3 py-2">2 ({config.milestone2Pct}%)</td>
                <td className="px-3 py-2">{config.milestone2Label}</td>
                <td className="px-3 py-2 text-right font-medium">{formatAgreementCurrency(m2, config.currency)}</td>
              </tr>
              <tr>
                <td className="px-3 py-2">3 ({config.milestone3Pct}%)</td>
                <td className="px-3 py-2">{config.milestone3Label}</td>
                <td className="px-3 py-2 text-right font-medium">{formatAgreementCurrency(m3, config.currency)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">4. Client Obligations</p>
        <ul className="ml-6 list-disc space-y-1">
          <li>Provide all required genuine documents within <strong>{config.docDeadlineDays} calendar days</strong> of request.</li>
          <li>Inform the Consultant immediately of any changes to personal circumstances (address, marital status, employment).</li>
          <li>Providing fraudulent, altered, or misrepresented documents immediately voids this Agreement without refund.</li>
          <li>The Client assumes full responsibility for the accuracy and authenticity of all submitted documents.</li>
        </ul>
      </section>

      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">5. Refund Policy</p>
        <div className="prose prose-sm max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: config.refundPolicy }} />
      </section>

      <section>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">6. Regulatory Compliance</p>
        <p>
          The Consultant is a regulated professional bound by the CICC Code of Professional Ethics and By-Laws.
          Any disputes may be escalated to the College of Immigration and Citizenship Consultants (CICC) at{" "}
          <span className="font-mono text-xs">cicc.ca</span>.
        </p>
      </section>

      {!isHtmlEmpty(config.customClauses) && (
        <section>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">7. Additional Terms</p>
          <div className="prose prose-sm max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: config.customClauses }} />
        </section>
      )}

      <section className="border-t pt-4">
        <p className="mb-4 text-xs font-bold uppercase tracking-wide text-primary">Signatures</p>
        <div className="grid grid-cols-2 gap-8 text-xs">
          <div>
            <p className="mb-2 font-semibold">Immigration Consultant</p>
            {digitalSig ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={digitalSig} alt="Consultant signature" className="mb-1 max-h-16 max-w-[220px] object-contain" />
            ) : (
              <div className="mb-1 h-10 border-b border-dashed" />
            )}
            <p className="font-medium">{consultantName || "[Consultant Name]"}</p>
            {rcicNo && <p className="text-muted-foreground">RCIC No. {rcicNo}</p>}
            {companyName && companyName !== consultantName && <p className="text-muted-foreground">{companyName}</p>}
            <p className="mt-1 text-muted-foreground">Date: {docDate}</p>
          </div>
          <div>
            <p className="mb-2 font-semibold">Client</p>
            {clientSignature ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={clientSignature} alt="Client signature" className="mb-1 max-h-16 max-w-[220px] object-contain" />
            ) : (
              <div className="mb-1 h-6 border-b border-dashed" />
            )}
            <p>{clientName || "[Client Name]"}</p>
            <p className="text-muted-foreground">
              Date: {clientSignedDate ? fmtDate(clientSignedDate) : "___________"}
            </p>
          </div>
        </div>
        {previewNote && (
          <p className="mt-4 text-[10px] italic text-muted-foreground">{previewNote}</p>
        )}
      </section>
    </div>
  );
}

"use client";

import {
  type AgreementConfig,
  type ClientAgreementDetails,
  cleanAddressText,
  formatAgreementCurrency,
  isHtmlEmpty,
  milestoneAmounts,
  PATHWAY_TEMPLATES,
} from "@/lib/retainer-agreement";
import { cn } from "@/lib/utils";

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

function formatLetterheadAddress(cp: ConsultantProfileDoc | null) {
  if (!cp) return [];
  const lines: string[] = [];
  const line1 = cleanAddressText(cp.company_address_line1);
  const line2 = cleanAddressText(cp.company_address_line2);
  if (line1) lines.push(line1);
  if (line2) lines.push(line2);
  const cityLine = [cp.company_city, cp.company_province, cp.company_postal_code].filter(Boolean).join(", ");
  if (cityLine.trim()) lines.push(cityLine);
  if (cp.company_country?.trim()) lines.push(cp.company_country.trim());
  return lines;
}

function displayCell(value: string | null | undefined) {
  const cleaned = typeof value === "string" ? value.trim() : "";
  if (!cleaned || cleaned === "—") return "—";
  return cleaned;
}

function SectionTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-primary">
      {n}. {children}
    </p>
  );
}

function AgreementLetterhead({
  companyName,
  consultantName,
  consultantProfile,
  rcicNo,
  clientDetails,
  pathway,
  docDate,
}: {
  companyName: string | null;
  consultantName: string;
  consultantProfile: ConsultantProfileDoc | null;
  rcicNo: string | null;
  clientDetails: ClientAgreementDetails;
  pathway: string;
  docDate: string;
}) {
  const cp = consultantProfile;
  const addressLines = formatLetterheadAddress(cp);
  const phone = cp?.company_phone || cp?.phone || null;
  const email = cp?.email || null;
  const website = cp?.company_website || null;
  const displayFirm = companyName || consultantName || "Immigration Consulting Practice";
  const clientName = clientDetails.fullLegalName ?? "—";

  return (
    <header className="mb-6 border-b-2 border-foreground/85 pb-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[88px_minmax(0,1fr)_minmax(180px,240px)] md:items-start md:gap-x-6">
        <div className="flex items-start gap-4 md:contents">
          <div className="shrink-0 md:col-start-1 md:row-start-1">
            {cp?.company_logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cp.company_logo}
                alt={displayFirm}
                className="h-[72px] w-[88px] object-contain object-left"
              />
            ) : (
              <div className="flex size-[72px] items-center justify-center border-2 border-foreground/20 bg-muted/20">
                <span className="font-serif text-2xl font-bold text-foreground/70">
                  {(displayFirm[0] ?? "I").toUpperCase()}
                </span>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 md:col-start-2 md:row-start-1 md:pt-1">
            <p className="font-serif text-lg font-bold leading-tight text-foreground">{displayFirm}</p>
            <p className="mt-1 max-w-sm text-[11px] uppercase leading-snug tracking-[0.12em] text-muted-foreground">
              Regulated Canadian Immigration Consultant
            </p>
            {consultantName && companyName && consultantName !== companyName && (
              <p className="mt-1 text-xs font-medium text-foreground/90">{consultantName}</p>
            )}
          </div>
        </div>

        <div className="border-t border-foreground/10 pt-4 text-[11px] leading-[1.6] text-foreground/85 md:col-start-3 md:row-start-1 md:border-0 md:pt-1 md:text-right">
          {addressLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
          {phone && <p>Tel: {phone}</p>}
          {email && <p>Email: {email}</p>}
          {website && <p className="break-all">Web: {website.replace(/^https?:\/\//, "")}</p>}
          {rcicNo && (
            <p className="mt-1.5 font-semibold text-foreground">RCIC Licence No. {rcicNo}</p>
          )}
        </div>
      </div>

      <div className="mt-8 border-y border-foreground/15 py-5 text-center">
        <h1 className="font-serif text-[1.35rem] font-bold uppercase tracking-[0.22em] text-foreground">
          Retainer Agreement
        </h1>
        <p className="mt-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          For professional immigration consulting services
        </p>
        <p className="mt-3 text-xs text-foreground/80">
          Effective date: <span className="font-medium">{docDate}</span>
          {clientDetails.caseReference && (
            <span className="text-muted-foreground"> · File ref. {clientDetails.caseReference}</span>
          )}
        </p>
      </div>

      <dl className="mt-4 grid gap-3 rounded border border-foreground/10 bg-muted/25 px-4 py-3 text-[11px] sm:grid-cols-3">
        <div className="min-w-0">
          <dt className="font-medium uppercase tracking-wide text-muted-foreground">Client</dt>
          <dd className="mt-0.5 font-semibold text-foreground">{clientName}</dd>
        </div>
        <div className="min-w-0">
          <dt className="font-medium uppercase tracking-wide text-muted-foreground">Immigration pathway</dt>
          <dd className="mt-0.5 font-semibold text-foreground">{pathway || "—"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="font-medium uppercase tracking-wide text-muted-foreground">Consultant</dt>
          <dd className="mt-0.5 font-semibold text-foreground">{consultantName || "—"}</dd>
        </div>
      </dl>
    </header>
  );
}

function PartiesIdentificationTable({
  consultantName,
  companyName,
  consultantProfile,
  rcicNo,
  clientDetails,
  clientEmail,
}: {
  consultantName: string;
  companyName: string | null;
  consultantProfile: ConsultantProfileDoc | null;
  rcicNo: string | null;
  clientDetails: ClientAgreementDetails;
  clientEmail: string;
}) {
  const cp = consultantProfile;
  const consultantAddress = cleanAddressText(formatLetterheadAddress(cp).join(", ")) || "—";
  const clientName = clientDetails.fullLegalName || "[Client Full Legal Name]";

  const rows: { label: string; consultant: string; client: string }[] = [
    { label: "Full legal name", consultant: displayCell(consultantName), client: displayCell(clientName) },
    {
      label: "Business / firm name",
      consultant: companyName && companyName !== consultantName ? displayCell(companyName) : "—",
      client: "—",
    },
    { label: "RCIC licence no.", consultant: displayCell(rcicNo), client: "—" },
    { label: "Email", consultant: displayCell(cp?.email), client: displayCell(clientDetails.email || clientEmail) },
    { label: "Telephone", consultant: displayCell(cp?.company_phone || cp?.phone), client: displayCell(clientDetails.phone) },
    { label: "Residential address", consultant: consultantAddress, client: displayCell(clientDetails.residentialAddress) },
    { label: "Date of birth", consultant: "—", client: displayCell(clientDetails.dateOfBirth) },
    { label: "Passport / travel document no.", consultant: "—", client: displayCell(clientDetails.passportNumber) },
    { label: "Country of citizenship", consultant: "—", client: displayCell(clientDetails.citizenship) },
  ];

  return (
    <div className="mt-3 overflow-hidden rounded-lg border">
      <table className="w-full text-xs">
        <thead className="bg-muted/60">
          <tr>
            <th className="w-[28%] px-3 py-2 text-left font-semibold">Detail</th>
            <th className="px-3 py-2 text-left font-semibold">Immigration Consultant</th>
            <th className="px-3 py-2 text-left font-semibold">Client</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="px-3 py-2 align-top font-medium text-muted-foreground">{row.label}</td>
              <td className="px-3 py-2 align-top">{row.consultant}</td>
              <td className={cn("px-3 py-2 align-top", row.client === "—" && "text-muted-foreground")}>{row.client}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RetainerAgreementDocument({
  config,
  clientName,
  clientEmail,
  consultantName,
  consultantProfile,
  clientDetails,
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
  clientDetails?: ClientAgreementDetails;
  clientSignature?: string | null;
  agreementDate?: string | null;
  clientSignedDate?: string | null;
  previewNote?: string;
}) {
  const { m1, m2, m3 } = milestoneAmounts(config);
  const cp = consultantProfile;
  const digitalSig = cp?.digital_signature ?? null;
  const companyName = cp?.company_name || consultantName || null;
  const rcicNo = cp?.rcic_number || config.consultantLicenseNo || null;
  const pathway = config.pathway || "";
  const scopeText = config.scopeDescription
    || PATHWAY_TEMPLATES[pathway]?.description
    || "Services include assessment, application preparation, and submission to relevant Canadian immigration authorities.";
  const docDate = agreementDate
    ? fmtDate(agreementDate)
    : new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });

  const details: ClientAgreementDetails = {
    fullLegalName: clientDetails?.fullLegalName ?? clientName,
    email: clientDetails?.email ?? clientEmail,
    phone: clientDetails?.phone ?? null,
    dateOfBirth: clientDetails?.dateOfBirth ?? null,
    passportNumber: clientDetails?.passportNumber ?? null,
    citizenship: clientDetails?.citizenship ?? null,
    residentialAddress: cleanAddressText(clientDetails?.residentialAddress) ?? null,
    caseReference: clientDetails?.caseReference ?? null,
  };

  const customSectionNum = 13;

  return (
    <div
      id="retainer-agreement-doc"
      className="mx-auto max-w-3xl space-y-6 rounded-xl border bg-white p-8 text-sm leading-relaxed text-foreground shadow-sm"
    >
      <AgreementLetterhead
        companyName={companyName}
        consultantName={consultantName}
        consultantProfile={cp}
        rcicNo={rcicNo}
        clientDetails={details}
        pathway={pathway}
        docDate={docDate}
      />

      <section>
        <SectionTitle n={1}>Parties to this Agreement</SectionTitle>
        <p>
          This Retainer Agreement (&quot;Agreement&quot;) is made effective as of <strong>{docDate}</strong> between the
          parties identified below. The Consultant is a member in good standing of the College of Immigration and
          Citizenship Consultants (CICC) and provides regulated immigration consulting services in accordance with
          applicable federal and provincial law.
        </p>
        <PartiesIdentificationTable
          consultantName={consultantName}
          companyName={companyName}
          consultantProfile={cp}
          rcicNo={rcicNo}
          clientDetails={details}
          clientEmail={clientEmail}
        />
        <p className="mt-3 text-xs italic text-muted-foreground">
          The Client confirms that the identifying information above is true and complete. The Client must notify the
          Consultant in writing of any change to this information during the term of this Agreement.
        </p>
      </section>

      <section>
        <SectionTitle n={2}>Scope of Services</SectionTitle>
        <p>
          The Consultant agrees to provide professional immigration consulting services relating to the Client&apos;s
          selected immigration pathway: <strong>{pathway || "[Pathway]"}</strong>.
        </p>
        <p className="mt-2">{scopeText}</p>
        <ul className="ml-6 mt-3 list-disc space-y-1 text-xs">
          <li>Reviewing eligibility and advising on suitable immigration options within the agreed pathway.</li>
          <li>Preparing, reviewing, and submitting applications and supporting documentation as agreed.</li>
          <li>Communicating with the Client regarding requests for information, deadlines, and application status.</li>
        </ul>
        <p className="mt-2 text-xs italic text-muted-foreground">
          Services outside this scope — including additional applications, appeals, judicial review, or new pathways —
          require a separate written agreement and fee schedule.
        </p>
      </section>

      <section>
        <SectionTitle n={3}>Professional Fees &amp; Payment Milestones</SectionTitle>
        <p>
          The total professional fee is{" "}
          <strong>{formatAgreementCurrency(config.totalFee, config.currency)}</strong> ({config.currency}),
          exclusive of applicable taxes and government fees, payable in three milestones:
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
        <p className="mt-2 text-xs text-muted-foreground">
          Invoices are due within fourteen (14) calendar days unless otherwise agreed in writing. Late payments may pause
          work until the account is brought current.
        </p>
      </section>

      <section>
        <SectionTitle n={4}>Government &amp; Third-Party Fees</SectionTitle>
        <p>
          Government application fees, biometrics, medical examinations, police certificates, language tests, credential
          assessments, courier charges, translation, and other third-party costs are <strong>not included</strong> in
          the professional fee unless expressly stated in writing. The Client is responsible for paying these amounts
          directly or reimbursing the Consultant when paid on the Client&apos;s behalf.
        </p>
      </section>

      <section>
        <SectionTitle n={5}>Client Obligations</SectionTitle>
        <ul className="ml-6 list-disc space-y-1">
          <li>Provide complete, accurate, and genuine documents within <strong>{config.docDeadlineDays} calendar days</strong> of request.</li>
          <li>Respond promptly to Consultant requests and disclose any change in circumstances material to the application.</li>
          <li>Review drafts carefully and confirm accuracy before submission.</li>
          <li>Refrain from misrepresentation. Fraudulent, altered, or false documents void this Agreement without refund.</li>
          <li>Understand that final decisions rest solely with IRCC, provinces, or other decision-makers — not the Consultant.</li>
        </ul>
      </section>

      <section>
        <SectionTitle n={6}>Consultant Obligations</SectionTitle>
        <ul className="ml-6 list-disc space-y-1">
          <li>Perform services competently, diligently, and in accordance with the CICC Code of Professional Ethics.</li>
          <li>Maintain a client file and provide reasonable updates on progress and outstanding requirements.</li>
          <li>Safeguard Client information and use it only for the purpose of providing agreed services.</li>
          <li>Disclose any conflict of interest and decline or withdraw from representation where required by CICC rules.</li>
        </ul>
      </section>

      <section>
        <SectionTitle n={7}>No Guarantee of Outcome</SectionTitle>
        <p>
          The Consultant does not guarantee approval of any application, visa, permit, nomination, invitation, or
          permanent residence. Processing times, policy changes, and officer discretion are outside the Consultant&apos;s
          control. Advice is based on information provided by the Client and laws in force at the time services are rendered.
        </p>
      </section>

      <section>
        <SectionTitle n={8}>Termination</SectionTitle>
        <p>
          Either party may terminate this Agreement in writing. Fees earned for work completed to the date of termination
          remain payable. Upon termination, the Consultant will provide reasonable transition assistance and return
          original Client documents upon settlement of outstanding fees, subject to applicable trust account and CICC rules.
        </p>
      </section>

      <section>
        <SectionTitle n={9}>Confidentiality &amp; Privacy</SectionTitle>
        <p>
          The Consultant will protect personal information in accordance with applicable privacy legislation, including
          PIPEDA where applicable. Information may be disclosed where required by law or with the Client&apos;s written
          consent. The Client authorizes the Consultant to share application information with IRCC, provinces, and
          designated third parties as necessary to perform the services.
        </p>
      </section>

      <section>
        <SectionTitle n={10}>Refund Policy</SectionTitle>
        <div className="prose prose-sm max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: config.refundPolicy }} />
      </section>

      <section>
        <SectionTitle n={11}>Regulatory Compliance &amp; Dispute Resolution</SectionTitle>
        <p>
          The Consultant is regulated by the College of Immigration and Citizenship Consultants (CICC). Complaints may be
          filed with the CICC at{" "}
          <span className="font-mono text-xs">college-ic.ca</span>. The parties agree to attempt good-faith resolution
          before pursuing external remedies. Nothing in this Agreement limits rights available under CICC By-Laws or
          applicable law.
        </p>
      </section>

      <section>
        <SectionTitle n={12}>General Provisions</SectionTitle>
        <ul className="ml-6 list-disc space-y-1 text-xs">
          <li><strong>Entire agreement:</strong> This document, together with any written amendments signed by both parties, constitutes the entire agreement.</li>
          <li><strong>Amendments:</strong> Changes must be in writing and signed by both parties.</li>
          <li><strong>Assignment:</strong> The Client may not assign this Agreement without the Consultant&apos;s written consent.</li>
          <li><strong>Severability:</strong> If any provision is invalid, the remainder continues in effect.</li>
          <li><strong>Governing law:</strong> This Agreement is governed by the laws of Canada and the province in which the Consultant primarily practises.</li>
        </ul>
      </section>

      {!isHtmlEmpty(config.customClauses) && (
        <section>
          <SectionTitle n={customSectionNum}>Additional Terms</SectionTitle>
          <div className="prose prose-sm max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: config.customClauses }} />
        </section>
      )}

      <section className="border-t pt-4">
        <p className="mb-4 text-xs font-bold uppercase tracking-wide text-primary">Signatures</p>
        <p className="mb-4 text-xs text-muted-foreground">
          By signing below, each party acknowledges that they have read, understood, and agree to be bound by this Agreement.
        </p>
        <div className="grid grid-cols-1 gap-8 text-xs sm:grid-cols-2">
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
            <p>{details.fullLegalName || clientName || "[Client Name]"}</p>
            {(details.email || clientEmail) && (
              <p className="text-muted-foreground">{details.email || clientEmail}</p>
            )}
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

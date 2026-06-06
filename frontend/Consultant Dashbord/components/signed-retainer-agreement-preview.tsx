"use client";

import { Building2, CheckCircle2, Globe, MapPin, Phone } from "lucide-react";

export interface ConsultantProfile {
  name: string;
  email: string;
  phone: string | null;
  rcic_number: string | null;
  company_name: string | null;
  company_logo: string | null;
  company_phone: string | null;
  company_website: string | null;
  company_address_line1: string | null;
  company_address_line2: string | null;
  company_city: string | null;
  company_province: string | null;
  company_postal_code: string | null;
  company_country: string | null;
  digital_signature: string | null;
}

export interface AgreementData {
  case_file: {
    id: number;
    status: string;
    immigration_pathway: string | null;
    agreement_sent_at: string | null;
    agreement_signed_at: string | null;
    agreement_fee: number | null;
    agreement_notes: string | null;
    client_signature: string | null;
    signed_document_path: string | null;
  };
  client_name: string | null;
  client_email: string | null;
  consultant_name: string | null;
  consultant_profile: ConsultantProfile | null;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(amount);
}

function fmtDate(iso: string | null) {
  if (!iso) return "___________";
  return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
}

export function SignedRetainerAgreementPreview({
  data,
  clientSignature,
}: {
  data: AgreementData;
  clientSignature?: string | null;
}) {
  const cf = data.case_file;
  const cp = data.consultant_profile;
  const signature = clientSignature ?? cf.client_signature;
  const pathway = cf.immigration_pathway ?? "";
  const totalFee = cf.agreement_fee ? Number(cf.agreement_fee) : 3000;
  const m1Amt = Math.round(totalFee * 0.30);
  const m2Amt = Math.round(totalFee * 0.40);
  const m3Amt = totalFee - m1Amt - m2Amt;
  const companyName = cp?.company_name || data.consultant_name || null;
  const companyAddr = [
    cp?.company_address_line1,
    cp?.company_address_line2,
    cp?.company_city,
    cp?.company_province,
    cp?.company_postal_code,
    cp?.company_country,
  ].filter(Boolean).join(", ");
  const rcicNo = cp?.rcic_number || null;
  const today = new Date().toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" });
  const signedOn = cf.agreement_signed_at ? fmtDate(cf.agreement_signed_at) : null;
  const sentOn = cf.agreement_sent_at ? fmtDate(cf.agreement_sent_at) : today;

  return (
    <div className="rounded-xl border bg-white p-8 text-sm leading-relaxed shadow-sm space-y-6 text-foreground">
      <div className="pb-5 border-b">
        <div className="flex items-start gap-5 mb-4">
          {cp?.company_logo && (
            <img src={cp.company_logo} alt={companyName ?? ""} className="h-16 w-auto max-w-[140px] object-contain shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            {companyName && <p className="text-base font-bold leading-tight">{companyName}</p>}
            {companyAddr && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-start gap-1">
                <MapPin className="h-3 w-3 shrink-0 mt-0.5" />{companyAddr}
              </p>
            )}
            {(cp?.company_phone || cp?.phone) && (
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                <Phone className="h-3 w-3 shrink-0" />{cp?.company_phone ?? cp?.phone}
              </p>
            )}
            {cp?.email && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="font-mono text-[10px]">✉</span>{cp.email}
              </p>
            )}
            {cp?.company_website && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Globe className="h-3 w-3 shrink-0" />{cp.company_website}
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
          <p className="text-xs text-muted-foreground">Date: {sentOn}</p>
        </div>
      </div>

      <section>
        <p className="font-bold mb-2 text-xs uppercase tracking-wide text-primary">1. Parties to this Agreement</p>
        <p>This Retainer Agreement (&quot;Agreement&quot;) is entered into between:</p>
        <ul className="list-disc ml-6 mt-2 space-y-1">
          <li>
            <strong>Immigration Consultant:</strong> {data.consultant_name || "[Consultant Name]"}
            {rcicNo && `, RCIC License No. ${rcicNo}`}, registered with the College of Immigration and Citizenship Consultants (CICC).
            {companyName && companyName !== data.consultant_name && (
              <>, practising as <strong>{companyName}</strong></>
            )}
          </li>
          <li>
            <strong>Client:</strong> {data.client_name || "[Client Full Name]"}
            {data.client_email ? ` (${data.client_email})` : ""}.
          </li>
        </ul>
      </section>

      <section>
        <p className="font-bold mb-2 text-xs uppercase tracking-wide text-primary">2. Scope of Services</p>
        <p>
          The Consultant agrees to provide professional immigration consulting services for the client&apos;s
          immigration pathway: <strong>{pathway || "[Pathway]"}</strong>.
        </p>
        <p className="mt-2 text-xs text-muted-foreground italic">
          Any services outside the scope defined above will require a separate written agreement.
        </p>
      </section>

      <section>
        <p className="font-bold mb-2 text-xs uppercase tracking-wide text-primary">3. Professional Fees &amp; Payment Milestones</p>
        <p>
          The total professional fee is <strong>{formatCurrency(totalFee)}</strong> (CAD), payable in three milestones:
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
                <td className="px-3 py-2">1 (30%)</td>
                <td className="px-3 py-2">Upon signing this agreement (Retainer Fee)</td>
                <td className="px-3 py-2 text-right font-medium">{formatCurrency(m1Amt)}</td>
              </tr>
              <tr>
                <td className="px-3 py-2">2 (40%)</td>
                <td className="px-3 py-2">Upon receiving an ITA, provincial nomination, or equivalent approval</td>
                <td className="px-3 py-2 text-right font-medium">{formatCurrency(m2Amt)}</td>
              </tr>
              <tr>
                <td className="px-3 py-2">3 (30%)</td>
                <td className="px-3 py-2">Before final application submission to IRCC</td>
                <td className="px-3 py-2 text-right font-medium">{formatCurrency(m3Amt)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <p className="font-bold mb-2 text-xs uppercase tracking-wide text-primary">4. Client Obligations</p>
        <ul className="list-disc ml-6 space-y-1">
          <li>Provide all required genuine documents within <strong>14 calendar days</strong> of request.</li>
          <li>Inform the Consultant immediately of any changes to personal circumstances.</li>
          <li>Providing fraudulent documents immediately voids this Agreement without refund.</li>
          <li>The Client assumes full responsibility for accuracy of all submitted documents.</li>
        </ul>
      </section>

      <section>
        <p className="font-bold mb-2 text-xs uppercase tracking-wide text-primary">5. Refund Policy</p>
        <p>
          The retainer fee (Milestone 1) is non-refundable once work has commenced.
          Milestones 2 and 3 are not payable if the corresponding government action does not occur.
          No refund will be issued if the application is refused due to fraudulent documents provided by the client.
        </p>
      </section>

      <section>
        <p className="font-bold mb-2 text-xs uppercase tracking-wide text-primary">6. Regulatory Compliance</p>
        <p>
          The Consultant is a regulated professional bound by the CICC Code of Professional Ethics and By-Laws.
          Disputes may be escalated to the College of Immigration and Citizenship Consultants at{" "}
          <span className="font-mono text-xs">cicc.ca</span>.
        </p>
      </section>

      {cf.agreement_notes && cf.agreement_notes.replace(/<[^>]*>/g, "").trim() !== "" && (
        <section>
          <p className="font-bold mb-2 text-xs uppercase tracking-wide text-primary">7. Additional Terms</p>
          <div className="prose prose-sm max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: cf.agreement_notes }} />
        </section>
      )}

      <section className="pt-4 border-t">
        <p className="font-bold mb-4 text-xs uppercase tracking-wide text-primary">Signatures</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 text-xs">
          <div>
            <p className="font-semibold mb-2">Immigration Consultant</p>
            {cp?.digital_signature ? (
              <img src={cp.digital_signature} alt="Consultant signature" className="max-h-16 max-w-[220px] object-contain mb-1" />
            ) : (
              <div className="border-b border-dashed mb-1 h-10" />
            )}
            <p className="font-medium">{data.consultant_name || "[Consultant Name]"}</p>
            {rcicNo && <p className="text-muted-foreground">RCIC No. {rcicNo}</p>}
            {companyName && companyName !== data.consultant_name && (
              <p className="text-muted-foreground">{companyName}</p>
            )}
            <p className="text-muted-foreground mt-1">Date: {sentOn}</p>
          </div>
          <div>
            <p className="font-semibold mb-2">Client</p>
            {signature ? (
              <img src={signature} alt="Client signature" className="max-h-16 max-w-[220px] object-contain mb-1" />
            ) : (
              <div className="border-b border-dashed mb-1 h-10" />
            )}
            <p>{data.client_name || "[Client Name]"}</p>
            <p className="text-muted-foreground mt-1">Date: {signedOn ?? "___________"}</p>
          </div>
        </div>
        {cf.signed_document_path && (
          <p className="text-[10px] text-muted-foreground mt-3 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            Signed PDF uploaded by client.
          </p>
        )}
      </section>
    </div>
  );
}

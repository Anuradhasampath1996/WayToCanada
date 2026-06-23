"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type ConsultantBranding = {
  name?: string;
  email?: string;
  phone?: string;
  rcic_number?: string;
  company_name?: string;
  company_logo?: string | null;
  company_phone?: string;
  company_website?: string;
  formatted_address?: string;
  digital_signature?: string | null;
};

export type LetterClientPreview = {
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  immigration_pathway?: string;
  passport_number?: string;
};

type LetterDocumentPreviewProps = {
  branding: ConsultantBranding | null;
  subject?: string;
  bodyHtml?: string;
  client?: LetterClientPreview | null;
  className?: string;
};

function formatDate(): string {
  return new Date().toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export const LetterDocumentPreview = React.forwardRef<HTMLDivElement, LetterDocumentPreviewProps>(
  function LetterDocumentPreview(
    { branding, subject, bodyHtml, client, className },
    ref,
  ) {
    const companyName = branding?.company_name || branding?.name || "Your Company";
    const consultantName = branding?.name || "";
    const phone = branding?.company_phone || branding?.phone;
    const letterDate = formatDate();

    const clientReLine = client?.client_name
      ? [
          client.client_name,
          client.immigration_pathway ? `${client.immigration_pathway} Application` : null,
        ]
          .filter(Boolean)
          .join(" — ")
      : null;

    return (
      <div
        ref={ref}
        className={cn(
          "mx-auto w-full max-w-[816px] bg-white px-10 py-10 text-[#111827]",
          "font-[Georgia,Times_New_Roman,serif]",
          className,
        )}
      >
        <div className="mb-8 flex items-start justify-between gap-8">
          <div className="flex min-h-[88px] shrink-0 items-center">
            {branding?.company_logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={branding.company_logo}
                alt="Company logo"
                className="h-[88px] w-auto max-w-[200px] object-contain object-left"
              />
            ) : null}
          </div>
          <div className="min-w-0 flex-1 text-right text-[11pt] leading-[1.6] text-[#374151]">
            <p className="text-[13pt] font-bold text-[#111827]">{companyName}</p>
            {consultantName && consultantName !== companyName && (
              <p className="font-semibold">{consultantName}</p>
            )}
            {branding?.formatted_address && <p>{branding.formatted_address}</p>}
            {phone && <p>Tel: {phone}</p>}
            {branding?.email && <p>{branding.email}</p>}
            {branding?.company_website && <p>{branding.company_website}</p>}
            {branding?.rcic_number && <p>RCIC License No. {branding.rcic_number}</p>}
          </div>
        </div>

        <p className="mb-8 text-right text-[11pt] text-[#374151]">{letterDate}</p>

        {clientReLine && (
          <p className="mb-1 text-[11pt] leading-[1.6]">
            <span className="font-semibold">Re:</span> {clientReLine}
          </p>
        )}

        {subject && (
          <p className="mb-6 text-[11pt] leading-[1.6]">
            <span className="font-semibold">Subject:</span> {subject}
          </p>
        )}

        {bodyHtml ? (
          <div
            className="text-[11pt] leading-[1.7] text-[#111827] [&_li]:mb-1 [&_p]:mb-3 [&_ul]:my-2 [&_ul]:pl-6"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        ) : (
          <p className="text-[11pt] italic text-[#6b7280]">
            Letter body will appear here after you generate or type content.
          </p>
        )}

        <div className="mt-10 text-[11pt] leading-[1.6] text-[#374151]">
          {branding?.digital_signature ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.digital_signature}
              alt="Signature"
              className="mb-3 h-[72px] w-auto max-w-[220px] object-contain object-left"
            />
          ) : null}
          <p className="font-semibold text-[#111827]">{consultantName}</p>
          {branding?.rcic_number && (
            <>
              <p>Regulated Canadian Immigration Consultant (RCIC)</p>
              <p>License No. {branding.rcic_number}</p>
            </>
          )}
          {companyName && <p>{companyName}</p>}
          {(phone || branding?.email) && (
            <p>{[phone, branding?.email].filter(Boolean).join(" · ")}</p>
          )}
        </div>

        <p className="mt-12 text-center text-[8pt] text-[#9ca3af]">
          Confidential — prepared by {companyName}
          {branding?.rcic_number ? ` · RCIC ${branding.rcic_number}` : ""} · {letterDate}
        </p>
      </div>
    );
  },
);

"use client";

import { Scale } from "lucide-react";
import { LegislationLinkChips, type LegislationLink } from "@/components/legislation/legislation-link-chips";

export function WorkspaceRelevantLegislation({
  sections,
  onLinkClick,
}: {
  sections: LegislationLink[];
  onLinkClick?: (link: LegislationLink) => void;
}) {
  if (!sections.length) return null;

  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-border/70 bg-muted/20 p-3">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Scale className="h-3.5 w-3.5 shrink-0" />
        Relevant legislation for this case
      </p>
      <ul className="mt-2 space-y-2">
        {sections.map((row) => (
          <li key={`${row.act_code}-${row.provision_key}`} className="text-sm">
            <p className="font-medium leading-snug break-words">{row.citation}</p>
            {row.reason && <p className="text-xs text-muted-foreground">{row.reason}</p>}
            {row.marginal_note && (
              <p className="text-[11px] italic text-muted-foreground">{row.marginal_note}</p>
            )}
          </li>
        ))}
      </ul>
      <LegislationLinkChips links={sections} onLinkClick={onLinkClick} />
    </section>
  );
}

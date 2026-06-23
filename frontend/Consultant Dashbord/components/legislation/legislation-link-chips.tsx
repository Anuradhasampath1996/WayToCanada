"use client";

import Link from "next/link";
import { Scale } from "lucide-react";
import { Button } from "@/components/ui/button";

export type LegislationLink = {
  citation?: string;
  act_code?: string;
  provision_key?: string;
  hub_path?: string | null;
  reason?: string | null;
  marginal_note?: string | null;
};

export function LegislationLinkChips({
  links,
  compact = false,
  onLinkClick,
}: {
  links: LegislationLink[];
  compact?: boolean;
  /** When set, opens inline popup instead of navigating away */
  onLinkClick?: (link: LegislationLink) => void;
}) {
  const visible = links.filter((l) => l.act_code && l.provision_key);
  if (visible.length === 0) return null;

  return (
    <div className={compact ? "mt-1.5 flex flex-wrap gap-1" : "mt-2 flex flex-wrap gap-1.5"}>
      {visible.map((link) => {
        const label = link.citation ?? `${link.act_code} ${link.provision_key}`;
        const className = compact ? "h-6 rounded-md px-2 text-[10px]" : "h-7 rounded-lg text-[11px]";

        if (onLinkClick) {
          return (
            <Button
              key={`${link.act_code}-${link.provision_key}`}
              type="button"
              size="sm"
              variant="outline"
              className={className}
              onClick={() => onLinkClick(link)}
            >
              <Scale className={compact ? "mr-1 h-3 w-3" : "mr-1 h-3.5 w-3.5"} />
              {label}
            </Button>
          );
        }

        if (!link.hub_path) return null;

        return (
          <Button
            key={`${link.act_code}-${link.provision_key}-${link.hub_path}`}
            asChild
            size="sm"
            variant="outline"
            className={className}
          >
            <Link href={link.hub_path}>
              <Scale className={compact ? "mr-1 h-3 w-3" : "mr-1 h-3.5 w-3.5"} />
              {label}
            </Link>
          </Button>
        );
      })}
    </div>
  );
}

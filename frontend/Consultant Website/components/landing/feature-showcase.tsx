"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchWebsiteFeatures, type WebsiteFeatureSection } from "@/lib/website-features";
import { FeatureMedia } from "./feature-media-mock";
import { cn } from "@/lib/utils";

function resolveIcon(name: string): LucideIcon {
  const icons = LucideIcons as unknown as Record<string, LucideIcon>;
  return icons[name] ?? LucideIcons.Sparkles;
}

function LeanSection({
  section,
  index,
}: {
  section: WebsiteFeatureSection;
  index: number;
}) {
  const Icon = resolveIcon(section.icon);
  const mediaRight = index % 2 === 0;
  const bullets = section.bullet_points ?? [];
  const altBg = index % 2 === 1;

  return (
    <section
      id={section.slug}
      className={cn(
        "scroll-mt-24 border-y border-emerald-500/5 py-14 lg:py-20",
        altBg ? "bg-emerald-50/40" : "bg-white",
      )}
    >
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
        <div className={cn(mediaRight ? "lg:order-1" : "lg:order-2")}>
          {section.subtitle && (
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">{section.subtitle}</p>
          )}
          <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">{section.title}</h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground lg:text-lg">{section.description}</p>
          {bullets.length > 0 && (
            <ul className="mt-6 space-y-2.5">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-sm text-foreground/90">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  {b}
                </li>
              ))}
            </ul>
          )}
          <Button className="mt-8 rounded-xl bg-emerald-600 hover:bg-emerald-700" asChild>
            <Link href="/register">
              Get started free <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className={cn("relative", mediaRight ? "lg:order-2" : "lg:order-1")}>
          <div className="absolute -left-2 -top-2 z-10 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-lg">
            <Icon className="h-5 w-5" />
          </div>
          <FeatureMedia
            mediaType={section.media_type}
            mediaUrl={section.media_url}
            mockVariant={section.mock_variant}
            alt={section.media_alt ?? section.title}
          />
        </div>
      </div>
    </section>
  );
}

export function FeatureShowcase() {
  const [sections, setSections] = useState<WebsiteFeatureSection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWebsiteFeatures()
      .then(setSections)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div id="features" className="flex justify-center py-24">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <section id="features" className="py-16 text-center text-muted-foreground">
        Platform features coming soon.
      </section>
    );
  }

  return (
    <div id="features">
      <div className="border-b border-emerald-500/10 bg-white py-12 text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Our platform</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Everything in one system</h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          Scroll through each module — built for modern RCIC workflows from first invite to final submission.
        </p>
      </div>
      {sections.map((section, index) => (
        <LeanSection key={section.id} section={section} index={index} />
      ))}
    </div>
  );
}

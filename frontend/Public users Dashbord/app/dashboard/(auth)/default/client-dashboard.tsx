"use client";

import Link from "next/link";
import {
  Loader2, AlertCircle, RefreshCw, UserCheck, Mail, Phone, Award,
  MapPin, ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useClientJourney } from "@/context/client-journey-context";
import { ClientJourneyTimeline, ClientNextStepCard } from "@/components/client-journey-ui";
import { clientStatusLabel } from "@/lib/client-journey";

function ConsultantCard({ consultant }: {
  consultant: { name: string; email: string; phone?: string | null; rcic_number?: string | null; avatar?: string | null };
}) {
  const initials = consultant.name
    .split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

  return (
    <div className="rounded-xl border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Your consultant</p>
      <div className="flex items-start gap-4">
        {consultant.avatar ? (
          <img src={consultant.avatar} alt={consultant.name}
            className="h-14 w-14 rounded-full object-cover shrink-0 border-2 border-primary/20" />
        ) : (
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border-2 border-primary/20">
            <span className="text-lg font-bold text-primary">{initials}</span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base truncate">{consultant.name}</h3>
          {consultant.rcic_number && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Award className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-xs text-primary font-medium">RCIC — {consultant.rcic_number}</span>
            </div>
          )}
          <div className="mt-3 space-y-1.5">
            <a href={`mailto:${consultant.email}`}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{consultant.email}</span>
            </a>
            {consultant.phone && (
              <a href={`tel:${consultant.phone}`}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span>{consultant.phone}</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NoConsultantBanner({ name }: { name: string }) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center space-y-3 max-w-lg mx-auto">
      <div className="flex justify-center">
        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
          <UserCheck className="h-7 w-7 text-muted-foreground" />
        </div>
      </div>
      <h3 className="font-semibold text-lg">Welcome, {name}!</h3>
      <p className="text-muted-foreground text-sm">
        You&apos;re registered but not assigned to a consultant yet. Someone from Way To Canada will contact you soon.
      </p>
      <div className="flex items-center justify-center gap-2 pt-1 text-sm text-primary font-medium">
        <MapPin className="h-4 w-4" /> Way To Canada Immigration Services
      </div>
    </div>
  );
}

export function ClientDashboard() {
  const {
    loading, error, refresh, consultant, client, caseFile, steps, currentStepId, progressPercent,
  } = useClientJourney();

  const firstName = (client?.name ?? "there").split(" ")[0];
  const currentStep = steps.find((s) => s.id === currentStepId) ?? steps.find((s) => s.status === "active");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-40 text-center gap-4">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="text-lg font-semibold">{error}</p>
        <Button variant="outline" onClick={refresh}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full pb-10">
      {/* Header + progress */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Hi {firstName} 👋</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Follow the 4 steps below — we&apos;ll guide you through your immigration case.
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={refresh} aria-label="Refresh">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {consultant && caseFile && (
          <div className="rounded-xl border bg-card p-4 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[140px]">
              <p className="text-xs text-muted-foreground mb-1">Overall progress</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden max-w-xs">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className="text-sm font-bold tabular-nums">{progressPercent}%</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="outline">{clientStatusLabel(caseFile.status)}</Badge>
              {caseFile.immigration_pathway && (
                <Badge variant="secondary" className="font-normal">{caseFile.immigration_pathway}</Badge>
              )}
            </div>
          </div>
        )}
      </div>

      {!consultant && <NoConsultantBanner name={firstName} />}

      {consultant && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5 order-2 lg:order-1">
            <ClientNextStepCard step={currentStep} />
            <ClientJourneyTimeline steps={steps} highlightId={currentStepId} />

            {!caseFile && (
              <div className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
                Your consultant is setting up your case file. You can start with the questionnaire now.
                <Button size="sm" variant="outline" className="mt-3" asChild>
                  <Link href="/user-dashboard/questionnaire">
                    Start questionnaire <ChevronRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            )}
          </div>

          <div className="lg:col-span-1 space-y-5 order-1 lg:order-2">
            <ConsultantCard consultant={consultant} />
            <div className="rounded-xl border p-4 text-xs text-muted-foreground space-y-2">
              <p className="font-semibold text-foreground text-sm">How it works</p>
              <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                <li>Complete your questionnaire</li>
                <li>Sign the retainer when sent</li>
                <li>Submit assigned IRCC forms</li>
                <li>Upload documents & chat with your consultant</li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

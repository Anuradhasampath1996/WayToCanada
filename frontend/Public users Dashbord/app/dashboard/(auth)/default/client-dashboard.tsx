"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Loader2, AlertCircle,
  CheckCircle2, GraduationCap, BookOpen,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useClientJourney } from "@/context/client-journey-context";
import {
  ClientJourneyOverviewPanel,
} from "@/components/client-journey-ui";
import { ClientActionCenter } from "@/components/client-action-center";
import { ConsultantPicker } from "@/components/consultant-picker";

const LMS_API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/v1`;

function lmsToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("wtc_token") ?? document.cookie.match(/wtc_token=([^;]+)/)?.[1] ?? "";
}

function LearningCoursesCard() {
  const [courses, setCourses] = useState<{ assignment_id: number; course: { title: string; category?: string }; progress_percent: number }[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch(`${LMS_API}/client/lms/courses`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${lmsToken()}` },
    })
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((d) => setCourses(d.data ?? []))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded || courses.length === 0) return null;

  return (
    <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/[0.04] p-5">
      <div className="flex items-center gap-2">
        <GraduationCap className="h-5 w-5 text-primary" />
        <p className="font-semibold">Exam prep courses</p>
        <Badge className="ml-auto">{courses.length}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Your consultant assigned {courses.length} learning course{courses.length === 1 ? "" : "s"} for exam preparation.
      </p>
      <ul className="space-y-2">
        {courses.slice(0, 3).map((c) => (
          <li key={c.assignment_id} className="flex items-center justify-between gap-2 rounded-lg border bg-background/80 px-3 py-2 text-sm">
            <span className="truncate font-medium">{c.course.title}</span>
            <span className="shrink-0 text-muted-foreground">{c.progress_percent}%</span>
          </li>
        ))}
      </ul>
      <Button className="w-full" asChild>
        <Link href="/user-dashboard/learning">
          <BookOpen className="mr-2 h-4 w-4" />
          Open learning portal
        </Link>
      </Button>
    </div>
  );
}

export function ClientDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const showSubmittedBanner = searchParams.get("questionnaire") === "submitted";

  const {
    loading, error, refresh, consultant, pendingRequest, client, steps, currentStepId,
  } = useClientJourney();

  const firstName = (client?.name ?? "there").split(" ")[0];
  const currentStep =
    steps.find((s) => s.id === currentStepId)
    ?? steps.find((s) => s.status === "active")
    ?? steps[0];

  useEffect(() => {
    if (!showSubmittedBanner) return;
    const t = setTimeout(() => router.replace("/user-dashboard"), 8000);
    return () => clearTimeout(t);
  }, [showSubmittedBanner, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-40 text-center">
        <AlertCircle className="h-10 w-10 text-red-400" />
        <p className="text-lg font-semibold">{error}</p>
        <Button variant="outline" onClick={refresh}>Try again</Button>
      </div>
    );
  }

  return (
    <div className="min-w-0 w-full space-y-8 overflow-x-hidden pb-10">
      {showSubmittedBanner && (
        <div className="rounded-2xl border border-primary/20 bg-primary/[0.06] p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CheckCircle2 className="size-4 shrink-0 text-primary" />
            Questionnaire submitted successfully
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Thank you! Your consultant will review your profile and confirm your immigration pathway.
          </p>
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-bold tracking-tight text-foreground sm:text-3xl">
            Hi {firstName}
          </h1>
          <p className="mt-1.5 max-w-xl text-[15px] text-muted-foreground">
            {consultant
              ? "Follow the 4 simple steps — we’ll guide you through each stage."
              : "Find a licensed RCIC to start your immigration journey."}
          </p>
        </div>
      </div>

      {!consultant && (
        <ConsultantPicker
          clientName={firstName}
          pendingRequest={pendingRequest}
          onUpdated={refresh}
        />
      )}

      {consultant && (
        <div className="space-y-6">
          <ClientJourneyOverviewPanel
            steps={steps}
            currentStep={currentStep}
            highlightId={currentStepId}
          />

          <LearningCoursesCard />

          <ClientActionCenter hideJourneyDuplicates />
        </div>
      )}
    </div>
  );
}

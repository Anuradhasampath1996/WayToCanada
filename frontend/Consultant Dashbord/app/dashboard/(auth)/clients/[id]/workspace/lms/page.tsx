"use client";

import * as React from "react";
import Link from "next/link";
import { Lock, GraduationCap, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WorkspaceSubpageHero } from "../workspace-subpage-hero";
import { LMS_WORKSPACE_PAGE } from "../workspace-flow-ui";
import {
  LmsAssignmentGridCard,
  LmsAvailableCoursePicker,
  type LmsAssignmentItem,
} from "./lms-assignment-card";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/v1`;

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : "";
  return { Accept: "application/json", Authorization: `Bearer ${token}` };
}

export default function ClientLmsPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = React.useState("");
  const [assignments, setAssignments] = React.useState<LmsAssignmentItem[]>([]);
  const [courses, setCourses] = React.useState<{
    id: number;
    title: string;
    thumbnail_url?: string | null;
    description?: string | null;
    price_cents?: number | null;
    currency?: string | null;
    category?: { name: string };
  }[]>([]);
  const [courseId, setCourseId] = React.useState("");
  const [pathwayLocked, setPathwayLocked] = React.useState(false);
  const [pathway, setPathway] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [assignBusy, setAssignBusy] = React.useState(false);

  React.useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  const load = React.useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setPathwayLocked(false);

    const cfRes = await fetch(`${API}/consultant/clients/${id}/case-file`, { headers: authHeaders() });
    const cfJson = await cfRes.json().catch(() => ({}));
    const pathwayName = cfJson.case_file?.immigration_pathway ?? null;
    setPathway(pathwayName);

    if (!cfRes.ok || !pathwayName) {
      setPathwayLocked(true);
      setAssignments([]);
      setCourses([]);
      setLoading(false);
      return;
    }

    const [aRes, cRes] = await Promise.all([
      fetch(`${API}/consultant/clients/${id}/lms`, { headers: authHeaders() }),
      fetch(`${API}/consultant/lms/client-courses`, { headers: authHeaders() }),
    ]);

    if (aRes.status === 403) {
      setPathwayLocked(true);
      setAssignments([]);
      setCourses([]);
      setLoading(false);
      return;
    }

    setAssignments((await aRes.json()).data ?? []);
    setCourses((await cRes.json()).data ?? []);
    setLoading(false);
  }, [id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function assign() {
    if (!courseId || pathwayLocked || assignBusy) return;
    setAssignBusy(true);
    try {
      await fetch(`${API}/consultant/clients/${id}/lms/assign`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: Number(courseId) }),
      });
      setCourseId("");
      await load();
    } finally {
      setAssignBusy(false);
    }
  }

  async function unassign(assignmentId: number) {
    await fetch(`${API}/consultant/clients/${id}/lms/assignments/${assignmentId}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    void load();
  }

  const avgProgress =
    assignments.length === 0
      ? 0
      : Math.round(assignments.reduce((sum, a) => sum + (a.progress_percent || 0), 0) / assignments.length);

  return (
    <div className="min-w-0 w-full overflow-x-hidden pb-6">
      <WorkspaceSubpageHero
        profileId={id}
        stepLabel={LMS_WORKSPACE_PAGE.stepLabel}
        title={LMS_WORKSPACE_PAGE.title}
        description={LMS_WORKSPACE_PAGE.description}
        illustration={LMS_WORKSPACE_PAGE.illustration}
        illustrationAlt={LMS_WORKSPACE_PAGE.illustrationAlt}
        backLabel="Back to case workspace"
        className="mb-5 sm:mb-6"
      >
        <Badge variant="outline" className="h-8 gap-1.5 rounded-xl px-3 text-xs">
          <GraduationCap className="size-3.5 text-emerald-600" />
          Client learning
        </Badge>
        {pathway && (
          <Badge variant="outline" className="h-8 rounded-xl px-3 text-xs">
            {pathway}
          </Badge>
        )}
        {!loading && !pathwayLocked && (
          <Badge className="h-8 rounded-xl border-0 bg-emerald-700 px-3 text-xs text-white hover:bg-emerald-700">
            {assignments.length} assigned
          </Badge>
        )}
      </WorkspaceSubpageHero>

      {loading && (
        <div className="rounded-2xl border bg-card/60 py-16 text-center text-sm text-muted-foreground">
          Loading exam prep courses…
        </div>
      )}

      {!loading && pathwayLocked && (
        <Card className="overflow-hidden border-amber-200/80 bg-[linear-gradient(180deg,rgba(245,158,11,0.06),transparent)] shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700 ring-1 ring-amber-500/20">
              <Lock className="size-7" />
            </span>
            <div className="max-w-md space-y-2">
              <p className="text-lg font-semibold tracking-tight">Pathway required</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Assign an immigration pathway in the workspace before assigning exam prep courses to this client.
              </p>
            </div>
            <Button asChild className="rounded-xl">
              <Link href={`/dashboard/clients/${id}/workspace/pathway-calculator`}>
                Open pathway calculator
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !pathwayLocked && (
        <div className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Assigned</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{assignments.length}</p>
            </div>
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Avg progress</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{avgProgress}%</p>
            </div>
            <div className="rounded-2xl border bg-card p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Catalog</p>
              <p className="mt-1 text-sm text-muted-foreground">Client exam courses only</p>
            </div>
          </div>

          <LmsAvailableCoursePicker
            courses={courses}
            courseId={courseId}
            onCourseIdChange={setCourseId}
            onAssign={() => void assign()}
            assignBusy={assignBusy}
            assignedCourseIds={assignments.map((a) => a.course?.id).filter(Boolean) as number[]}
          />

          <div>
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold tracking-tight">Assigned exam courses</h2>
                <p className="text-xs text-muted-foreground">Track progress and quiz results for this client.</p>
              </div>
              <Badge variant="outline" className="gap-1 rounded-full">
                <Sparkles className="size-3 text-emerald-600" />
                {assignments.length} course{assignments.length === 1 ? "" : "s"}
              </Badge>
            </div>

            {assignments.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-muted/20 py-16 text-center">
                <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700">
                  <GraduationCap className="size-6" />
                </span>
                <p className="text-sm font-medium">No courses assigned yet</p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  Select a published course above and assign it to start this client&apos;s exam prep.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {assignments.map((a) => (
                  <LmsAssignmentGridCard
                    key={a.id}
                    assignment={a}
                    onUnassign={(assignmentId) => void unassign(assignmentId)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

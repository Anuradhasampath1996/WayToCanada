"use client";

import * as React from "react";
import Link from "next/link";
import { Lock, GraduationCap } from "lucide-react";
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
    category?: { name: string };
  }[]>([]);
  const [courseId, setCourseId] = React.useState("");
  const [pathwayLocked, setPathwayLocked] = React.useState(false);
  const [pathway, setPathway] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => { params.then((p) => setId(p.id)); }, [params]);

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
      fetch(`${API}/consultant/lms/courses`, { headers: authHeaders() }),
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

  React.useEffect(() => { void load(); }, [load]);

  async function assign() {
    if (!courseId || pathwayLocked) return;
    await fetch(`${API}/consultant/clients/${id}/lms/assign`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ course_id: Number(courseId) }),
    });
    setCourseId("");
    void load();
  }

  async function unassign(assignmentId: number) {
    await fetch(`${API}/consultant/clients/${id}/lms/assignments/${assignmentId}`, {
      method: "DELETE", headers: authHeaders(),
    });
    void load();
  }

  return (
    <div className="min-w-0 w-full overflow-x-hidden pb-4">
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
          <Badge variant="outline" className="h-8 rounded-xl px-3 text-xs border-emerald-200 bg-emerald-50 text-emerald-800">
            {assignments.length} course{assignments.length === 1 ? "" : "s"} assigned
          </Badge>
        )}
      </WorkspaceSubpageHero>

      {loading && (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading courses…</p>
      )}

      {!loading && pathwayLocked && (
        <Card className="border-amber-200/70 bg-amber-500/[0.04]">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700">
              <Lock className="size-7" />
            </span>
            <div className="max-w-md space-y-2">
              <p className="text-lg font-semibold">Pathway required</p>
              <p className="text-sm text-muted-foreground">
                Assign an immigration pathway in the workspace before assigning exam prep courses to this client.
              </p>
            </div>
            <Button asChild className="rounded-xl">
              <Link href={`/dashboard/clients/${id}/workspace/pathway-calculator`}>Open pathway calculator</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && !pathwayLocked && (
        <div className="space-y-6">
          <LmsAvailableCoursePicker
            courses={courses}
            courseId={courseId}
            onCourseIdChange={setCourseId}
            onAssign={() => void assign()}
            assignedCourseIds={assignments.map((a) => a.course?.id).filter(Boolean) as number[]}
          />

          <div>
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold">Assigned exam courses</h2>
              <span className="text-xs text-muted-foreground">
                {assignments.length} course{assignments.length === 1 ? "" : "s"}
              </span>
            </div>

            {assignments.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/20 py-14 text-center">
                <GraduationCap className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">No courses assigned yet</p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground/80">
                  Select a course above and click Assign to add exam prep for this client.
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

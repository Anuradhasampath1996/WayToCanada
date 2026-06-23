"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, GraduationCap, Lock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { WorkspaceBreadcrumb } from "../workspace-flow-ui";

const API = `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/v1`;

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("wtc_consultant_token") : "";
  return { Accept: "application/json", Authorization: `Bearer ${token}` };
}

export default function ClientLmsPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = React.useState("");
  const [assignments, setAssignments] = React.useState<any[]>([]);
  const [courses, setCourses] = React.useState<any[]>([]);
  const [courseId, setCourseId] = React.useState("");
  const [pathwayLocked, setPathwayLocked] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => { params.then((p) => setId(p.id)); }, [params]);

  const load = React.useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setPathwayLocked(false);

    const cfRes = await fetch(`${API}/consultant/clients/${id}/case-file`, { headers: authHeaders() });
    const cfJson = await cfRes.json().catch(() => ({}));
    if (!cfRes.ok || !cfJson.case_file?.immigration_pathway) {
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
    <div className="space-y-6 p-6">
      <WorkspaceBreadcrumb profileId={id} workspaceStep={5} pageLabel="LMS courses" />
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          <GraduationCap className="h-6 w-6 text-emerald-600" />
          Client learning courses
        </h1>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/dashboard/clients/${id}/workspace`}><ArrowLeft className="mr-1 h-4 w-4" />Workspace</Link>
        </Button>
      </div>

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
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">Assign a course</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger className="w-[280px]"><SelectValue placeholder="Select published course" /></SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.category?.name} — {c.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={assign} className="bg-emerald-600 hover:bg-emerald-700">
                <Plus className="mr-1 h-4 w-4" />Assign
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            {assignments.map((a) => (
              <Card key={a.id}>
                <CardContent className="space-y-3 pt-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="flex items-center gap-2 font-semibold">
                        <BookOpen className="h-4 w-4 text-emerald-600" />
                        {a.course?.title}
                      </p>
                      <p className="text-xs text-muted-foreground">{a.category?.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>{a.status}</Badge>
                      <Button size="icon" variant="ghost" onClick={() => unassign(a.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm"><span>Progress</span><span>{a.progress_percent}%</span></div>
                    <Progress value={a.progress_percent} />
                  </div>
                  {a.quiz_attempts?.length > 0 && (
                    <div className="space-y-2 border-t pt-3 text-sm">
                      <p className="font-medium">Exam &amp; quiz results</p>
                      {a.quiz_attempts.map((q: any) => (
                        <div key={q.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                          <span className="text-muted-foreground">{q.quiz_title}</span>
                          <Badge className={q.passed ? "bg-emerald-600" : ""} variant={q.passed ? "default" : "secondary"}>
                            {q.score_percent}% — {q.passed ? "Pass" : "Fail"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {assignments.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No courses assigned yet.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

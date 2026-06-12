"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen, GraduationCap, Plus, Trash2 } from "lucide-react";
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

  React.useEffect(() => { params.then((p) => setId(p.id)); }, [params]);

  const load = React.useCallback(async () => {
    if (!id) return;
    const [aRes, cRes] = await Promise.all([
      fetch(`${API}/consultant/clients/${id}/lms`, { headers: authHeaders() }),
      fetch(`${API}/consultant/lms/courses`, { headers: authHeaders() }),
    ]);
    setAssignments((await aRes.json()).data ?? []);
    setCourses((await cRes.json()).data ?? []);
  }, [id]);

  React.useEffect(() => { load(); }, [load]);

  async function assign() {
    if (!courseId) return;
    await fetch(`${API}/consultant/clients/${id}/lms/assign`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ course_id: Number(courseId) }),
    });
    setCourseId("");
    load();
  }

  async function unassign(assignmentId: number) {
    await fetch(`${API}/consultant/clients/${id}/lms/assignments/${assignmentId}`, {
      method: "DELETE", headers: authHeaders(),
    });
    load();
  }

  return (
    <div className="space-y-6 p-6">
      <WorkspaceBreadcrumb profileId={id} workspaceStep={0} pageLabel="LMS courses" />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-emerald-600" />
          Client learning courses
        </h1>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/dashboard/clients/${id}/workspace`}><ArrowLeft className="h-4 w-4 mr-1" />Workspace</Link>
        </Button>
      </div>

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
            <Plus className="h-4 w-4 mr-1" />Assign
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {assignments.map((a) => (
          <Card key={a.id}>
            <CardContent className="pt-6 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold flex items-center gap-2">
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
                <div className="text-sm border-t pt-3 space-y-2">
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
          <p className="text-sm text-muted-foreground text-center py-8">No courses assigned yet.</p>
        )}
      </div>
    </div>
  );
}

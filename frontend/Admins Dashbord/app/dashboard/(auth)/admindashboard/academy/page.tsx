"use client";

import { useEffect, useState } from "react";
import { GraduationCap, Plus } from "lucide-react";
import { adminAuthHeaders } from "@/lib/admin-auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

function headers() {
  return adminAuthHeaders("application/json");
}

type Course = { id: number; title: string; status?: string; access_tier?: string };
type Question = { id: number; type?: string; status?: string; published_version?: { question_text?: string } };
type AcademyCase = { id: number; title: string; status?: string };
type Template = { id: number; name: string; total_questions?: number; duration_minutes?: number };

export default function AdminAcademyPage() {
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [courses, setCourses] = useState<Course[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [cases, setCases] = useState<AcademyCase[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function api(path: string, init?: RequestInit) {
    const res = await fetch(`${API}/admin/academy/${path}`, { headers: headers(), ...init });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message ?? `Request failed (${res.status})`);
    return json;
  }

  async function loadDashboard() {
    try {
      const json = await api("dashboard");
      setStats(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load academy");
    }
  }

  useEffect(() => {
    loadDashboard();
    loadTab("courses");
  }, []);

  async function loadTab(tab: string) {
    setError(null);
    try {
      if (tab === "courses") setCourses((await api("courses")).data ?? []);
      if (tab === "questions") setQuestions((await api("questions")).data ?? []);
      if (tab === "cases") setCases((await api("cases")).data ?? []);
      if (tab === "templates") setTemplates((await api("exam-templates")).data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load");
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <GraduationCap className="h-7 w-7 text-emerald-600" />
          RCIC Academy
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Courses, question bank, and mocks for consultants.{" "}
          <a className="underline" href="/admindashboard/academy/ai-studio">
            Create with AI Studio
          </a>
          {" · "}
          <a className="underline" href="/admindashboard/learning/exams">
            Exam Master
          </a>
        </p>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {notice ? (
        <Alert>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Courses", stats.courses],
          ["Questions", stats.questions],
          ["Published", stats.published_questions],
          ["Outdated flags", stats.outdated],
        ].map(([label, value]) => (
          <Card key={String(label)}>
            <CardHeader className="pb-2">
              <CardDescription>{label}</CardDescription>
              <CardTitle>{value ?? 0}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="courses" onValueChange={loadTab}>
        <TabsList>
          <TabsTrigger value="courses">Courses</TabsTrigger>
          <TabsTrigger value="questions">Question bank</TabsTrigger>
          <TabsTrigger value="cases">Cases</TabsTrigger>
          <TabsTrigger value="templates">Mock templates</TabsTrigger>
        </TabsList>

        <TabsContent value="courses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Create draft course</CardTitle>
              <CardDescription>Manual draft. For AI generation use AI Content Studio.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-end gap-3">
              <div className="space-y-1 min-w-64 flex-1">
                <Label>Course title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. IRB Foundations" />
              </div>
              <Button
                disabled={busy || !title.trim()}
                onClick={async () => {
                  setBusy(true);
                  setError(null);
                  try {
                    await api("courses", {
                      method: "POST",
                      body: JSON.stringify({ title, access_tier: "subscription" }),
                    });
                    setNotice("Draft course created.");
                    setTitle("");
                    setCourses((await api("courses")).data ?? []);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Create failed");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                {busy ? "Creating…" : "Create course"}
              </Button>
            </CardContent>
          </Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    No courses yet. Create one above or use AI Studio.
                  </TableCell>
                </TableRow>
              ) : (
                courses.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell className="font-medium">{course.title}</TableCell>
                    <TableCell>{course.access_tier ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{course.status ?? "draft"}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="questions">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {questions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    Question bank is empty.
                  </TableCell>
                </TableRow>
              ) : (
                questions.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell>{q.id}</TableCell>
                    <TableCell>{q.type}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{q.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="cases">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-muted-foreground">
                    No cases yet.
                  </TableCell>
                </TableRow>
              ) : (
                cases.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.title}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="templates">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Questions</TableHead>
                <TableHead>Minutes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    No mock templates yet.
                  </TableCell>
                </TableRow>
              ) : (
                templates.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.total_questions}</TableCell>
                    <TableCell>{item.duration_minutes}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
}

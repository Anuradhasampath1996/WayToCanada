"use client";

import { useEffect, useState } from "react";
import { BookOpen, Plus } from "lucide-react";
import { adminAuthHeaders } from "@/lib/admin-auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

function headers() {
  return adminAuthHeaders("application/json");
}

type Exam = {
  id: number;
  name: string;
  generation_profile?: string;
  status?: string;
  exam_authority?: string | null;
};

type Summary = Record<string, string | number | boolean | null>;

export default function AdminLearningExamsPage() {
  const [domain] = useState("client_lms");
  const [exams, setExams] = useState<Exam[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [detail, setDetail] = useState<{ exam?: Exam; evidence_summary?: Summary } | null>(null);
  const [name, setName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lmsJobId, setLmsJobId] = useState<number | null>(null);

  async function loadList() {
    setError(null);
    const res = await fetch(`${API}/admin/learning/exams?product_domain=${domain}`, { headers: headers() });
    const json = await res.json();
    if (!res.ok) {
      setError(json.message ?? "Could not load exams");
      setExams([]);
      return;
    }
    setExams(json.data ?? []);
  }

  useEffect(() => {
    setOpen(null);
    setDetail(null);
    setName("Canadian Citizenship Test");
    setSourceUrl(
      "https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-citizenship.html"
    );
    loadList();
  }, []);

  async function loadExam(id: number) {
    setOpen(id);
    const res = await fetch(`${API}/admin/learning/exams/${id}?product_domain=${domain}`, { headers: headers() });
    const json = await res.json();
    if (!res.ok) {
      setError(json.message ?? "Could not load exam");
      return;
    }
    setDetail(json);
  }

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(label);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  async function createExam() {
    await run("Exam created as a draft.", async () => {
      const res = await fetch(`${API}/admin/learning/exams?product_domain=${domain}`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({
          name,
          generation_profile: "citizenship_exam_prep",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Create failed");
      await loadList();
      if (json.exam?.id) await loadExam(json.exam.id);
    });
  }

  async function post(path: string, body: unknown, label: string) {
    if (!open) return;
    await run(label, async () => {
      const res = await fetch(`${API}/admin/learning/exams/${open}${path}?product_domain=${domain}`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Request failed");
      if (typeof json.job_id === "number") setLmsJobId(json.job_id);
      await loadExam(open);
    });
  }

  const summary = detail?.evidence_summary ?? {};

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="h-7 w-7 text-emerald-600" />
          Exam Master
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Create a Client LMS exam, add official sources, then generate a draft course. AI never publishes.
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create exam</CardTitle>
          <CardDescription>
            Client marketplace exams such as Citizenship.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1 min-w-64 flex-1">
            <Label>Exam name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Exam name" />
          </div>
          <Button disabled={busy || !name.trim()} onClick={createExam}>
            <Plus className="h-4 w-4 mr-1" />
            {busy ? "Creating…" : "Create exam"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Exams</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exams.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-muted-foreground">
                      No exams yet. Use Create exam above.
                    </TableCell>
                  </TableRow>
                ) : (
                  exams.map((exam) => (
                    <TableRow
                      key={exam.id}
                      className={open === exam.id ? "bg-muted/50 cursor-pointer" : "cursor-pointer"}
                      onClick={() => loadExam(exam.id)}
                    >
                      <TableCell className="font-medium">{exam.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{exam.status ?? "draft"}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{detail?.exam?.name ?? "Research / Evidence"}</CardTitle>
            <CardDescription>Select an exam, add an official source, approve the pack, then generate a draft.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!open ? (
              <p className="text-sm text-muted-foreground">Choose an exam from the list.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2 text-sm">
                  {Object.entries(summary).map(([key, value]) => (
                    <Badge key={key} variant="outline">
                      {key.replaceAll("_", " ")}: {String(value)}
                    </Badge>
                  ))}
                </div>
                <div className="space-y-1">
                  <Label>Official source URL</Label>
                  <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() =>
                      post(
                        "/sources",
                        {
                          source_type: "official_exam_page",
                          url: sourceUrl,
                          title: "Official exam page",
                          verification_status: "verified",
                        },
                        "Source added."
                      )
                    }
                  >
                    Add source
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => post("/evidence-pack/approve", {}, "Evidence pack approved.")}
                  >
                    Approve pack
                  </Button>
                  <Button
                    disabled={busy || summary.evidence_pack !== "APPROVED"}
                    onClick={() =>
                      post(
                        "/generate-course",
                        {
                          title: `${detail?.exam?.name ?? "Citizenship"} draft`,
                          generate_lessons: true,
                          generate_independent_mcqs: true,
                          generate_cases: false,
                          generate_case_mcqs: false,
                          independent_count: 10,
                          case_based_count: 0,
                          case_count: 0,
                          module_count: 1,
                          lesson_count: 2,
                          mock_question_count: 10,
                          include_mock: true,
                        },
                        "Draft generation started. AI will not publish."
                      )
                    }
                  >
                    Generate draft course
                  </Button>
                  {lmsJobId ? (
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        run("LMS blueprint approved.", async () => {
                          const res = await fetch(`${API}/admin/learning/lms-ai-jobs/${lmsJobId}/approve-blueprint`, {
                            method: "POST",
                            headers: headers(),
                          });
                          const json = await res.json();
                          if (!res.ok) throw new Error(json.message ?? "Approve failed");
                        })
                      }
                    >
                      Approve LMS blueprint
                    </Button>
                  ) : null}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

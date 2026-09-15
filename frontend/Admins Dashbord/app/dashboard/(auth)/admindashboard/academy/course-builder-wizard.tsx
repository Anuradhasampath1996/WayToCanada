"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Sparkles } from "lucide-react";
import { adminAuthHeaders } from "@/lib/admin-auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

const STEPS = [
  { id: 1, title: "Name the course", hint: "Exam + course title" },
  { id: 2, title: "Research", hint: "Official sources" },
  { id: 3, title: "Write sections", hint: "Headings and paragraphs" },
  { id: 4, title: "Practice MCQs", hint: "Questions under each section" },
  { id: 5, title: "Mock exam", hint: "Add a mock to the course" },
] as const;

type Exam = { id: number; name: string; status?: string };
type Lesson = { id: number; title: string; body_html?: string | null; text_content?: string | null };
type Module = { id: number; title: string; lessons?: Lesson[] };
type Question = { id: number; type?: string; status?: string; versions?: Array<{ question_text?: string }> };

function headers() {
  return adminAuthHeaders("application/json");
}

async function jsonFetch(url: string, init?: RequestInit) {
  const res = await fetch(url, { headers: headers(), ...init });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof json.message === "string" ? json.message : `Request failed (${res.status})`);
  }
  return json;
}

function stripHtml(value?: string | null) {
  if (!value) return "";
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function CourseBuilderWizard() {
  const [step, setStep] = useState(1);
  const [domain, setDomain] = useState("rcic_academy");
  const [exams, setExams] = useState<Exam[]>([]);
  const [examId, setExamId] = useState<number | null>(null);
  const [examName, setExamName] = useState("RCIC-IRB Specialization Exam");
  const [courseTitle, setCourseTitle] = useState("RCIC-IRB Specialization Exam Mastery");
  const [sourceUrl, setSourceUrl] = useState("https://college-ic.ca");
  const [duration, setDuration] = useState(240);
  const [totalQuestions, setTotalQuestions] = useState(10);
  const [researchDone, setResearchDone] = useState(false);
  const [researchNotes, setResearchNotes] = useState<string[]>([]);
  const [jobId, setJobId] = useState<number | null>(null);
  const [jobStatus, setJobStatus] = useState<string>("");
  const [courseId, setCourseId] = useState<number | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [mockName, setMockName] = useState("");
  const [mockCreated, setMockCreated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLms = domain === "client_lms";
  const q = `product_domain=${domain}`;
  const progress = useMemo(() => (step / STEPS.length) * 100, [step]);

  useEffect(() => {
    jsonFetch(`${API}/admin/learning/exams?${q}`)
      .then((json) => setExams(json.data ?? []))
      .catch((e) => setError(e.message));
  }, [domain]);

  useEffect(() => {
    if (isLms) {
      setExamName("Canadian Citizenship Test");
      setCourseTitle("Canadian Citizenship Test Prep");
      setSourceUrl("https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-citizenship.html");
      setDuration(30);
      setTotalQuestions(10);
    } else {
      setExamName("RCIC-IRB Specialization Exam");
      setCourseTitle("RCIC-IRB Specialization Exam Mastery");
      setSourceUrl("https://college-ic.ca");
      setDuration(240);
      setTotalQuestions(10);
    }
    setExamId(null);
    setResearchDone(false);
    setResearchNotes([]);
    setJobId(null);
    setCourseId(null);
    setModules([]);
    setQuestions([]);
    setMockCreated(null);
    setStep(1);
  }, [domain]);

  async function ensureExam() {
    if (examId) return examId;
    const json = await jsonFetch(`${API}/admin/learning/exams?${q}`, {
      method: "POST",
      body: JSON.stringify({
        name: examName,
        generation_profile: isLms ? "citizenship_exam_prep" : "rcic_exam_prep",
      }),
    });
    const id = json.exam?.id as number;
    setExamId(id);
    setExams((current) => [{ id, name: examName, status: "draft" }, ...current]);
    return id;
  }

  async function startResearch() {
    setBusy(true);
    setError(null);
    const notes: string[] = [];
    try {
      const id = await ensureExam();
      notes.push("Exam saved.");
      const source = await jsonFetch(`${API}/admin/learning/exams/${id}/sources?${q}`, {
        method: "POST",
        body: JSON.stringify({
          source_type: "official_exam_page",
          url: sourceUrl,
          title: "Official exam page",
          verification_status: "verified",
        }),
      });
      const itemId = source.item?.id;
      notes.push("Official source added.");
      if (itemId) {
        await jsonFetch(`${API}/admin/learning/exams/${id}/sources/${itemId}/verify?${q}`, { method: "POST" });
        notes.push("Source marked verified.");
        await jsonFetch(`${API}/admin/learning/exams/${id}/official-structure?${q}`, {
          method: "POST",
          body: JSON.stringify({
            item_id: itemId,
            exam_format_json: { duration_minutes: duration, total_questions: totalQuestions },
          }),
        });
        notes.push("Exam structure saved from the official source.");
      }
      await jsonFetch(`${API}/admin/learning/exams/${id}/evidence-pack/approve?${q}`, { method: "POST" });
      notes.push("Research pack approved. Next: write the course sections.");
      setResearchNotes(notes);
      setResearchDone(true);
      setStep(3);
    } catch (e) {
      setResearchNotes(notes);
      setError(e instanceof Error ? e.message : "Research failed");
    } finally {
      setBusy(false);
    }
  }

  async function loadCourse(id: number) {
    if (isLms) {
      const course = await jsonFetch(`${API}/admin/lms/courses/${id}`);
      setModules(course.modules ?? []);
      return;
    }
    const json = await jsonFetch(`${API}/admin/academy/courses/${id}`);
    const versions = json.course?.versions ?? [];
    const latest = versions[versions.length - 1];
    setModules(latest?.modules ?? []);
  }

  async function loadQuestions(id: number) {
    const json = await jsonFetch(`${API}/admin/learning/exams/${id}/questions?${q}`);
    setQuestions(json.data ?? []);
  }

  async function pollJob(id: number) {
    for (let i = 0; i < 80; i += 1) {
      const json = isLms
        ? await jsonFetch(`${API}/admin/learning/lms-ai-jobs/${id}`)
        : await jsonFetch(`${API}/admin/academy/ai/jobs/${id}`);
      const job = json.job ?? json;
      setJobStatus(job.status ?? "");
      if (job.course_id) setCourseId(job.course_id);
      if (job.status === "blueprint") {
        if (isLms) {
          await jsonFetch(`${API}/admin/learning/lms-ai-jobs/${id}/approve-blueprint`, { method: "POST" });
        } else {
          await jsonFetch(`${API}/admin/academy/ai/jobs/${id}/approve-blueprint`, { method: "POST" });
        }
        continue;
      }
      if (["draft_ready", "partially_failed", "failed"].includes(job.status)) {
        if (job.course_id) await loadCourse(job.course_id);
        if (examId) await loadQuestions(examId);
        return job;
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    throw new Error("Generation is still running. Open Jobs later, or wait and refresh this step.");
  }

  async function generateContent() {
    if (!examId) return;
    setBusy(true);
    setError(null);
    try {
      const json = await jsonFetch(`${API}/admin/learning/exams/${examId}/generate-course?${q}`, {
        method: "POST",
        body: JSON.stringify({
          title: courseTitle,
          generate_lessons: true,
          generate_independent_mcqs: true,
          generate_cases: !isLms,
          generate_case_mcqs: !isLms,
          include_mock: false,
          independent_count: totalQuestions,
          case_based_count: isLms ? 0 : Math.min(10, totalQuestions),
          case_count: isLms ? 0 : 2,
          module_count: 3,
          lesson_count: 6,
          mock_question_count: totalQuestions,
        }),
      });
      setJobId(json.job_id);
      setJobStatus(json.status ?? "queued");
      await pollJob(json.job_id);
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  async function createMock() {
    if (!examId) return;
    setBusy(true);
    setError(null);
    try {
      const json = await jsonFetch(`${API}/admin/learning/exams/${examId}/mock-templates?${q}`, {
        method: "POST",
        body: JSON.stringify({
          name: mockName || `${courseTitle} mock exam`,
          course_id: courseId,
          total_questions: totalQuestions,
          duration_minutes: duration,
          independent_count: totalQuestions,
          case_based_count: 0,
          selection_mode: "random_pool",
          allow_fallback_mix: true,
        }),
      });
      setMockCreated(json.template?.name ?? "Mock exam");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create mock exam");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-emerald-600" />
          Build a course
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          One path: name the exam course, research it, write sections, add practice questions, then attach a mock exam.
          Drafts only — AI cannot publish.
        </p>
      </div>

      <div className="space-y-3">
        <Progress value={progress} />
        <ol className="grid gap-2 sm:grid-cols-5">
          {STEPS.map((item) => {
            const done = step > item.id;
            const current = step === item.id;
            return (
              <li
                key={item.id}
                className={`rounded-lg border px-3 py-2 text-sm ${current ? "border-emerald-600 bg-emerald-50" : "bg-background"}`}
              >
                <div className="flex items-center gap-2 font-medium">
                  {done ? <Check className="h-4 w-4 text-emerald-600" /> : <span>{item.id}</span>}
                  {item.title}
                </div>
                <p className="text-xs text-muted-foreground">{item.hint}</p>
              </li>
            );
          })}
        </ol>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Name the exam course</CardTitle>
            <CardDescription>First say which exam this course is for, then give the course a name.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap gap-2">
              <Button variant={domain === "rcic_academy" ? "default" : "outline"} onClick={() => setDomain("rcic_academy")}>
                RCIC Academy
              </Button>
              <Button variant={domain === "client_lms" ? "default" : "outline"} onClick={() => setDomain("client_lms")}>
                Client LMS
              </Button>
            </div>
            <div className="space-y-1">
              <Label>Existing exam (optional)</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={examId ?? ""}
                onChange={(e) => setExamId(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Create a new exam</option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Exam name</Label>
              <Input value={examName} onChange={(e) => setExamName(e.target.value)} disabled={!!examId} />
            </div>
            <div className="space-y-1">
              <Label>Course name</Label>
              <Input value={courseTitle} onChange={(e) => setCourseTitle(e.target.value)} />
            </div>
            <Button
              className="w-fit"
              disabled={!courseTitle.trim() || (!examId && !examName.trim())}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  await ensureExam();
                  setStep(2);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Could not save exam");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Saving…" : "Continue to research"}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Research this exam</CardTitle>
            <CardDescription>
              The studio collects official pages for <strong>{courseTitle}</strong>, then you approve that research before writing lessons.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="space-y-1">
              <Label>Official source URL</Label>
              <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Mock duration (minutes)</Label>
                <Input type="number" min={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label>Practice / mock question count</Label>
                <Input type="number" min={1} value={totalQuestions} onChange={(e) => setTotalQuestions(Number(e.target.value))} />
              </div>
            </div>
            <Button className="w-fit" disabled={busy || !sourceUrl.trim()} onClick={startResearch}>
              {busy ? "Researching…" : "Start research"}
            </Button>
            {researchNotes.length > 0 ? (
              <ul className="text-sm space-y-1">
                {researchNotes.map((note) => (
                  <li key={note} className="flex gap-2">
                    <Check className="h-4 w-4 text-emerald-600 mt-0.5" />
                    {note}
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Write course sections</CardTitle>
            <CardDescription>
              Lessons are created as sections: heading, subheading, then paragraphs. This stays a draft.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!researchDone ? (
              <p className="text-sm text-muted-foreground">Finish research first.</p>
            ) : (
              <Button disabled={busy} onClick={generateContent}>
                {busy ? `Writing… ${jobStatus || "queued"}` : "Generate sections"}
              </Button>
            )}
            {modules.map((module) => (
              <div key={module.id} className="rounded-lg border p-4 space-y-3">
                <h2 className="text-lg font-semibold">{module.title}</h2>
                {(module.lessons ?? []).map((lesson) => (
                  <article key={lesson.id} className="space-y-1">
                    <h3 className="font-medium">{lesson.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {stripHtml(lesson.body_html || lesson.text_content) || "Paragraphs will appear here after generation finishes."}
                    </p>
                  </article>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">4. Practice MCQs</CardTitle>
            <CardDescription>Practice questions for this exam. They stay attached to the course, not published automatically.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {questions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {busy ? "Questions are still being written." : "No practice questions yet. Generate sections first, or wait for the job to finish."}
              </p>
            ) : (
              <ol className="space-y-2 list-decimal pl-5">
                {questions.map((question) => (
                  <li key={question.id} className="text-sm">
                    {question.versions?.[0]?.question_text ?? `Question #${question.id}`}
                    <Badge variant="secondary" className="ml-2">
                      {question.status ?? "draft"}
                    </Badge>
                  </li>
                ))}
              </ol>
            )}
            <Button variant="outline" className="w-fit" onClick={() => setStep(5)}>
              Continue to mock exam
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">5. Create the course mock exam</CardTitle>
            <CardDescription>
              This mock appears on <strong>{courseTitle}</strong>. Learners only see it after you publish the course later.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="space-y-1">
              <Label>Mock exam name</Label>
              <Input
                value={mockName}
                onChange={(e) => setMockName(e.target.value)}
                placeholder={`${courseTitle} mock exam`}
              />
            </div>
            <Button className="w-fit" disabled={busy || !examId} onClick={createMock}>
              {busy ? "Creating…" : "Create mock exam"}
            </Button>
            {mockCreated ? (
              <Alert>
                <AlertDescription>
                  {mockCreated} is attached to this course as a draft mock. It will show in the course player after you publish.
                </AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 text-sm">
        {step > 1 ? (
          <Button variant="ghost" onClick={() => setStep((current) => Math.max(1, current - 1))}>
            Back
          </Button>
        ) : null}
        {jobStatus ? <Badge variant="outline">Job {jobStatus}</Badge> : null}
        {courseId ? <Badge variant="outline">Draft course #{courseId}</Badge> : null}
      </div>
    </div>
  );
}

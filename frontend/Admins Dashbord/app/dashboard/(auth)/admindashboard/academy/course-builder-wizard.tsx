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
  { id: 2, title: "Course structure", hint: "Main topics and subtopics" },
  { id: 3, title: "Write content", hint: "Fill each section" },
  { id: 4, title: "Practice MCQs", hint: "Questions from the content" },
  { id: 5, title: "Mock exam", hint: "Add a mock to the course" },
] as const;

type Exam = { id: number; name: string; status?: string };
type Lesson = { id: number; title: string; body_html?: string | null; text_content?: string | null };
type Module = { id: number; title: string; lessons?: Lesson[] };
type OutlineModule = { title?: string; objective?: string; lesson_outlines?: Array<{ title?: string; objective?: string }> };
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
  const [outline, setOutline] = useState<OutlineModule[]>([]);
  const [jobId, setJobId] = useState<number | null>(null);
  const [jobStatus, setJobStatus] = useState<string>("");
  const [courseId, setCourseId] = useState<number | null>(null);
  const [evidencePackId, setEvidencePackId] = useState<number | null>(null);
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
    setOutline([]);
    setJobId(null);
    setCourseId(null);
    setEvidencePackId(null);
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

  async function prepareEvidence(id: number) {
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
    if (itemId) {
      await jsonFetch(`${API}/admin/learning/exams/${id}/sources/${itemId}/verify?${q}`, { method: "POST" });
      await jsonFetch(`${API}/admin/learning/exams/${id}/official-structure?${q}`, {
        method: "POST",
        body: JSON.stringify({
          item_id: itemId,
          exam_format_json: { duration_minutes: duration, total_questions: totalQuestions },
        }),
      });
    }
    await jsonFetch(`${API}/admin/learning/exams/${id}/evidence-pack/approve?${q}`, { method: "POST" });
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

  async function pollJob(id: number, stopAtBlueprint = false) {
    for (let i = 0; i < 80; i += 1) {
      const json = isLms
        ? await jsonFetch(`${API}/admin/learning/lms-ai-jobs/${id}`)
        : await jsonFetch(`${API}/admin/academy/ai/jobs/${id}`);
      const job = json.job ?? json;
      setJobStatus(job.status ?? "");
      if (job.course_id) setCourseId(job.course_id);
      if (job.evidence_pack_id) setEvidencePackId(job.evidence_pack_id);
      if (job.blueprint_json?.modules) setOutline(job.blueprint_json.modules);
      if (stopAtBlueprint && job.status === "blueprint") {
        return job;
      }
      if (["draft_ready", "partially_failed", "failed"].includes(job.status)) {
        if (job.status === "failed") {
          throw new Error(job.error || "Generation failed");
        }
        if (job.course_id) await loadCourse(job.course_id);
        return job;
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    throw new Error("Generation is still running. Wait a moment, then try this step again.");
  }

  async function buildOutline(id: number) {
    setBusy(true);
    setError(null);
    try {
      await prepareEvidence(id);
      const json = await jsonFetch(`${API}/admin/learning/exams/${id}/generate-course?${q}`, {
        method: "POST",
        body: JSON.stringify({
          title: courseTitle,
          generate_lessons: true,
          generate_independent_mcqs: false,
          generate_cases: false,
          generate_case_mcqs: false,
          include_mock: false,
          independent_count: totalQuestions,
          case_based_count: 0,
          case_count: 0,
          module_count: 3,
          lesson_count: 6,
          mock_question_count: totalQuestions,
        }),
      });
      setJobId(json.job_id);
      setJobStatus(json.status ?? "queued");
      await pollJob(json.job_id, true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build the course structure");
    } finally {
      setBusy(false);
    }
  }

  async function writeContent() {
    if (!jobId) return;
    setBusy(true);
    setError(null);
    try {
      if (isLms) {
        await jsonFetch(`${API}/admin/learning/lms-ai-jobs/${jobId}/approve-blueprint`, { method: "POST" });
      } else {
        await jsonFetch(`${API}/admin/academy/ai/jobs/${jobId}/approve-blueprint`, { method: "POST" });
      }
      await pollJob(jobId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not write section content");
    } finally {
      setBusy(false);
    }
  }

  async function generateMcqs() {
    if (!examId) return;
    setBusy(true);
    setError(null);
    try {
      const json = isLms
        ? await jsonFetch(`${API}/admin/learning/lms-ai-jobs`, {
            method: "POST",
            body: JSON.stringify({
              type: "questions",
              title: `${courseTitle} practice MCQs`,
              exam_id: examId,
              course_id: courseId,
              evidence_pack_id: evidencePackId,
              generation_profile: "citizenship_exam_prep",
              generate_lessons: false,
              generate_independent_mcqs: true,
              include_mock: false,
              independent_count: totalQuestions,
            }),
          })
        : await jsonFetch(`${API}/admin/academy/ai/jobs`, {
            method: "POST",
            body: JSON.stringify({
              type: "questions",
              title: `${courseTitle} practice MCQs`,
              exam_id: examId,
              course_id: courseId,
              evidence_pack_id: evidencePackId,
              generation_profile: "rcic_exam_prep",
              urls: [sourceUrl],
              generate_lessons: false,
              generate_independent_mcqs: true,
              generate_cases: false,
              generate_case_mcqs: false,
              independent_count: totalQuestions,
              case_based_count: 0,
              case_count: 0,
            }),
          });
      const nextJobId = json.job?.id ?? json.job_id;
      if (nextJobId) {
        setJobId(nextJobId);
        await pollJob(nextJobId);
      }
      await loadQuestions(examId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not generate practice MCQs");
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
          One path: name the course, approve the topic outline, write section content, generate practice MCQs, then attach a mock exam.
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
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Official source URL</Label>
                <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Mock duration (minutes)</Label>
                <Input type="number" min={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Practice / mock question count</Label>
              <Input type="number" min={1} value={totalQuestions} onChange={(e) => setTotalQuestions(Number(e.target.value))} />
            </div>
            <Button
              className="w-fit"
              disabled={busy || !courseTitle.trim() || (!examId && !examName.trim()) || !sourceUrl.trim()}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  const id = await ensureExam();
                  setStep(2);
                  await buildOutline(id);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Could not save exam");
                  setBusy(false);
                }
              }}
            >
              {busy ? "Saving…" : "Continue to course structure"}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Course structure</CardTitle>
            <CardDescription>
              Main topics and subtopics for <strong>{courseTitle}</strong> are split into sections first. Content is not written until you approve this outline.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {busy && outline.length === 0 ? (
              <p className="text-sm text-muted-foreground">Building the outline… {jobStatus || "queued"}</p>
            ) : null}
            {outline.map((module, index) => (
              <div key={`${module.title}-${index}`} className="rounded-lg border p-4 space-y-2">
                <h2 className="text-lg font-semibold">Main topic: {module.title || `Topic ${index + 1}`}</h2>
                {module.objective ? <p className="text-sm text-muted-foreground">{module.objective}</p> : null}
                <ol className="list-decimal pl-5 space-y-1 text-sm">
                  {(module.lesson_outlines ?? []).map((lesson, lessonIndex) => (
                    <li key={`${lesson.title}-${lessonIndex}`}>
                      <span className="font-medium">{lesson.title || `Section ${lessonIndex + 1}`}</span>
                      {lesson.objective ? <span className="text-muted-foreground"> — {lesson.objective}</span> : null}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
            {outline.length > 0 ? (
              <Button className="w-fit" disabled={busy} onClick={() => setStep(3)}>
                Use this structure
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : !busy ? (
              <Button className="w-fit" disabled={!examId} onClick={() => examId && buildOutline(examId)}>
                Build outline
              </Button>
            ) : null}
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Write content into each section</CardTitle>
            <CardDescription>
              The approved outline stays in place. This step writes headings, subheadings, and paragraphs into those sections. Draft only.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {modules.length === 0 ? (
              <Button disabled={busy || !jobId} onClick={writeContent}>
                {busy ? `Writing… ${jobStatus || "queued"}` : "Write content for these sections"}
              </Button>
            ) : null}
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
            {modules.length > 0 ? (
              <Button variant="outline" className="w-fit" onClick={() => setStep(4)}>
                Continue to practice MCQs
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : null}
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">4. Practice MCQs</CardTitle>
            <CardDescription>
              Questions are generated from the written sections. They stay attached to the course as drafts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {questions.length === 0 ? (
              <Button disabled={busy || !examId || !courseId} onClick={generateMcqs}>
                {busy ? `Generating MCQs… ${jobStatus || "queued"}` : "Generate practice MCQs"}
              </Button>
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
            {questions.length > 0 ? (
              <Button variant="outline" className="w-fit" onClick={() => setStep(5)}>
                Continue to mock exam
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : null}
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

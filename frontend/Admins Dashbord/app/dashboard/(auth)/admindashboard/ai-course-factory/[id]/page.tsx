"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { adminAuthHeaders } from "@/lib/admin-auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

type Step = {
  id: number;
  step_key: string;
  step_name: string;
  status: string;
  progress: number;
  error_message?: string | null;
  external_provider?: string | null;
};

type EventItem = {
  id: number;
  title: string;
  message?: string | null;
  agent?: string | null;
  event_type: string;
  created_at?: string;
};

type StudioPayload = {
  run: {
    id: number;
    exam_name: string;
    canonical_exam_name?: string | null;
    status: string;
    overall_progress: number;
    current_step?: string | null;
    error_summary?: string | null;
    coverage_report_json?: Record<string, unknown> | null;
    started_at?: string | null;
  };
  events: EventItem[];
  stats: Record<string, number | boolean>;
  modules: Array<{
    id: number;
    title: string;
    lessons?: Array<{ id: number; title: string; ai_metadata_json?: { status?: string } }>;
  }>;
  sources: Array<{ id: number; title: string; url?: string; authority_tier: number; organization?: string }>;
  course?: { id: number; title: string; thumbnail_url?: string; review_status?: string } | null;
};

function statusGlyph(status: string) {
  if (status === "completed") return "✓";
  if (status === "running" || status === "waiting_external" || status === "retrying") return "●";
  if (status === "failed") return "!";
  return "○";
}

export default function GenerationStudioPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const runId = params.id;
  const [data, setData] = useState<StudioPayload | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastEventId, setLastEventId] = useState(0);

  async function loadFull() {
    const res = await fetch(`${API}/admin/course-factory/${runId}`, { headers: adminAuthHeaders() });
    const json = await res.json();
    if (!res.ok) {
      setError(json.message ?? "Failed to load studio");
      return;
    }
    setData(json.data);
    setSteps(json.data.run.steps ?? []);
    setEvents(json.data.events ?? []);
    const maxId = Math.max(0, ...(json.data.events ?? []).map((e: EventItem) => e.id));
    setLastEventId(maxId);
  }

  async function pollEvents() {
    const res = await fetch(`${API}/admin/course-factory/${runId}/events?after=${lastEventId}`, {
      headers: adminAuthHeaders(),
    });
    const json = await res.json();
    if (!res.ok) return;
    if (json.data?.length) {
      setEvents((prev) => [...json.data, ...prev].slice(0, 120));
      setLastEventId(Math.max(lastEventId, ...json.data.map((e: EventItem) => e.id)));
    }
    if (json.run && data) {
      setData((prev) =>
        prev
          ? {
              ...prev,
              run: { ...prev.run, ...json.run },
            }
          : prev
      );
    }
    if (json.steps) setSteps(json.steps);
  }

  useEffect(() => {
    loadFull().catch((e) => setError(e instanceof Error ? e.message : "Load failed"));
  }, [runId]);

  useEffect(() => {
    if (!data) return;
    if (["pending_review", "published", "failed", "cancelled"].includes(data.run.status)) return;
    const t = setInterval(() => {
      pollEvents().catch(() => undefined);
    }, 2500);
    return () => clearInterval(t);
  }, [data?.run.status, lastEventId, runId]);

  const currentAgent = useMemo(() => {
    const running = steps.find((s) => ["running", "waiting_external", "retrying"].includes(s.status));
    if (!running) return "Idle";
    if (running.external_provider === "manus" || running.status === "waiting_external") return "Manus — Deep Research";
    return `OpenAI — ${running.step_name}`;
  }, [steps]);

  async function action(path: string, body?: object) {
    setError(null);
    const res = await fetch(`${API}/admin/course-factory/${runId}/${path}`, {
      method: "POST",
      headers: adminAuthHeaders("application/json"),
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.message ?? "Action failed");
      return;
    }
    await loadFull();
  }

  if (!data) {
    return <div className="p-6 text-muted-foreground">Loading Generation Studio…</div>;
  }

  const run = data.run;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4 lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">AI Course Factory</p>
          <h1 className="text-2xl font-semibold tracking-tight">{run.canonical_exam_name || run.exam_name}</h1>
          <p className="text-muted-foreground">
            {run.status === "pending_review"
              ? "Pending Admin Review"
              : run.status === "running" || run.status === "queued"
                ? "AI Course Generation in Progress"
                : run.status}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => router.push("/admindashboard/ai-course-factory")}>
            All runs
          </Button>
          {data.course?.id ? (
            <Button
              variant="outline"
              onClick={() => router.push(`/admindashboard/lms?course=${data.course!.id}`)}
            >
              View Course
            </Button>
          ) : null}
          {(run.status === "running" || run.status === "generation_incomplete") && (
            <Button variant="outline" onClick={() => action("cancel")}>
              Cancel
            </Button>
          )}
          {["failed", "cancelled", "generation_incomplete"].includes(run.status) && (
            <Button variant="outline" onClick={() => action("resume")}>
              Resume
            </Button>
          )}
          {run.status === "pending_review" && (
            <Button onClick={() => action("publish")}>Approve & Publish</Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span>{run.overall_progress}% Complete</span>
          <span className="text-muted-foreground">Current agent: {currentAgent}</span>
        </div>
        <Progress value={run.overall_progress} />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {run.error_summary && (
        <Alert>
          <AlertDescription>{run.error_summary}</AlertDescription>
        </Alert>
      )}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)_280px]">
        <div className="overflow-auto rounded-xl border bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pipeline</h2>
          <ol className="space-y-2">
            {steps.map((s) => (
              <li key={s.id} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 w-4 text-center font-semibold text-emerald-700">{statusGlyph(s.status)}</span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{s.step_name}</div>
                  <div className="text-xs capitalize text-muted-foreground">
                    {s.status.replaceAll("_", " ")}
                    {s.status === "running" || s.status === "waiting_external" ? ` · ${s.progress}%` : ""}
                  </div>
                  {s.error_message && <div className="text-xs text-red-600">{s.error_message}</div>}
                  {s.status === "failed" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs"
                      onClick={() => action("retry-step", { step_key: s.step_key })}
                    >
                      Retry step
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
          <div className="min-h-0 flex-1 overflow-auto rounded-xl border bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Live Generation Activity
            </h2>
            <div className="space-y-3">
              {events.map((e) => (
                <div key={e.id} className="border-b border-dashed pb-2 last:border-0">
                  <div className="font-medium">{e.title}</div>
                  {e.message && <div className="text-sm text-muted-foreground">{e.message}</div>}
                  <div className="mt-1 text-xs text-muted-foreground">
                    {e.agent || "System"} · {e.event_type}
                  </div>
                </div>
              ))}
              {events.length === 0 && <p className="text-sm text-muted-foreground">Waiting for activity…</p>}
            </div>
          </div>

          <div className="max-h-64 overflow-auto rounded-xl border bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Course preview
            </h2>
            <div className="space-y-2">
              {data.modules.map((m) => {
                const ready = (m.lessons ?? []).filter((l) => l.ai_metadata_json?.status === "content_ready").length;
                const total = (m.lessons ?? []).length;
                return (
                  <div key={m.id} className="rounded-lg border px-3 py-2 text-sm">
                    <div className="font-medium">{m.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {ready === total && total > 0 ? "✓ Generated" : `● ${ready} / ${total} lessons`}
                    </div>
                  </div>
                );
              })}
              {data.modules.length === 0 && (
                <p className="text-sm text-muted-foreground">Modules appear after architecture generation.</p>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-auto rounded-xl border bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Statistics</h2>
          <dl className="space-y-2 text-sm">
            {[
              ["Modules", `${data.stats.modules ?? 0}`],
              ["Lessons", `${data.stats.lessons_ready ?? 0} / ${data.stats.lessons ?? 0}`],
              ["Practice Questions", `${data.stats.practice_questions ?? 0}`],
              [
                "Question Bank",
                `${data.stats.question_bank ?? 0}${data.stats.question_bank_target ? ` / ${data.stats.question_bank_target}` : ""}`,
              ],
              ["Validated", `${data.stats.verified_questions ?? 0}`],
              ["Quizzes", `${data.stats.quizzes ?? 0}`],
              ["Assignments", `${data.stats.assignments ?? 0}`],
              ["Research Sources", `${data.stats.sources ?? 0}`],
              ["Mock Exam", data.stats.mock_ready ? "Ready" : "Not ready"],
              ["Overall", run.status],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 border-b border-dashed py-1">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-medium">{v}</dd>
              </div>
            ))}
          </dl>

          {data.course?.thumbnail_url && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Thumbnail</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={data.course.thumbnail_url} alt="Course thumbnail" className="w-full rounded-lg border" />
            </div>
          )}

          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sources</p>
            {data.sources.slice(0, 8).map((s) => (
              <div key={s.id} className="text-xs">
                <Badge variant="outline" className="mr-1">
                  T{s.authority_tier}
                </Badge>
                <span className="font-medium">{s.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

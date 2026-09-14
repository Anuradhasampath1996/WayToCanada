"use client";

import { useEffect, useState } from "react";
import { Sparkles, Plus } from "lucide-react";
import { adminAuthHeaders } from "@/lib/admin-auth";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

function headers() {
  return adminAuthHeaders("application/json");
}

type Settings = {
  enabled?: boolean;
  research_driver?: string;
  generation_driver?: string;
  openai_key_present?: boolean;
  manus_enabled?: boolean;
  manus_key_present?: boolean;
  monthly_budget_usd?: number;
  month_spend_usd?: number;
  max_questions_per_job?: number;
  max_source_chars?: number;
  batch_size?: number;
  image_limit_per_job?: number;
  budget_warn_percent?: number;
};

type Job = {
  id: number;
  type?: string;
  status?: string;
  title?: string | null;
  course_id?: number | null;
};

type QueueItem = {
  id: number;
  status?: string;
  entity_type?: string | null;
  job?: { id?: number; title?: string | null };
};

type UsageRow = {
  id: number;
  provider?: string;
  operation?: string;
  model?: string | null;
  estimated_cost_usd?: number | null;
};

async function api(path: string, init?: RequestInit) {
  const res = await fetch(`${API}/admin/academy/ai/${path}`, { headers: headers(), ...init });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof json.message === "string" ? json.message : `Request failed (${res.status})`);
  }
  return json;
}

export default function AcademyAiStudioPage() {
  const [tab, setTab] = useState("create");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState<Settings>({});
  const [queueWarning, setQueueWarning] = useState<string | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [monthSpend, setMonthSpend] = useState<number>(0);
  const [lastJob, setLastJob] = useState<Job | null>(null);

  const [title, setTitle] = useState("RCIC-IRB Specialization Exam Mastery");
  const [goal, setGoal] = useState("Draft exam-prep study aid. Not official CICC material.");
  const [independent, setIndependent] = useState(10);
  const [caseBased, setCaseBased] = useState(10);
  const [images, setImages] = useState(false);
  const [budget, setBudget] = useState("250");

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

  async function loadSettings() {
    const json = await api("bootstrap");
    setSettings(json.settings ?? {});
    setQueueWarning(json.queue_warning ?? null);
    setBudget(String(json.settings?.monthly_budget_usd ?? 250));
  }

  useEffect(() => {
    loadSettings().catch((e) => setError(e instanceof Error ? e.message : "Could not load studio"));
  }, []);

  function jobBody(type: string, extra: Record<string, unknown> = {}) {
    return {
      type,
      title,
      goal,
      independent_count: independent,
      case_based_count: caseBased,
      generate_images: images,
      difficulty_mix: { easy: 1, medium: 1, hard: 0 },
      ...extra,
    };
  }

  async function createJob(type: string, extra: Record<string, unknown> = {}) {
    const json = await api("jobs", { method: "POST", body: JSON.stringify(jobBody(type, extra)) });
    setLastJob(json.job ?? null);
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-emerald-600" />
          AI Content Studio
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Create Academy drafts here. AI cannot publish. Human review is required. Not official CICC exam material.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant={settings.openai_key_present ? "default" : "secondary"}>
          OpenAI {settings.openai_key_present ? "connected" : "not configured"}
        </Badge>
        <Badge variant={settings.manus_key_present ? "default" : "secondary"}>
          Manus {settings.manus_enabled && settings.manus_key_present ? "on" : "off"}
        </Badge>
        <Badge variant="outline">Spend ${Number(settings.month_spend_usd ?? 0).toFixed(2)} this month</Badge>
      </div>

      {queueWarning ? (
        <Alert>
          <AlertDescription>{queueWarning}</AlertDescription>
        </Alert>
      ) : null}
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

      <Tabs
        value={tab}
        onValueChange={(next) => {
          setTab(next);
          if (next === "jobs") {
            api("jobs").then((j) => setJobs(j.data ?? [])).catch((e) => setError(e.message));
          }
          if (next === "review") {
            api("review-queue").then((j) => setQueue(j.data ?? [])).catch((e) => setError(e.message));
          }
          if (next === "usage") {
            api("usage")
              .then((j) => {
                setUsage(j.data ?? []);
                setMonthSpend(Number(j.month_spend_usd ?? 0));
              })
              .catch((e) => setError(e.message));
          }
        }}
      >
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="create">Create course</TabsTrigger>
          <TabsTrigger value="questions">Questions</TabsTrigger>
          <TabsTrigger value="cases">Cases</TabsTrigger>
          <TabsTrigger value="mock">Mock pool</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="review">Review queue</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Create exam-prep course</CardTitle>
              <CardDescription>
                Enter a title, then generate a blueprint. After you approve it, the studio imports a draft course — not a published course.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2 space-y-1">
                <Label>Course title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. RCIC-IRB Specialization Exam Mastery" />
              </div>
              <div className="sm:col-span-2 space-y-1">
                <Label>What this draft should cover</Label>
                <Textarea value={goal} onChange={(e) => setGoal(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Independent MCQs</Label>
                <Input type="number" min={0} value={independent} onChange={(e) => setIndependent(Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <Label>Case-based MCQs</Label>
                <Input type="number" min={0} value={caseBased} onChange={(e) => setCaseBased(Number(e.target.value))} />
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" checked={images} onChange={(e) => setImages(e.target.checked)} />
                Generate images (off by default)
              </label>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button
                  disabled={busy || !title.trim()}
                  onClick={() =>
                    run("Blueprint job created. Approve it to import a draft.", () =>
                      createJob("course", { generate_blueprint_only: true })
                    )
                  }
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {busy ? "Working…" : "Create blueprint"}
                </Button>
                <Button
                  variant="outline"
                  disabled={busy || !lastJob?.id}
                  onClick={() =>
                    run("Draft generation started.", async () => {
                      const json = await api(`jobs/${lastJob!.id}/approve-blueprint`, { method: "POST" });
                      setLastJob(json.job ?? lastJob);
                    })
                  }
                >
                  Approve blueprint & create draft
                </Button>
              </div>
            </CardContent>
          </Card>
          {lastJob ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Latest job</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-3 text-sm">
                <span>#{lastJob.id}</span>
                <Badge>{lastJob.status ?? "queued"}</Badge>
                <span>{lastJob.title ?? title}</span>
                {lastJob.course_id ? <span>Draft course #{lastJob.course_id}</span> : null}
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="questions">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Create independent MCQ drafts</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                disabled={busy}
                onClick={() =>
                  run("Question job created.", () =>
                    createJob("questions", { generate_cases: false, generate_case_mcqs: false })
                  )
                }
              >
                <Plus className="h-4 w-4 mr-1" />Create MCQ drafts
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cases">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Create case drafts</CardTitle>
            </CardHeader>
            <CardContent>
              <Button disabled={busy} onClick={() => run("Case job created.", () => createJob("cases"))}>
                <Plus className="h-4 w-4 mr-1" />Create case drafts
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mock">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Create mock question pool</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                disabled={busy}
                onClick={() =>
                  run("Mock pool job created.", () =>
                    createJob("mock_pool", {
                      independent_count: independent || 300,
                      case_based_count: caseBased || 300,
                    })
                  )
                }
              >
                <Plus className="h-4 w-4 mr-1" />Create mock pool
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jobs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No jobs yet. Use Create course to start one.
                  </TableCell>
                </TableRow>
              ) : (
                jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell>{job.id}</TableCell>
                    <TableCell>{job.title ?? "—"}</TableCell>
                    <TableCell>{job.type}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{job.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="review">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Job</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {queue.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    Review queue is empty.
                  </TableCell>
                </TableRow>
              ) : (
                queue.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.id}</TableCell>
                    <TableCell>{item.job?.title ?? item.job?.id ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{item.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Studio limits</CardTitle>
              <CardDescription>API keys are saved under Integrations, not here.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 max-w-sm">
              <div className="space-y-1">
                <Label>Monthly budget (USD)</Label>
                <Input value={budget} onChange={(e) => setBudget(e.target.value)} />
              </div>
              <Button
                className="w-fit"
                disabled={busy}
                onClick={() =>
                  run("Settings saved.", async () => {
                    const json = await api("settings", {
                      method: "PUT",
                      body: JSON.stringify({ monthly_budget_usd: Number(budget) }),
                    });
                    setSettings(json);
                  })
                }
              >
                Save settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage">
          <p className="text-sm text-muted-foreground mb-3">Month spend ${monthSpend.toFixed(2)}</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Operation</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Est. cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usage.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.provider}</TableCell>
                  <TableCell>{row.operation}</TableCell>
                  <TableCell>{row.model ?? "—"}</TableCell>
                  <TableCell>{row.estimated_cost_usd ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { adminAuthHeaders } from "@/lib/admin-auth";

const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000") + "/api/v1";

function headers() {
  return adminAuthHeaders("application/json");
}

type Summary = Record<string, string | number | boolean | null>;

export default function AdminLearningExamsPage() {
  const [domain, setDomain] = useState("rcic_academy");
  const [exams, setExams] = useState<Array<{ id: number; name: string }>>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [detail, setDetail] = useState<{ exam?: { name: string }; evidence_summary?: Summary } | null>(null);
  const [payload, setPayload] = useState<unknown>(null);
  const [lmsJobId, setLmsJobId] = useState<number | null>(null);

  async function loadList() {
    const res = await fetch(`${API}/admin/learning/exams?product_domain=${domain}`, { headers: headers() });
    const json = await res.json();
    setExams(json.data ?? []);
  }

  useEffect(() => {
    loadList();
  }, [domain]);

  async function loadExam(id: number) {
    setOpen(id);
    const res = await fetch(`${API}/admin/learning/exams/${id}?product_domain=${domain}`, { headers: headers() });
    setDetail(await res.json());
  }

  async function createExam() {
    const res = await fetch(`${API}/admin/learning/exams?product_domain=${domain}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        name: domain === "rcic_academy" ? "RCIC-IRB Specialization Exam" : "Canadian Citizenship Test",
        generation_profile: domain === "rcic_academy" ? "rcic_exam_prep" : "citizenship_exam_prep",
      }),
    });
    setPayload(await res.json());
    loadList();
  }

  async function post(path: string, body: unknown) {
    const res = await fetch(`${API}/admin/learning/exams/${open}${path}?product_domain=${domain}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(body),
    });
    const json = await res.json();
    setPayload(json);
    if (typeof json?.job_id === "number") {
      setLmsJobId(json.job_id);
    }
    if (open) loadExam(open);
  }

  async function approveLmsBlueprint() {
    if (!lmsJobId) return;
    const res = await fetch(`${API}/admin/learning/lms-ai-jobs/${lmsJobId}/approve-blueprint`, {
      method: "POST",
      headers: headers(),
    });
    setPayload(await res.json());
  }

  const summary = detail?.evidence_summary ?? {};

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Learning → Exams</h1>
      <p className="text-sm text-muted-foreground">
        Research the exam before generating. AI never publishes. Statuses are Verified / Review Required / Source
        Conflict — never “100% accurate”.
      </p>
      <div className="flex gap-2">
        <button className="rounded border px-3 py-1 text-sm" onClick={() => setDomain("rcic_academy")}>
          RCIC Academy
        </button>
        <button className="rounded border px-3 py-1 text-sm" onClick={() => setDomain("client_lms")}>
          Client LMS
        </button>
        <button className="rounded border px-3 py-1 text-sm" onClick={createExam}>
          Create Exam
        </button>
        <a className="rounded border px-3 py-1 text-sm" href="/admindashboard/academy/ai-studio">
          AI Studio
        </a>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ul className="space-y-2">
          {exams.map((exam) => (
            <li key={exam.id}>
              <button className="w-full rounded border p-3 text-left" onClick={() => loadExam(exam.id)}>
                {exam.name}
              </button>
            </li>
          ))}
        </ul>
        {open && (
          <div className="space-y-3 rounded border p-4">
            <h2 className="font-medium">Research / Evidence</h2>
            <dl className="grid grid-cols-2 gap-1 text-sm">
              {Object.entries(summary).map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{k.replaceAll("_", " ")}</dt>
                  <dd>{String(v)}</dd>
                </div>
              ))}
            </dl>
            <div className="flex flex-wrap gap-2 text-sm">
              <button
                className="rounded border px-2 py-1"
                onClick={() =>
                  post("/sources", {
                    source_type: "official_exam_page",
                    url: domain === "client_lms"
                      ? "https://www.canada.ca/en/immigration-refugees-citizenship/services/canadian-citizenship.html"
                      : "https://college-ic.ca",
                    title: "Official exam page",
                    verification_status: "verified",
                  })
                }
              >
                Add Source
              </button>
              <button className="rounded border px-2 py-1" onClick={() => post("/evidence-pack/approve", {})}>
                Approve Pack
              </button>
              <button
                className="rounded border px-2 py-1"
                disabled={summary.evidence_pack !== "APPROVED"}
                onClick={() =>
                  post(
                    "/generate-course",
                    domain === "client_lms"
                      ? {
                          title: "Citizenship smoke draft",
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
                        }
                      : {
                          title: "IRB smoke draft",
                          generate_lessons: true,
                          generate_independent_mcqs: true,
                          generate_cases: true,
                          generate_case_mcqs: true,
                          independent_count: 10,
                          case_based_count: 10,
                          case_count: 2,
                          include_mock: true,
                        }
                  )
                }
              >
                Generate Full Course with AI
              </button>
              {domain === "client_lms" && lmsJobId ? (
                <button className="rounded border px-2 py-1" onClick={approveLmsBlueprint}>
                  Approve LMS blueprint
                </button>
              ) : null}
            </div>
          </div>
        )}
      </div>
      {payload ? (
        <pre className="overflow-auto rounded border p-3 text-xs">{JSON.stringify(payload, null, 2)}</pre>
      ) : null}
    </div>
  );
}
